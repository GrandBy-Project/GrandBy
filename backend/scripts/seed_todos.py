"""
테스트 할일 시드 데이터 생성 (AI 분석 가능한 현실적 패턴)
- 최근 2주간의 실제 생활 패턴 기반 TODO 생성
- TodoService.create_todo()와 동일한 방식으로 생성
- 반복 일정(복약, 식사) + 변동 일정(병원, 운동) 혼합
- 요일별/시간대별 다양한 패턴 (주말 특성 반영)
- 예외 상황 포함 (건강 악화, 완료율 급락 시뮬레이션)
- 향후 AI 모델 학습 데이터로 활용 가능
"""
import sys
import random
import uuid
from pathlib import Path
from datetime import date, time, datetime, timedelta

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.todo import Todo, TodoStatus, CreatorType, TodoCategory, RecurringType


def seed_todos():
    """테스트 할일 생성 (2025년 10월 한 달치 데이터, 보호자 통계용)"""
    db = SessionLocal()
    try:
        # 어르신과 보호자 찾기
        elderly = db.query(User).filter(User.role == UserRole.ELDERLY).first()
        caregiver = db.query(User).filter(User.role == UserRole.CAREGIVER).first()
        
        if not elderly or not caregiver:
            print("⚠️  사용자 데이터를 먼저 생성해주세요. (seed_users.py)")
            return
        
        # 기존 할일 삭제 (재생성)
        existing_count = db.query(Todo).filter(Todo.elderly_id == elderly.user_id).count()
        if existing_count > 0:
            print(f"⚠️  기존 할일 {existing_count}개 삭제 후 재생성합니다.")
            db.query(Todo).filter(Todo.elderly_id == elderly.user_id).delete()
            db.commit()
        
        todos = []
        recurring_templates = []  # 반복 일정 원본 템플릿 저장
        
        # 2025년 10월 1일 ~ 10월 31일
        start_date = date(2025, 10, 1)
        end_date = date(2025, 10, 31)
        today = date.today()
        
        # 어르신의 실제 생활 패턴 정의
        # 1. 매일 반복되는 일정 (DAILY) - 원본 템플릿만 생성
        daily_schedule = [
            # 복약
            {
                "category": TodoCategory.MEDICINE,
                "title": "혈압약 복용",
                "description": "아침 식사 후 드세요",
                "due_time": time(9, 0),
                "completion_rate": 0.95,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
            {
                "category": TodoCategory.MEDICINE,
                "title": "당뇨약 복용",
                "description": "점심 식사 후 드세요",
                "due_time": time(13, 30),
                "completion_rate": 0.90,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
            {
                "category": TodoCategory.MEDICINE,
                "title": "소화제 복용",
                "description": "저녁 식사 후 드세요",
                "due_time": time(19, 30),
                "completion_rate": 0.85,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
            # 식사
            {
                "category": TodoCategory.MEAL,
                "title": "아침 식사",
                "description": "규칙적인 식사 시간 유지하기",
                "due_time": time(8, 0),
                "completion_rate": 0.98,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
            {
                "category": TodoCategory.MEAL,
                "title": "점심 식사",
                "description": "균형잡힌 식단으로 드세요",
                "due_time": time(12, 0),
                "completion_rate": 0.98,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
            {
                "category": TodoCategory.MEAL,
                "title": "저녁 식사",
                "description": "과식하지 않도록 주의하세요",
                "due_time": time(18, 30),
                "completion_rate": 0.98,
                "is_recurring": True,
                "recurring_type": RecurringType.DAILY,
            },
        ]
        
        # 2. 평일 운동 (월수금)
        weekday_exercise = [
            {
                "category": TodoCategory.EXERCISE,
                "title": "아침 산책",
                "description": "공원에서 30분 걷기",
                "due_time": time(7, 30),
                "completion_rate": 0.70,
                "is_recurring": True,
                "recurring_type": RecurringType.WEEKLY,
                "recurring_days": [0, 2, 4],  # 월수금
            },
            {
                "category": TodoCategory.EXERCISE,
                "title": "실내 체조",
                "description": "의자 운동 15분",
                "due_time": time(15, 0),
                "completion_rate": 0.65,
                "is_recurring": True,
                "recurring_type": RecurringType.WEEKLY,
                "recurring_days": [0, 2, 4],  # 월수금
            },
        ]
        
        # 3. 평일 사회활동 (화목)
        weekday_social = [
            {
                "category": TodoCategory.OTHER,
                "title": "친구와 통화",
                "description": "이웃 할머니께 안부 전화",
                "due_time": time(16, 0),
                "completion_rate": 0.80,
                "is_recurring": True,
                "recurring_type": RecurringType.WEEKLY,
                "recurring_days": [1, 3],  # 화목
            },
        ]
        
        # 4. 주말 활동 (토일)
        weekend_activities = [
            {
                "category": TodoCategory.OTHER,
                "title": "손주 영상통화",
                "description": "주말에 손주 얼굴 보기",
                "due_time": time(14, 0),
                "completion_rate": 0.90,
            },
            {
                "category": TodoCategory.OTHER,
                "title": "가족 모임 준비",
                "description": "가족과 함께 시간 보내기",
                "due_time": time(11, 0),
                "completion_rate": 0.85,
            },
            {
                "category": TodoCategory.EXERCISE,
                "title": "가벼운 산책",
                "description": "집 근처 천천히 걷기",
                "due_time": time(10, 0),
                "completion_rate": 0.75,
            },
        ]
        
        # 5. 오후 활동 (평일 오후 2-4시, 데이터 보강)
        afternoon_activities = [
            {
                "category": TodoCategory.OTHER,
                "title": "독서 시간",
                "description": "좋아하는 책 읽기",
                "due_time": time(14, 30),
                "completion_rate": 0.70,
            },
            {
                "category": TodoCategory.OTHER,
                "title": "뜨개질",
                "description": "취미 활동",
                "due_time": time(15, 30),
                "completion_rate": 0.75,
            },
        ]
        
        # 6. 비정기 병원 일정
        hospital_visits = [
            {
                "category": TodoCategory.HOSPITAL,
                "title": "정형외과 진료",
                "description": "무릎 관절 정기 검진",
                "due_time": time(14, 0),
                "completion_rate": 0.95,
            },
            {
                "category": TodoCategory.HOSPITAL,
                "title": "내과 정기검진",
                "description": "혈압/혈당 체크",
                "due_time": time(10, 30),
                "completion_rate": 0.95,
            },
        ]
        
        # ⚠️ 건강 악화 시뮬레이션 (10월 15-16일)
        health_decline_days = [15, 16]  # 10월 15일, 16일
        
        # 병원 방문 일정 (10월 중 2-3회)
        hospital_dates = [7, 21]  # 10월 7일, 21일
        
        # 반복 일정 원본 템플릿 먼저 생성 (반복 일정별로 1개씩)
        # 1) DAILY 반복 일정 원본 템플릿 생성
        for item in daily_schedule:
            template_id = str(uuid.uuid4())
            template = Todo(
                todo_id=template_id,
                elderly_id=elderly.user_id,
                creator_id=caregiver.user_id,
                title=item["title"],
                description=item["description"],
                category=item["category"],
                due_date=start_date,  # 10월 1일로 설정
                due_time=item["due_time"],
                creator_type=CreatorType.CAREGIVER,
                status=TodoStatus.PENDING,  # 템플릿은 항상 PENDING
                is_confirmed=True,
                is_recurring=True,  # 원본 템플릿
                recurring_type=item.get("recurring_type"),
                recurring_interval=item.get("recurring_interval", 1),
                recurring_days=item.get("recurring_days"),
                recurring_day_of_month=item.get("recurring_day_of_month"),
                recurring_start_date=start_date,
                recurring_end_date=item.get("recurring_end_date"),
                parent_recurring_id=None,  # 원본은 None
                completed_at=None,
                created_at=datetime.combine(start_date - timedelta(days=1), time(20, 0)),
                updated_at=datetime.combine(start_date, time(0, 0)),
            )
            recurring_templates.append((template, item))
            todos.append(template)
        
        # 2) WEEKLY 반복 일정 원본 템플릿 생성 (10월의 첫 번째 해당 요일)
        for item in weekday_exercise + weekday_social:
            # 10월의 첫 번째 해당 요일 찾기
            first_weekday_date = None
            for day_offset in range(31):
                check_date = start_date + timedelta(days=day_offset)
                if check_date.weekday() in item.get("recurring_days", []):
                    first_weekday_date = check_date
                    break
            
            if first_weekday_date:
                template_id = str(uuid.uuid4())
                template = Todo(
                    todo_id=template_id,
                    elderly_id=elderly.user_id,
                    creator_id=caregiver.user_id,
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    due_date=first_weekday_date,
                    due_time=item["due_time"],
                    creator_type=CreatorType.CAREGIVER,
                    status=TodoStatus.PENDING,
                    is_confirmed=True,
                    is_recurring=True,
                    recurring_type=item.get("recurring_type"),
                    recurring_interval=item.get("recurring_interval", 1),
                    recurring_days=item.get("recurring_days"),
                    recurring_day_of_month=item.get("recurring_day_of_month"),
                    recurring_start_date=start_date,
                    recurring_end_date=item.get("recurring_end_date"),
                    parent_recurring_id=None,
                    completed_at=None,
                    created_at=datetime.combine(first_weekday_date - timedelta(days=1), time(20, 0)),
                    updated_at=datetime.combine(first_weekday_date, time(0, 0)),
                )
                recurring_templates.append((template, item))
                todos.append(template)
        
        # 2025년 10월 1일 ~ 10월 31일 데이터 생성
        for day_offset in range(31):  # 10월 1일 ~ 31일
            target_date = start_date + timedelta(days=day_offset)
            is_past = target_date < today  # 과거 날짜인지 확인 (미래 날짜 테스트 가능)
            weekday = target_date.weekday()  # 0=월요일, 6=일요일
            is_weekend = weekday in [5, 6]  # 토일
            is_health_decline = target_date.day in health_decline_days
            
            # 건강 악화 기간 완료율 조정
            health_factor = 0.5 if is_health_decline else 1.0
            
            # 1) 매일 반복 일정 - 과거 날짜의 개별 TODO 생성
            for item in daily_schedule:
                # 템플릿 ID 찾기
                template_id = None
                for template, template_item in recurring_templates:
                    if (template_item["title"] == item["title"] and 
                        template_item["category"] == item["category"]):
                        template_id = template.todo_id
                        break
                
                completion_rate = item["completion_rate"] * health_factor
                due_time = item["due_time"]
                if is_weekend and item["category"] == TodoCategory.MEAL:
                    due_time = time((due_time.hour + 1) % 24, due_time.minute)
                
                if is_past:
                    rand = random.random()
                    if rand < completion_rate:
                        status = TodoStatus.COMPLETED
                        completed_hour = due_time.hour + random.randint(0, 1)
                        completed_at = datetime.combine(
                            target_date,
                            time(min(completed_hour, 23), random.randint(0, 59))
                        )
                    elif rand < completion_rate + 0.05:
                        status = TodoStatus.CANCELLED
                        completed_at = None
                    else:
                        status = TodoStatus.PENDING
                        completed_at = None
                else:
                    # 미래 날짜는 PENDING 상태로 생성 (테스트용)
                    status = TodoStatus.PENDING
                    completed_at = None
                
                todos.append(Todo(
                    todo_id=str(uuid.uuid4()),
                    elderly_id=elderly.user_id,
                    creator_id=caregiver.user_id,
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    due_date=target_date,
                    due_time=due_time,
                    creator_type=CreatorType.CAREGIVER,
                    status=status,
                    is_confirmed=True,
                    is_recurring=False,  # 생성된 TODO는 반복 아님
                    recurring_type=None,
                    recurring_interval=1,
                    recurring_days=None,
                    recurring_day_of_month=None,
                    recurring_start_date=None,
                    recurring_end_date=None,
                    parent_recurring_id=template_id,  # 원본 템플릿 ID 연결
                    completed_at=completed_at,
                    created_at=datetime.combine(target_date - timedelta(days=1), time(20, 0)),
                    updated_at=datetime.combine(target_date, time(0, 0)),
                ))
            
            # 2) 평일 운동 (월수금) - 과거 날짜의 개별 TODO 생성
            if not is_weekend:
                for item in weekday_exercise:
                    if weekday in item.get("recurring_days", []):
                        # 템플릿 ID 찾기
                        template_id = None
                        for template, template_item in recurring_templates:
                            if (template_item["title"] == item["title"] and 
                                template_item["category"] == item["category"]):
                                template_id = template.todo_id
                                break
                        
                        completion_rate = item["completion_rate"] * health_factor
                        
                        if is_past:
                            rand = random.random()
                            if rand < completion_rate:
                                status = TodoStatus.COMPLETED
                                completed_hour = item["due_time"].hour + random.randint(0, 2)
                                completed_at = datetime.combine(
                                    target_date,
                                    time(min(completed_hour, 23), random.randint(0, 59))
                                )
                            elif rand < completion_rate + 0.10:
                                status = TodoStatus.CANCELLED
                                completed_at = None
                            else:
                                status = TodoStatus.PENDING
                                completed_at = None
                        else:
                            # 미래 날짜는 PENDING 상태로 생성
                            status = TodoStatus.PENDING
                            completed_at = None
                        
                        todos.append(Todo(
                            todo_id=str(uuid.uuid4()),
                            elderly_id=elderly.user_id,
                            creator_id=caregiver.user_id,
                            title=item["title"],
                            description=item["description"],
                            category=item["category"],
                            due_date=target_date,
                            due_time=item["due_time"],
                            creator_type=CreatorType.CAREGIVER,
                            status=status,
                            is_confirmed=True,
                            is_recurring=False,
                            recurring_type=None,
                            recurring_interval=1,
                            recurring_days=None,
                            recurring_day_of_month=None,
                            recurring_start_date=None,
                            recurring_end_date=None,
                            parent_recurring_id=template_id,
                            completed_at=completed_at,
                            created_at=datetime.combine(target_date - timedelta(days=1), time(20, 0)),
                            updated_at=datetime.combine(target_date, time(0, 0)),
                        ))
            
            # 3) 평일 사회활동 (화목) - 과거 날짜의 개별 TODO 생성
            if not is_weekend:
                for item in weekday_social:
                    if weekday in item.get("recurring_days", []):
                        # 템플릿 ID 찾기
                        template_id = None
                        for template, template_item in recurring_templates:
                            if (template_item["title"] == item["title"] and 
                                template_item["category"] == item["category"]):
                                template_id = template.todo_id
                                break
                        
                        completion_rate = item["completion_rate"]
                        
                        if is_past:
                            rand = random.random()
                            if rand < completion_rate:
                                status = TodoStatus.COMPLETED
                                completed_at = datetime.combine(
                                    target_date,
                                    time(item["due_time"].hour + random.randint(0, 1), random.randint(0, 59))
                                )
                            else:
                                status = TodoStatus.PENDING
                                completed_at = None
                        else:
                            # 미래 날짜는 PENDING 상태로 생성
                            status = TodoStatus.PENDING
                            completed_at = None
                        
                        todos.append(Todo(
                            todo_id=str(uuid.uuid4()),
                            elderly_id=elderly.user_id,
                            creator_id=caregiver.user_id,
                            title=item["title"],
                            description=item["description"],
                            category=item["category"],
                            due_date=target_date,
                            due_time=item["due_time"],
                            creator_type=CreatorType.CAREGIVER,
                            status=status,
                            is_confirmed=True,
                            is_recurring=False,
                            recurring_type=None,
                            recurring_interval=1,
                            recurring_days=None,
                            recurring_day_of_month=None,
                            recurring_start_date=None,
                            recurring_end_date=None,
                            parent_recurring_id=template_id,
                            completed_at=completed_at,
                            created_at=datetime.combine(target_date - timedelta(days=1), time(20, 0)),
                            updated_at=datetime.combine(target_date, time(0, 0)),
                        ))
            
            # 4) 주말 활동 (50% 확률)
            if is_weekend and random.random() < 0.50:
                item = random.choice(weekend_activities)
                completion_rate = item["completion_rate"]
                
                if is_past:
                    rand = random.random()
                    if rand < completion_rate:
                        status = TodoStatus.COMPLETED
                        completed_at = datetime.combine(
                            target_date,
                            time(item["due_time"].hour + random.randint(0, 2), random.randint(0, 59))
                        )
                    else:
                        status = TodoStatus.PENDING
                        completed_at = None
                else:
                    # 미래 날짜는 PENDING 상태로 생성
                    status = TodoStatus.PENDING
                    completed_at = None
                
                todos.append(Todo(
                    todo_id=str(uuid.uuid4()),
                    elderly_id=elderly.user_id,
                    creator_id=caregiver.user_id,
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    due_date=target_date,
                    due_time=item["due_time"],
                    creator_type=CreatorType.CAREGIVER,
                    status=status,
                    is_confirmed=True,
                    is_recurring=False,
                    recurring_type=None,
                    recurring_interval=1,
                    recurring_days=None,
                    recurring_day_of_month=None,
                    recurring_start_date=None,
                    recurring_end_date=None,
                    parent_recurring_id=None,
                    completed_at=completed_at,
                    created_at=datetime.combine(target_date - timedelta(days=2), time(10, 0)),
                    updated_at=datetime.combine(target_date, time(0, 0)),
                ))
            
            # 5) 평일 오후 활동 (20% 확률, 데이터 보강)
            if not is_weekend and random.random() < 0.20:
                item = random.choice(afternoon_activities)
                completion_rate = item["completion_rate"] * health_factor
                
                if is_past:
                    rand = random.random()
                    if rand < completion_rate:
                        status = TodoStatus.COMPLETED
                        completed_at = datetime.combine(
                            target_date,
                            time(item["due_time"].hour + random.randint(0, 1), random.randint(0, 59))
                        )
                    else:
                        status = TodoStatus.PENDING
                        completed_at = None
                else:
                    # 미래 날짜는 PENDING 상태로 생성
                    status = TodoStatus.PENDING
                    completed_at = None
                
                todos.append(Todo(
                    todo_id=str(uuid.uuid4()),
                    elderly_id=elderly.user_id,
                    creator_id=caregiver.user_id,
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    due_date=target_date,
                    due_time=item["due_time"],
                    creator_type=CreatorType.CAREGIVER,
                    status=status,
                    is_confirmed=True,
                    is_recurring=False,
                    recurring_type=None,
                    recurring_interval=1,
                    recurring_days=None,
                    recurring_day_of_month=None,
                    recurring_start_date=None,
                    recurring_end_date=None,
                    parent_recurring_id=None,
                    completed_at=completed_at,
                    created_at=datetime.combine(target_date - timedelta(days=1), time(15, 0)),
                    updated_at=datetime.combine(target_date, time(0, 0)),
                ))
            
            # 6) 병원 일정 (10월 7일, 21일)
            if target_date.day in hospital_dates:
                item = random.choice(hospital_visits)
                completion_rate = item["completion_rate"]
                
                if is_past:
                    rand = random.random()
                    if rand < completion_rate:
                        status = TodoStatus.COMPLETED
                        completed_at = datetime.combine(
                            target_date,
                            time(item["due_time"].hour + random.randint(0, 1), random.randint(0, 59))
                        )
                    else:
                        status = TodoStatus.PENDING
                        completed_at = None
                else:
                    # 미래 날짜는 PENDING 상태로 생성
                    status = TodoStatus.PENDING
                    completed_at = None
                
                todos.append(Todo(
                    todo_id=str(uuid.uuid4()),
                    elderly_id=elderly.user_id,
                    creator_id=caregiver.user_id,
                    title=item["title"],
                    description=item["description"],
                    category=item["category"],
                    due_date=target_date,
                    due_time=item["due_time"],
                    creator_type=CreatorType.CAREGIVER,
                    status=status,
                    is_confirmed=True,
                    is_recurring=False,
                    recurring_type=None,
                    recurring_interval=1,
                    recurring_days=None,
                    recurring_day_of_month=None,
                    recurring_start_date=None,
                    recurring_end_date=None,
                    parent_recurring_id=None,
                    completed_at=completed_at,
                    created_at=datetime.combine(target_date - timedelta(days=7), time(9, 0)),
                    updated_at=datetime.combine(target_date, time(0, 0)),
                ))
        
        db.add_all(todos)
        db.commit()
        
        # 통계 출력
        total = len(todos)
        completed = sum(1 for t in todos if t.status == TodoStatus.COMPLETED)
        pending = sum(1 for t in todos if t.status == TodoStatus.PENDING)
        cancelled = sum(1 for t in todos if t.status == TodoStatus.CANCELLED)
        
        # 카테고리별 통계
        category_stats = {}
        for category in TodoCategory:
            count = sum(1 for t in todos if t.category == category)
            category_stats[category.value] = count
        
        # 반복 일정 통계
        recurring_count = sum(1 for t in todos if t.is_recurring)
        daily_count = sum(1 for t in todos if t.recurring_type == RecurringType.DAILY)
        weekly_count = sum(1 for t in todos if t.recurring_type == RecurringType.WEEKLY)
        one_time_count = sum(1 for t in todos if not t.is_recurring)
        
        # 요일별 통계
        weekend_count = sum(1 for t in todos if t.due_date.weekday() in [5, 6])
        weekday_count = total - weekend_count
        
        print("\n" + "="*70)
        print("✅ 2025년 10월 TODO 데이터 생성 완료!")
        print("="*70)
        print(f"\n📊 전체 통계 (10월 1일 ~ 10월 31일)")
        print(f"   총 {total}개의 할일 생성")
        print(f"   - 어르신: {elderly.name} ({elderly.email})")
        print(f"   - 보호자: {caregiver.name} ({caregiver.email})")
        
        print(f"\n📈 상태별 분포")
        print(f"   - ✅ 완료: {completed}개 ({completed/total*100:.1f}%)")
        print(f"   - ⏳ 대기: {pending}개 ({pending/total*100:.1f}%)")
        print(f"   - ❌ 취소: {cancelled}개 ({cancelled/total*100:.1f}%)")
        
        print(f"\n🏷️  카테고리별 분포")
        for cat_name, count in category_stats.items():
            if count > 0:
                emoji = {
                    "MEDICINE": "💊",
                    "EXERCISE": "🏃",
                    "MEAL": "🍚",
                    "HOSPITAL": "🏥",
                    "OTHER": "📝"
                }.get(cat_name, "")
                print(f"   - {emoji} {cat_name}: {count}개 ({count/total*100:.1f}%)")
        
        print(f"\n🔄 반복 일정 통계")
        print(f"   - 반복 일정 템플릿: {recurring_count}개")
        print(f"     └ 매일: {daily_count}개")
        print(f"     └ 주간: {weekly_count}개")
        print(f"   - 생성된 개별 TODO: {one_time_count}개")
        
        print(f"\n📅 요일별 분포")
        print(f"   - 평일: {weekday_count}개 ({weekday_count/total*100:.1f}%)")
        print(f"   - 주말: {weekend_count}개 ({weekend_count/total*100:.1f}%)")
        
        print(f"\n📊 보호자 통계용 데이터 특성")
        print(f"   ✓ 10월 한 달치 완료/미완료 데이터")
        print(f"   ✓ 요일별 패턴 (평일 vs 주말)")
        print(f"   ✓ 카테고리별 완료율 차이")
        print(f"   ✓ 건강 악화 패턴 (10/15-16일 완료율 50% 감소)")
        print(f"   ✓ 병원 방문 일정 (10/7, 10/21)")
        
        print("\n" + "="*70)
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_todos()

