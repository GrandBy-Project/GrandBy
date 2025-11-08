"""
Call session store abstraction for AI call conversations.
- Default backend: memory (no external dependency)
- Optional backend: Redis (lazy import; falls back to memory if unavailable)

Stored items per call_sid:
- conversation list: [{"role": "user"|"assistant", "content": str}, ...]
- saved flag: to prevent duplicate DB saves
"""

import json
import logging
from typing import List, Dict, Optional

from app.config import settings

logger = logging.getLogger(__name__)


class BaseSessionStore:
    def append_message(self, call_sid: str, role: str, content: str) -> None:
        raise NotImplementedError

    def get_conversation(self, call_sid: str) -> List[Dict[str, str]]:
        raise NotImplementedError

    def clear_session(self, call_sid: str) -> None:
        raise NotImplementedError

    def is_saved(self, call_sid: str) -> bool:
        raise NotImplementedError

    def mark_saved(self, call_sid: str) -> None:
        raise NotImplementedError

    # Finalization idempotency & distributed lock
    def acquire_finalize_lock(self, call_sid: str, ttl_seconds: int = 30) -> bool:
        raise NotImplementedError

    def release_finalize_lock(self, call_sid: str) -> None:
        raise NotImplementedError

    def is_finalized(self, call_sid: str) -> bool:
        raise NotImplementedError

    def mark_finalized(self, call_sid: str) -> None:
        raise NotImplementedError


class MemorySessionStore(BaseSessionStore):
    def __init__(self):
        self._conversations: Dict[str, List[Dict[str, str]]] = {}
        self._saved_flags: set[str] = set()
        self._finalized_flags: set[str] = set()
        self._locks: set[str] = set()

    def append_message(self, call_sid: str, role: str, content: str) -> None:
        if not call_sid:
            return
        if call_sid not in self._conversations:
            self._conversations[call_sid] = []
        self._conversations[call_sid].append({"role": role, "content": content})
        # Trim to last 20 to prevent unbounded growth (matches existing behavior)
        if len(self._conversations[call_sid]) > 20:
            self._conversations[call_sid] = self._conversations[call_sid][-20:]

    def get_conversation(self, call_sid: str) -> List[Dict[str, str]]:
        return list(self._conversations.get(call_sid, []))

    def clear_session(self, call_sid: str) -> None:
        if call_sid in self._conversations:
            del self._conversations[call_sid]
        if call_sid in self._saved_flags:
            self._saved_flags.remove(call_sid)

    def is_saved(self, call_sid: str) -> bool:
        return call_sid in self._saved_flags

    def mark_saved(self, call_sid: str) -> None:
        self._saved_flags.add(call_sid)

    def acquire_finalize_lock(self, call_sid: str, ttl_seconds: int = 30) -> bool:
        key = f"lock:finalize:{call_sid}"
        if key in self._locks:
            return False
        self._locks.add(key)
        return True

    def release_finalize_lock(self, call_sid: str) -> None:
        key = f"lock:finalize:{call_sid}"
        if key in self._locks:
            self._locks.remove(key)

    def is_finalized(self, call_sid: str) -> bool:
        return call_sid in self._finalized_flags

    def mark_finalized(self, call_sid: str) -> None:
        self._finalized_flags.add(call_sid)


