"""
TTS Benchmark Script for Naver Clova (httpx async)

Measures:
- Latency percentiles (p50/p95/p99)
- Error rate (4xx/5xx/timeout equivalent via service return)
- Process RSS (if psutil available)
- Event loop delay (avg/p95/p99)

Usage (from backend/):
  python -m scripts.tts_benchmark --concurrency 10 --requests 100 --text "안녕하세요, 테스트입니다." --warmup 5

Multiple scenarios:
  python -m scripts.tts_benchmark --concurrency 1 10 50 --requests 50 --text-len 20 80 160
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import statistics
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import psutil  # type: ignore
except Exception:
    psutil = None  # Optional dependency

# Ensure project import path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
APP_DIR = os.path.join(BACKEND_DIR, "app")
import sys

if APP_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
    sys.path.insert(0, APP_DIR)

from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service  # type: ignore


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    values_sorted = sorted(values)
    k = (len(values_sorted) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(values_sorted) - 1)
    if f == c:
        return values_sorted[f]
    d0 = values_sorted[f] * (c - k)
    d1 = values_sorted[c] * (k - f)
    return d0 + d1


class EventLoopLagMonitor:
    def __init__(self, interval: float = 0.05):
        self.interval = interval
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.samples: List[float] = []

    async def _run(self):
        expected = time.perf_counter() + self.interval
        while self._running:
            await asyncio.sleep(self.interval)
            now = time.perf_counter()
            lag = max(0.0, now - expected)
            self.samples.append(lag)
            expected = now + self.interval

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())

    async def stop(self):
        self._running = False
        if self._task:
            try:
                await self._task
            except Exception:
                pass

    def summary(self) -> Dict[str, float]:
        s = self.samples
        return {
            "avg": float(statistics.mean(s)) if s else 0.0,
            "p95": percentile(s, 95) if s else 0.0,
            "p99": percentile(s, 99) if s else 0.0,
        }


def gen_text(base_text: Optional[str], target_len: Optional[int]) -> str:
    if base_text:
        return base_text
    length = target_len or 40
    seeds = [
        "안녕하세요, 오늘 기분은 어떠세요?",
        "점심은 맛있게 드셨나요?",
        "날씨가 선선하니 산책하기 좋은 날이에요.",
        "물을 충분히 마시는 것이 건강에 좋아요.",
        "오늘 일정이나 약 복용은 문제 없으셨나요?",
    ]
    s = random.choice(seeds)
    while len(s) < length:
        s += " " + random.choice(seeds)
    return s[:length]


async def run_once(text: str) -> Tuple[bool, float, Optional[str]]:
    start = time.perf_counter()
    try:
        audio, _elapsed_api = await naver_clova_tts_service.text_to_speech_bytes(text)
        ok = audio is not None and len(audio) > 0
        latency = time.perf_counter() - start
        return ok, latency, None if ok else "empty"
    except Exception as e:
        latency = time.perf_counter() - start
        return False, latency, f"exception:{type(e).__name__}"


async def worker(name: str, requests: int, text: str, results: List[float], errors: List[str]):
    for _ in range(requests):
        ok, latency, err = await run_once(text)
        if ok:
            results.append(latency)
        else:
            errors.append(err or "error")


def rss_bytes() -> Optional[int]:
    try:
        if psutil is None:
            return None
        proc = psutil.Process()
        return int(proc.memory_info().rss)
    except Exception:
        return None


async def scenario(concurrency: int, total_requests: int, base_text: Optional[str], text_len: Optional[int]) -> Dict[str, Any]:
    per_worker = max(1, total_requests // concurrency)
    remainder = max(0, total_requests - per_worker * concurrency)

    results: List[float] = []
    errors: List[str] = []

    loop_lag = EventLoopLagMonitor(interval=0.02)
    await loop_lag.start()

    text = gen_text(base_text, text_len)

    tasks = []
    for i in range(concurrency):
        nreq = per_worker + (1 if i < remainder else 0)
        if nreq <= 0:
            continue
        tasks.append(asyncio.create_task(worker(f"w{i}", nreq, text, results, errors)))

    rss_before = rss_bytes()
    t0 = time.perf_counter()
    await asyncio.gather(*tasks)
    t1 = time.perf_counter()
    await loop_lag.stop()
    rss_after = rss_bytes()

    # Percentiles
    p50 = percentile(results, 50)
    p95 = percentile(results, 95)
    p99 = percentile(results, 99)
    avg = float(statistics.mean(results)) if results else 0.0

    error_rate = (len(errors) / float(total_requests)) if total_requests > 0 else 0.0

    summary = {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "success": len(results),
        "errors": len(errors),
        "error_rate": error_rate,
        "latency": {
            "avg": avg,
            "p50": p50,
            "p95": p95,
            "p99": p99,
        },
        "duration_sec": t1 - t0,
        "throughput_rps": (len(results) / (t1 - t0)) if (t1 - t0) > 0 else 0.0,
        "event_loop_delay": loop_lag.summary(),
        "rss_before": rss_before,
        "rss_after": rss_after,
        "rss_delta": (rss_after - rss_before) if (rss_before is not None and rss_after is not None) else None,
        "text_len": len(text),
    }
    return summary


async def main_async(args: argparse.Namespace):
    # Warmup (optional)
    if args.warmup > 0:
        await asyncio.gather(*[run_once(gen_text(args.text, args.text_len)) for _ in range(args.warmup)])

    results = []
    conc_list = args.concurrency or [1]
    for conc in conc_list:
        res = await scenario(conc, args.requests, args.text, args.text_len)
        results.append(res)

    print(json.dumps({"scenarios": results}, ensure_ascii=False, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Naver Clova TTS Benchmark")
    parser.add_argument("--concurrency", nargs="*", type=int, default=[1], help="Concurrency levels, e.g. 1 10 50")
    parser.add_argument("--requests", type=int, default=20, help="Total requests per scenario")
    parser.add_argument("--text", type=str, default=None, help="Fixed text to synthesize")
    parser.add_argument("--text-len", type=int, default=None, help="Generate text with approx length if --text not provided")
    parser.add_argument("--warmup", type=int, default=3, help="Warmup requests before measuring")
    return parser.parse_args()


def main():
    args = parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()


