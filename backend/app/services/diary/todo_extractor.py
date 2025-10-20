"""
TODO 자동 추출 서비스
통화 내용에서 할 일을 감지하여 TODO 생성
"""

from app.models.todo import Todo, TodoStatus, TodoPriority
from app.models.user import User
from sqlalchemy.orm import Session
import logging
from typing import Dict, List
from datetime import datetime, date, timedelta
import re

logger = logging.getLogger(__name__)


class TodoExtractor:
    """통화 내용에서 할 일 자동 추출 및 TODO 생성"""
    
    def extract_and_create_todos(
        self,
        structured_data: Dict,
        elderly: User,
        creator: User,
        db: Session
    ) -> List[Dict]:
        """
        구조화된 데이터에서 TODO를 추출하고 DB에 저장
        
        Args:
            structured_data: 통화 분석 결과
            elderly: 어르신 (TODO 담당자)
            creator: TODO 생성자 (AI 또는 보호자)
            db: DB 세션
        
        Returns:
            List[Dict]: 생성된 TODO 정보 리스트 (프론트엔드용)
        """
        try:
            todos_data = structured_data.get('todos', [])
            future_plans = structured_data.get('future_plans', [])
            
            # TODO와 future_plans 통합
            all_potential_todos = []
            
            # 1. 명시적 TODO
            for todo in todos_data:
                all_potential_todos.append({
                    'title': todo.get('title', ''),
                    'description': todo.get('description', ''),
                    'due_date': self._parse_date(todo.get('due_date')),
                    'due_time': todo.get('due_time'),
                    'priority': self._map_priority(todo.get('priority', 'medium')),
                    'category': todo.get('category', '기타'),
                    'source': 'todo'
                })
            
            # 2. future_plans도 TODO로 변환
            for plan in future_plans:
                # 중요도가 높은 것만
                if plan.get('importance') in ['high', 'medium']:
                    all_potential_todos.append({
                        'title': plan.get('event', ''),
                        'description': f"{plan.get('location', '')} {plan.get('time', '')}".strip(),
                        'due_date': self._parse_date(plan.get('date')),
                        'due_time': plan.get('time'),
                        'priority': self._map_priority(plan.get('importance', 'medium')),
                        'category': self._categorize_event(plan.get('event', '')),
                        'source': 'future_plan'
                    })
            
            if not all_potential_todos:
                logger.info("📋 감지된 TODO가 없습니다")
                return []
            
            # 3. TODO 생성 (DB에 저장하지 않고 정보만 반환 - 사용자 확인용)
            suggested_todos = []
            
            for todo_data in all_potential_todos:
                if not todo_data['title']:
                    continue
                
                # TODO 정보 구성
                suggested_todo = {
                    'title': todo_data['title'],
                    'description': todo_data['description'],
                    'due_date': todo_data['due_date'].isoformat() if todo_data['due_date'] else None,
                    'due_time': todo_data['due_time'],
                    'priority': todo_data['priority'],
                    'category': todo_data['category'],
                    'source': todo_data['source'],
                    'elderly_id': elderly.user_id,
                    'elderly_name': elderly.name,
                    'creator_id': creator.user_id
                }
                
                suggested_todos.append(suggested_todo)
                
                logger.info(f"📌 TODO 감지: {todo_data['title']} (기한: {todo_data['due_date']})")
            
            logger.info(f"✅ 총 {len(suggested_todos)}개의 TODO 감지 완료")
            
            return suggested_todos
            
        except Exception as e:
            logger.error(f"❌ TODO 추출 실패: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def create_todos_from_suggestions(
        self,
        suggestions: List[Dict],
        selected_indices: List[int],
        db: Session
    ) -> List[Todo]:
        """
        사용자가 선택한 TODO를 DB에 실제로 생성
        
        Args:
            suggestions: 추천된 TODO 리스트
            selected_indices: 사용자가 선택한 인덱스 리스트
            db: DB 세션
        
        Returns:
            List[Todo]: 생성된 Todo 객체 리스트
        """
        created_todos = []
        
        try:
            for idx in selected_indices:
                if idx >= len(suggestions):
                    continue
                
                suggestion = suggestions[idx]
                
                # Todo 생성
                from app.models.todo import CreatorType
                
                new_todo = Todo(
                    elderly_id=suggestion['elderly_id'],
                    creator_id=suggestion['creator_id'],
                    title=suggestion['title'],
                    description=suggestion['description'],
                    due_date=datetime.fromisoformat(suggestion['due_date']) if suggestion['due_date'] else None,
                    priority=TodoPriority(suggestion['priority']),
                    creator_type=CreatorType.AI,  # AI가 생성한 TODO
                    status=TodoStatus.PENDING,
                    is_recurring=False,
                    created_at=datetime.utcnow()
                )
                
                db.add(new_todo)
                created_todos.append(new_todo)
                
                logger.info(f"✅ TODO 생성: {new_todo.title}")
            
            db.commit()
            
            logger.info(f"📝 총 {len(created_todos)}개의 TODO가 생성되었습니다")
            
            return created_todos
            
        except Exception as e:
            logger.error(f"❌ TODO 생성 실패: {e}")
            db.rollback()
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def _parse_date(self, date_str: str) -> date:
        """
        날짜 문자열을 date 객체로 변환
        "내일", "모레", "YYYY-MM-DD" 등 지원
        """
        if not date_str:
            return None
        
        today = date.today()
        
        # 상대적 날짜
        if '내일' in date_str or 'tomorrow' in date_str.lower():
            return today + timedelta(days=1)
        elif '모레' in date_str:
            return today + timedelta(days=2)
        elif '글피' in date_str:
            return today + timedelta(days=3)
        elif '다음주' in date_str or '다음 주' in date_str:
            return today + timedelta(days=7)
        
        # 요일 파싱 (월요일, 화요일 등)
        weekdays = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일']
        for i, weekday in enumerate(weekdays):
            if weekday in date_str:
                # 다음 해당 요일까지의 일수 계산
                days_ahead = i - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                return today + timedelta(days=days_ahead)
        
        # YYYY-MM-DD 형식
        try:
            # ISO 형식 시도
            return datetime.fromisoformat(date_str).date()
        except:
            pass
        
        # 정규식으로 날짜 추출 시도
        date_pattern = r'(\d{4})-(\d{1,2})-(\d{1,2})'
        match = re.search(date_pattern, date_str)
        if match:
            year, month, day = match.groups()
            return date(int(year), int(month), int(day))
        
        # 파싱 실패 시 1주일 후로 설정
        logger.warning(f"⚠️ 날짜 파싱 실패: {date_str}, 1주일 후로 설정")
        return today + timedelta(days=7)
    
    def _map_priority(self, priority_str: str) -> str:
        """우선순위 문자열을 TodoPriority enum으로 매핑"""
        priority_map = {
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
            '높음': 'high',
            '중간': 'medium',
            '낮음': 'low'
        }
        return priority_map.get(priority_str.lower(), 'medium')
    
    def _categorize_event(self, event: str) -> str:
        """일정 내용으로 카테고리 자동 분류"""
        event_lower = event.lower()
        
        if any(word in event_lower for word in ['병원', '진료', '의사', '검진', '약']):
            return '건강'
        elif any(word in event_lower for word in ['식사', '밥', '점심', '저녁', '아침']):
            return '식사'
        elif any(word in event_lower for word in ['외출', '나가', '방문', '가기']):
            return '외출'
        elif any(word in event_lower for word in ['만남', '약속', '모임', '친구', '가족']):
            return '약속'
        else:
            return '기타'

