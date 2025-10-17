# 🗄️ Grandby 데이터베이스 개발 워크플로우 가이드

> 데이터베이스 스키마 변경부터 더미 데이터 생성까지 전체 프로세스

---

    ## 📌 핵심 개념 (먼저 읽기!)

    ### 1. **Alembic 마이그레이션**
    - **역할**: 데이터베이스 스키마 변경 이력 관리 (Git과 비슷)
    - **파일 위치**: `backend/migrations/versions/`
    - **자동 실행**: Docker 시작 시 자동으로 최신 버전까지 적용

    ### 2. **모델 (Models)**
    - **역할**: Python 코드로 데이터베이스 테이블 정의
    - **파일 위치**: `backend/app/models/`
    - **원칙**: 모델을 먼저 수정하고, 마이그레이션으로 DB에 반영

    ### 3. **시드 데이터 (Seed Data)**
    - **역할**: 테스트/개발용 더미 데이터
    - **파일 위치**: `backend/scripts/seed_*.py`
    - **실행**: 수동 또는 첫 실행 시 자동 (`AUTO_SEED=true`)

    ---

    ## 🎯 일반적인 개발 시나리오

    ### **시나리오 A: 새 프로젝트 시작**
    ### **시나리오 B: 기존 테이블에 컬럼 추가**
    ### **시나리오 C: 새 테이블 추가**
    ### **시나리오 D: 더미 데이터만 추가**

    ---

    ## 📘 시나리오 A: 새 프로젝트 시작 (신규 개발자)

    ### **목표**
    처음 프로젝트를 클론받고 로컬에서 실행하기

    ### **단계별 가이드**

    #### **1단계: 프로젝트 클론**
    ```powershell
    git clone https://github.com/your-org/grandby_proj.git
    cd grandby_proj
    ```

    #### **2단계: Docker 실행**
    ```powershell
    # Docker 컨테이너 시작
    docker-compose up -d

    # 로그 확인 (자동화 과정 보기)
    docker logs -f grandby_api
    ```

    #### **3단계: 자동으로 실행되는 것들 확인**
    ```
    출력 예시:
    🚀 Grandby Backend 시작 중...
    ⏳ 데이터베이스 연결 대기 중...
    ✅ 데이터베이스 연결 완료!
    🔄 데이터베이스 마이그레이션 실행 중...
    INFO [alembic] Running upgrade -> 7c30e54c1546, Initial tables
    ✅ 마이그레이션 완료!
    🌱 시드 데이터 확인 중...
    📝 시드 데이터 생성 중...
    ✅ 시드 데이터 생성 완료!
    🎉 초기화 완료! 서버 시작...
    ```

    #### **4단계: 데이터 확인 (선택사항)**

    **방법 1: psql로 확인**
    ```powershell
    # DB 접속
    docker exec -it grandby_postgres psql -U grandby -d grandby_db

    # 테이블 목록 보기
    \dt

    # 사용자 데이터 확인
    SELECT email, name, role FROM users;

    # 종료
    \q
    ```

    **방법 2: GUI 툴 사용 (DBeaver, pgAdmin)**
    ```
    Host: localhost
    Port: 5432
    Database: grandby_db
    Username: grandby
    Password: grandby_secret_password
    ```

    #### **5단계: API 테스트**
    ```powershell
    # 브라우저에서 열기
    http://localhost:8000/docs

    # 또는 curl로 테스트
    curl http://localhost:8000/health
    ```

    ### **✅ 완료!**
    - ✅ DB 테이블 자동 생성
    - ✅ 테스트 사용자 자동 생성
    - ✅ API 서버 실행 중

    ---

    ## 📗 시나리오 B: 기존 테이블에 컬럼 추가

    ### **목표**
    예: `todos` 테이블에 `priority` (우선순위) 컬럼 추가

    ### **단계별 가이드**

    #### **1단계: 브랜치 생성 (권장)**
    ```powershell
    git checkout develop
    git pull
    git checkout -b feature/add-todo-priority
    ```

    #### **2단계: 모델 파일 수정**
    ```python
    # backend/app/models/todo.py

    class Todo(Base):
        """TODO 모델"""
        __tablename__ = "todos"
        
        # 기존 컬럼들...
        title = Column(String(200), nullable=False)
        description = Column(Text, nullable=True)
        
        # 🆕 새 컬럼 추가
        priority = Column(Integer, default=0, nullable=False)  
        # 0: 낮음, 1: 보통, 2: 높음
        
        # ... 나머지 컬럼들
    ```

    #### **3단계: 스키마(Pydantic) 수정 (필요 시)**
    ```python
    # backend/app/schemas/todo.py

    class TodoCreate(BaseModel):
        title: str
        description: Optional[str] = None
        priority: int = 0  # 🆕 추가
        due_date: date
        # ...

    class TodoResponse(BaseModel):
        todo_id: str
        title: str
        priority: int  # 🆕 추가
        # ...
    ```

    #### **4단계: 마이그레이션 생성**
    ```powershell
    # Docker 컨테이너 안에서 Alembic 실행
    docker exec -it grandby_api alembic revision --autogenerate -m "Add priority column to todos"
    ```

    **생성되는 파일 예시:**
    ```python
    # backend/migrations/versions/20251017_1234-abc123_add_priority_column_to_todos.py

    """Add priority column to todos

    Revision ID: abc123
    Revises: 7c30e54c1546
    Create Date: 2025-10-17 12:34:56.789
    """

    def upgrade() -> None:
        op.add_column('todos', sa.Column('priority', sa.Integer(), nullable=False, server_default='0'))

    def downgrade() -> None:
        op.drop_column('todos', 'priority')
    ```

    #### **5단계: 생성된 마이그레이션 파일 확인**
    ```powershell
    # 생성된 파일 확인
    ls backend/migrations/versions/

    # 파일 내용 확인 (옵션)
    cat backend/migrations/versions/20251017_*_add_priority*.py
    ```

    ⚠️ **중요: 파일 내용 검토!**
    - `upgrade()` 함수가 올바른지 확인
    - 필요하면 수동 수정 가능 (이 시점에만!)

    #### **6단계: 마이그레이션 적용**
    ```powershell
    # DB에 실제로 컬럼 추가
    docker exec -it grandby_api alembic upgrade head
    ```

    **출력 예시:**
    ```
    INFO [alembic.runtime.migration] Running upgrade 7c30e54c1546 -> abc123, Add priority column to todos
    ```

    #### **7단계: DB 확인**
    ```powershell
    docker exec -it grandby_postgres psql -U grandby -d grandby_db

    # psql에서
    \d todos
    # priority 컬럼이 추가되었는지 확인

    SELECT todo_id, title, priority FROM todos LIMIT 5;
    ```

    #### **8단계: 시드 스크립트 수정 (선택사항)**
    ```python
    # backend/scripts/seed_todos.py

    todos = [
        Todo(
            elderly_id=elderly.user_id,
            creator_id=caregiver.user_id,
            title="혈압약 복용",
            priority=2,  # 🆕 높음
            # ...
        ),
        Todo(
            elderly_id=elderly.user_id,
            creator_id=caregiver.user_id,
            title="산책하기",
            priority=1,  # 🆕 보통
            # ...
        ),
    ]
    ```

    #### **9단계: Git 커밋**
    ```powershell
    # 변경된 파일들 추가
    git add backend/app/models/todo.py
    git add backend/app/schemas/todo.py
    git add backend/migrations/versions/20251017_*_add_priority*.py
    git add backend/scripts/seed_todos.py

    # 커밋
    git commit -m "feat: Add priority column to todos table"

    # 푸시
    git push origin feature/add-todo-priority
    ```

    #### **10단계: Pull Request 생성**
    - GitHub/GitLab에서 PR 생성
    - 팀원 리뷰 요청
    - 승인 후 merge

    ### **✅ 완료!**
    - ✅ todos 테이블에 priority 컬럼 추가
    - ✅ 마이그레이션 파일 생성 및 적용
    - ✅ 기존 데이터는 default 값(0)으로 자동 설정

    ---

    ## 📙 시나리오 C: 새 테이블 추가

    ### **목표**
    예: `bookmarks` (북마크) 테이블 새로 생성

    ### **단계별 가이드**

    #### **1단계: 모델 파일 생성**
    ```python
    # backend/app/models/bookmark.py (새 파일)

    """
    북마크 관련 데이터베이스 모델
    """

    from sqlalchemy import Column, String, DateTime, ForeignKey, Text
    from sqlalchemy.orm import relationship
    from datetime import datetime
    import uuid

    from app.database import Base


    class Bookmark(Base):
        """북마크 모델"""
        __tablename__ = "bookmarks"
        
        # Primary Key
        bookmark_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
        
        # Foreign Keys
        user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
        diary_id = Column(String(36), ForeignKey("diaries.diary_id"), nullable=False)
        
        # 메모
        memo = Column(Text, nullable=True)
        
        # 타임스탬프
        created_at = Column(DateTime, default=datetime.utcnow)
        
        # Relationships
        user = relationship("User", backref="bookmarks")
        diary = relationship("Diary", backref="bookmarks")
        
        def __repr__(self):
            return f"<Bookmark {self.bookmark_id}>"
    ```

    #### **2단계: 모델 등록**
    ```python
    # backend/app/models/__init__.py

    from app.models.user import User, UserConnection, UserSettings
    from app.models.todo import Todo
    from app.models.diary import Diary, DiaryPhoto, DiaryComment
    from app.models.call import CallLog, CallSettings, CallTranscript, EmotionLog
    from app.models.notification import Notification
    from app.models.bookmark import Bookmark  # 🆕 추가

    __all__ = [
        "User", "UserConnection", "UserSettings",
        "Todo",
        "Diary", "DiaryPhoto", "DiaryComment",
        "CallLog", "CallSettings", "CallTranscript", "EmotionLog",
        "Notification",
        "Bookmark",  # 🆕 추가
    ]
    ```

    #### **3단계: 스키마 생성**
    ```python
    # backend/app/schemas/bookmark.py (새 파일)

    from pydantic import BaseModel
    from datetime import datetime
    from typing import Optional


    class BookmarkCreate(BaseModel):
        diary_id: str
        memo: Optional[str] = None


    class BookmarkResponse(BaseModel):
        bookmark_id: str
        user_id: str
        diary_id: str
        memo: Optional[str]
        created_at: datetime
        
        class Config:
            from_attributes = True
    ```

    #### **4단계: 마이그레이션 생성**
    ```powershell
    docker exec -it grandby_api alembic revision --autogenerate -m "Add bookmarks table"
    ```

    #### **5단계: 마이그레이션 적용**
    ```powershell
    docker exec -it grandby_api alembic upgrade head
    ```

    #### **6단계: DB 확인**
    ```powershell
    docker exec -it grandby_postgres psql -U grandby -d grandby_db

    # psql에서
    \dt
    # bookmarks 테이블 확인

    \d bookmarks
    # 테이블 구조 확인
    ```

    #### **7단계: 시드 스크립트 생성 (선택사항)**
    ```python
    # backend/scripts/seed_bookmarks.py (새 파일)

    """
    테스트 북마크 시드 데이터 생성
    """
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).parent.parent))

    from app.database import SessionLocal
    from app.models.user import User
    from app.models.diary import Diary
    from app.models.bookmark import Bookmark


    def seed_bookmarks():
        """테스트 북마크 생성"""
        db = SessionLocal()
        try:
            # 사용자와 일기 찾기
            user = db.query(User).first()
            diary = db.query(Diary).first()
            
            if not user or not diary:
                print("⚠️  사용자나 일기 데이터가 없습니다.")
                return
            
            # 기존 북마크 확인
            existing = db.query(Bookmark).first()
            if existing:
                print("⚠️  북마크 데이터가 이미 존재합니다.")
                return
            
            # 북마크 생성
            bookmarks = [
                Bookmark(
                    user_id=user.user_id,
                    diary_id=diary.diary_id,
                    memo="나중에 다시 읽어보기"
                ),
            ]
            
            db.add_all(bookmarks)
            db.commit()
            
            print(f"✅ 북마크 데이터 생성 완료! ({len(bookmarks)}개)")
            
        except Exception as e:
            db.rollback()
            print(f"❌ 오류 발생: {e}")
            raise
        finally:
            db.close()


    if __name__ == "__main__":
        seed_bookmarks()
    ```

    #### **8단계: seed_all.py에 추가**
    ```python
    # backend/scripts/seed_all.py

    from seed_users import seed_users
    from seed_todos import seed_todos
    from seed_bookmarks import seed_bookmarks  # 🆕

    def seed_all():
        print("🌱 시드 데이터 생성 시작...\n")
        
        seed_users()
        seed_todos()
        seed_bookmarks()  # 🆕
        
        print("\n✨ 모든 시드 데이터 생성 완료!")
    ```

    #### **9단계: Git 커밋**
    ```powershell
    git add backend/app/models/bookmark.py
    git add backend/app/models/__init__.py
    git add backend/app/schemas/bookmark.py
    git add backend/migrations/versions/20251017_*_add_bookmarks_table.py
    git add backend/scripts/seed_bookmarks.py
    git add backend/scripts/seed_all.py

    git commit -m "feat: Add bookmarks table"
    git push
    ```

    ### **✅ 완료!**
    - ✅ bookmarks 테이블 생성
    - ✅ 모델, 스키마, 시드 스크립트 완성

    ---

    ## 📕 시나리오 D: 더미 데이터만 추가/수정

    ### **목표**
    DB 구조 변경 없이 테스트 데이터만 추가

    ### **단계별 가이드**

    #### **1단계: 시드 스크립트 수정**
    ```python
    # backend/scripts/seed_todos.py

    todos = [
        # 기존 데이터...
        
        # 🆕 새 더미 데이터 추가
        Todo(
            elderly_id=elderly.user_id,
            creator_id=caregiver.user_id,
            title="물 마시기",
            description="하루 8잔 마시기",
            category=TodoCategory.OTHER,
            due_date=today,
            due_time=time(10, 0),
            creator_type=CreatorType.CAREGIVER,
            status=TodoStatus.PENDING,
            is_confirmed=True
        ),
        Todo(
            elderly_id=elderly.user_id,
            creator_id=elderly.user_id,
            title="손자에게 전화하기",
            description="생일 축하 전화",
            category=TodoCategory.OTHER,
            due_date=tomorrow,
            creator_type=CreatorType.ELDERLY,
            status=TodoStatus.PENDING,
            is_confirmed=True
        ),
    ]
    ```

    #### **2단계: 기존 데이터 삭제 (선택사항)**
    ```powershell
    # psql 접속
    docker exec -it grandby_postgres psql -U grandby -d grandby_db

    # 특정 데이터만 삭제
    DELETE FROM todos WHERE title = '특정 제목';

    # 모든 TODO 삭제
    TRUNCATE todos CASCADE;
    ```

    #### **3단계: 시드 스크립트 실행**
    ```powershell
    # 단일 시드 실행
    docker exec -it grandby_api python scripts/seed_todos.py

    # 또는 전체 시드 실행
    docker exec -it grandby_api python scripts/seed_all.py
    ```

    #### **4단계: 데이터 확인**
    ```powershell
    docker exec -it grandby_postgres psql -U grandby -d grandby_db

    # psql에서
    SELECT title, category, due_date, status FROM todos;
    ```

    #### **5단계: Git 커밋 (선택사항)**
    ```powershell
    git add backend/scripts/seed_todos.py
    git commit -m "chore: Update seed data for todos"
    git push
    ```

    ### **✅ 완료!**
    - ✅ 테스트 데이터 추가/수정
    - ✅ 마이그레이션 불필요

    ---

    ## 🔄 팀원이 변경사항을 받을 때

    ### **상황**
    누군가가 마이그레이션을 추가하고 Git에 푸시했을 때

    ### **단계별 가이드**

    #### **1단계: 코드 업데이트**
    ```powershell
    git checkout develop
    git pull
    ```

    #### **2단계: Docker 재시작 (자동 마이그레이션)**
    ```powershell
    docker-compose restart api

    # 또는 전체 재시작
    docker-compose down
    docker-compose up -d
    ```

    #### **3단계: 로그 확인**
    ```powershell
    docker logs -f grandby_api
    ```

    **출력 예시:**
    ```
    🔄 데이터베이스 마이그레이션 실행 중...
    INFO [alembic] Running upgrade 7c30e54c1546 -> abc123, Add priority column
    ✅ 마이그레이션 완료!
    ```

    #### **4단계: 수동 마이그레이션 (자동이 안 될 때)**
    ```powershell
    docker exec -it grandby_api alembic upgrade head
    ```

    ### **✅ 완료!**
    - ✅ 최신 DB 스키마로 업데이트
    - ✅ 기존 데이터 보존

    ---

    ## 🚨 문제 해결 (Troubleshooting)

    ### **문제 1: 마이그레이션 충돌**

    **증상:**
    ```
    sqlalchemy.exc.ProgrammingError: column "priority" already exists
    ```

    **해결:**
    ```powershell
    # 현재 버전 확인
    docker exec -it grandby_api alembic current

    # 마이그레이션 히스토리 확인
    docker exec -it grandby_api alembic history

    # 문제가 있는 마이그레이션 롤백
    docker exec -it grandby_api alembic downgrade -1

    # 다시 적용
    docker exec -it grandby_api alembic upgrade head
    ```

    ### **문제 2: 모델과 DB 불일치**

    **증상:**
    ```
    컬럼이 모델에는 있는데 DB에는 없음 (또는 반대)
    ```

    **해결 방법 A: 새 마이그레이션 생성**
    ```powershell
    docker exec -it grandby_api alembic revision --autogenerate -m "Sync models with DB"
    docker exec -it grandby_api alembic upgrade head
    ```

    **해결 방법 B: DB 초기화 (개발 환경만!)**
    ```powershell
    # ⚠️ 모든 데이터 삭제됨!
    docker-compose down -v
    docker-compose up -d
    ```

    ### **문제 3: 마이그레이션 파일 실수로 수정**

    **증상:**
    ```
    alembic.util.exc.CommandError: Can't locate revision identified by 'abc123'
    ```

    **해결:**
    ```powershell
    # Git에서 원본 복구
    git checkout HEAD -- backend/migrations/versions/파일명.py

    # DB의 alembic_version 테이블 확인
    docker exec -it grandby_postgres psql -U grandby -d grandby_db -c "SELECT * FROM alembic_version;"

    # 필요시 수동으로 버전 수정
    docker exec -it grandby_postgres psql -U grandby -d grandby_db -c "UPDATE alembic_version SET version_num='올바른버전';"
    ```

    ### **문제 4: 시드 데이터 중복**

    **증상:**
    ```
    IntegrityError: duplicate key value violates unique constraint
    ```

    **해결:**
    ```python
    # 시드 스크립트에 중복 체크 추가

    def seed_users():
        db = SessionLocal()
        try:
            # 🔍 중복 체크
            existing = db.query(User).filter(User.email == "test@test.com").first()
            if existing:
                print("⚠️  이미 존재합니다. 건너뜁니다.")
                return
            
            # 데이터 생성...
    ```

    ### **문제 5: Docker 컨테이너가 시작 안 됨**

    **확인 사항:**
    ```powershell
    # 1. 로그 확인
    docker logs grandby_api
    docker logs grandby_postgres

    # 2. DB 연결 확인
    docker exec grandby_postgres pg_isready -U grandby -d grandby_db

    # 3. 포트 충돌 확인
    netstat -ano | findstr :5432
    netstat -ano | findstr :8000

    # 4. 볼륨 문제 시 재생성
    docker-compose down -v
    docker-compose up -d
    ```

    ---

    ## 📋 체크리스트

    ### **컬럼 추가 시**
    - [ ] 모델 파일 수정 (`models/*.py`)
    - [ ] 스키마 파일 수정 (`schemas/*.py`)
    - [ ] 마이그레이션 생성 (`alembic revision --autogenerate`)
    - [ ] 마이그레이션 파일 내용 검토
    - [ ] 마이그레이션 적용 (`alembic upgrade head`)
    - [ ] DB에서 확인 (`psql` 또는 GUI)
    - [ ] 시드 스크립트 업데이트 (선택)
    - [ ] Git 커밋 및 푸시

    ### **테이블 추가 시**
    - [ ] 모델 파일 생성 (`models/새테이블.py`)
    - [ ] `models/__init__.py`에 등록
    - [ ] 스키마 파일 생성 (`schemas/새테이블.py`)
    - [ ] 마이그레이션 생성 및 적용
    - [ ] 시드 스크립트 생성 (선택)
    - [ ] `seed_all.py`에 추가 (선택)
    - [ ] Git 커밋 및 푸시

    ### **더미 데이터만 추가 시**
    - [ ] 시드 스크립트 수정 (`scripts/seed_*.py`)
    - [ ] 시드 실행 (`python scripts/seed_*.py`)
    - [ ] 데이터 확인
    - [ ] Git 커밋 (선택)

    ---

    ## 🎓 핵심 명령어 요약

    ### **자주 사용하는 명령어**

    ```powershell
    # === Docker ===
    docker-compose up -d              # 시작
    docker-compose down               # 중지 (데이터 유지)
    docker-compose down -v            # 중지 + 데이터 삭제
    docker-compose restart api        # API만 재시작
    docker logs -f grandby_api        # 로그 실시간 보기

    # === Alembic ===
    docker exec -it grandby_api alembic revision --autogenerate -m "메시지"  # 마이그레이션 생성
    docker exec -it grandby_api alembic upgrade head                         # 적용
    docker exec -it grandby_api alembic current                               # 현재 버전
    docker exec -it grandby_api alembic history                               # 히스토리
    docker exec -it grandby_api alembic downgrade -1                          # 롤백

    # === 시드 데이터 ===
    docker exec -it grandby_api python scripts/seed_users.py   # 사용자만
    docker exec -it grandby_api python scripts/seed_todos.py   # TODO만
    docker exec -it grandby_api python scripts/seed_all.py     # 전체

    # === PostgreSQL ===
    docker exec -it grandby_postgres psql -U grandby -d grandby_db  # 접속
    \dt                                                               # 테이블 목록
    \d 테이블명                                                        # 테이블 구조
    SELECT * FROM 테이블명;                                           # 데이터 조회
    \q                                                                # 종료
    ```

    ---

    ## 📚 추가 자료

    - **Alembic 공식 문서**: https://alembic.sqlalchemy.org/
    - **SQLAlchemy ORM**: https://docs.sqlalchemy.org/
    - **PostgreSQL 문서**: https://www.postgresql.org/docs/
    - **프로젝트 상세 가이드**: `docs/DB_MANAGEMENT_GUIDE.md`

    ---

    ## 🤝 팀 규칙

    ### **DO ✅**
    - 모델 먼저 수정, 마이그레이션 생성
    - 마이그레이션 파일 Git에 커밋
    - 의미 있는 커밋 메시지 작성
    - PR에 마이그레이션 설명 추가
    - 테스트 후 push

    ### **DON'T ❌**
    - 실행된 마이그레이션 파일 수정 금지
    - `docker-compose down -v` 프로덕션에서 절대 금지
    - 수동 SQL 실행 후 마이그레이션 스킵 금지
    - DB 직접 수정 후 모델 안 맞추기 금지

    ---

    **작성일**: 2025-10-17  
    **작성자**: Grandby 개발팀  
    **버전**: 1.0