class RedisSessionStore(BaseSessionStore):
    def __init__(self, redis_url: str):
        self._redis = None
        try:
            import redis  # type: ignore
            self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
            # quick ping
            self._redis.ping()
            logger.info("✅ RedisSessionStore initialized")
        except Exception as e:
            logger.warning(f"⚠️ RedisSessionStore init failed, falling back to Memory: {e}")
            self._redis = None
            self._fallback = MemorySessionStore()

    def _conv_key(self, call_sid: str) -> str:
        return f"call:{call_sid}:conversation"

    def _saved_key(self, call_sid: str) -> str:
        return f"call:{call_sid}:saved"

    def _finalized_key(self, call_sid: str) -> str:
        return f"call:{call_sid}:finalized"

    def _lock_key(self, call_sid: str) -> str:
        return f"lock:finalize:{call_sid}"

    def append_message(self, call_sid: str, role: str, content: str) -> None:
        if not call_sid:
            return
        if not self._redis:
            return self._fallback.append_message(call_sid, role, content)
        try:
            entry = json.dumps({"role": role, "content": content}, ensure_ascii=False)
            pipe = self._redis.pipeline()
            pipe.rpush(self._conv_key(call_sid), entry)
            # keep only last 20 entries
            pipe.ltrim(self._conv_key(call_sid), -20, -1)
            pipe.execute()
        except Exception as e:
            logger.error(f"❌ Redis append_message error: {e}")

    def get_conversation(self, call_sid: str) -> List[Dict[str, str]]:
        if not self._redis:
            return self._fallback.get_conversation(call_sid)
        try:
            items = self._redis.lrange(self._conv_key(call_sid), 0, -1)
            result = []
            for it in items:
                try:
                    result.append(json.loads(it))
                except Exception:
                    continue
            return result
        except Exception as e:
            logger.error(f"❌ Redis get_conversation error: {e}")
            return []

    def clear_session(self, call_sid: str) -> None:
        if not self._redis:
            return self._fallback.clear_session(call_sid)
        try:
            pipe = self._redis.pipeline()
            pipe.delete(self._conv_key(call_sid))
            pipe.delete(self._saved_key(call_sid))
            pipe.execute()
        except Exception as e:
            logger.error(f"❌ Redis clear_session error: {e}")

    def is_saved(self, call_sid: str) -> bool:
        if not self._redis:
            return self._fallback.is_saved(call_sid)
        try:
            return self._redis.get(self._saved_key(call_sid)) == "1"
        except Exception as e:
            logger.error(f"❌ Redis is_saved error: {e}")
            return False

    def mark_saved(self, call_sid: str) -> None:
        if not self._redis:
            return self._fallback.mark_saved(call_sid)
        try:
            self._redis.set(self._saved_key(call_sid), "1", ex=60 * 60 * 24)
        except Exception as e:
            logger.error(f"❌ Redis mark_saved error: {e}")

    def acquire_finalize_lock(self, call_sid: str, ttl_seconds: int = 30) -> bool:
        if not self._redis:
            return self._fallback.acquire_finalize_lock(call_sid, ttl_seconds)
        try:
            # SET NX EX for lock; value is 1
            return bool(self._redis.set(self._lock_key(call_sid), "1", nx=True, ex=ttl_seconds))
        except Exception as e:
            logger.error(f"❌ Redis acquire_finalize_lock error: {e}")
            return False

    def release_finalize_lock(self, call_sid: str) -> None:
        if not self._redis:
            return self._fallback.release_finalize_lock(call_sid)
        try:
            self._redis.delete(self._lock_key(call_sid))
        except Exception as e:
            logger.error(f"❌ Redis release_finalize_lock error: {e}")

    def is_finalized(self, call_sid: str) -> bool:
        if not self._redis:
            return self._fallback.is_finalized(call_sid)
        try:
            return self._redis.get(self._finalized_key(call_sid)) == "1"
        except Exception as e:
            logger.error(f"❌ Redis is_finalized error: {e}")
            return False

    def mark_finalized(self, call_sid: str) -> None:
        if not self._redis:
            return self._fallback.mark_finalized(call_sid)
        try:
            self._redis.set(self._finalized_key(call_sid), "1", ex=60 * 60 * 24)
        except Exception as e:
            logger.error(f"❌ Redis mark_finalized error: {e}")


def get_session_store() -> BaseSessionStore:
    backend = getattr(settings, "CALL_SESSION_BACKEND", "memory").lower()
    if backend == "redis":
        redis_url = getattr(settings, "REDIS_URL", None)
        if not redis_url:
            logger.warning("⚠️ REDIS_URL not set; using memory session store")
            return MemorySessionStore()
        return RedisSessionStore(redis_url)
    return MemorySessionStore()
