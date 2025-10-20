"""
diaries 라우터의 등록된 라우트 확인
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.routers import diaries

print("=" * 60)
print("Diaries 라우터 확인")
print("=" * 60)

print(f"\nRouter: {diaries.router}")
print(f"Routes count: {len(diaries.router.routes)}")

print("\n등록된 라우트:")
for route in diaries.router.routes:
    print(f"  - {route.methods} {route.path}")

print("\n'suggested'가 포함된 라우트:")
for route in diaries.router.routes:
    if 'suggested' in route.path:
        print(f"  - {route.methods} {route.path}")
        print(f"    Name: {route.name}")
        print(f"    Endpoint: {route.endpoint}")

