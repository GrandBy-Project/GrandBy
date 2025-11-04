"""
테스트 일기 시드 데이터 생성
- 10월 1일부터 10월 31일까지 일기 생성
- 하루에 하나씩만 생성
- title 필수, content 필수, mood 랜덤
- 작성자 타입은 어르신 고정
- haru-character.png 이미지를 20% 확률로 첨부
"""
import sys
import random
import shutil
import uuid
from pathlib import Path
from datetime import date, datetime

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.diary import Diary, DiaryComment, DiaryPhoto, AuthorType, DiaryStatus
from app.config import settings


def seed_diaries():
    """테스트 일기 생성 (10월 1일 ~ 10월 31일)"""
    db = SessionLocal()
    try:
        # 어르신과 보호자 찾기
        elderly = db.query(User).filter(User.role == UserRole.ELDERLY).first()
        caregiver = db.query(User).filter(User.role == UserRole.CAREGIVER).first()
        
        if not elderly:
            print("⚠️  사용자 데이터를 먼저 생성해주세요. (seed_users.py)")
            return
        
        if not caregiver:
            print("⚠️  보호자 사용자가 없습니다. 댓글은 보호자가 없는 경우 생성되지 않습니다.")
        
        # haru-character.png 이미지 경로 확인 (scripts 폴더 내)
        script_dir = Path(__file__).parent  # backend/scripts
        haru_image_path = script_dir / "haru-character.png"
        
        if not haru_image_path.exists():
            print("⚠️  haru-character.png 파일을 찾을 수 없습니다. 이미지 경로: backend/scripts/haru-character.png")
            print("   이미지 첨부는 건너뜁니다.")
            haru_image_path = None
        
        # 기존 일기 개수 확인 (삭제하지 않음)
        existing_count = db.query(Diary).filter(Diary.user_id == elderly.user_id).count()
        if existing_count > 0:
            print(f"ℹ️  기존 일기 {existing_count}개가 있습니다. 새로운 일기를 추가합니다.")
        else:
            print("ℹ️  기존 일기가 없습니다. 새로운 일기를 생성합니다.")
        
        # 일기 이미지 업로드 디렉토리 생성
        upload_dir = Path(settings.UPLOAD_DIR) / "diaries"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 기분 옵션 (DiaryWriteScreen.tsx의 MOOD_OPTIONS)
        mood_options = ['happy', 'excited', 'calm', 'sad', 'angry', 'tired']
        
        # 일기 내용 템플릿 (title, content 포함)
        diary_templates = [
            {
                "title": "오늘의 하루",
                "content": "오늘은 날씨가 정말 좋았어요. 아침에 산책을 나갔는데 공기가 참 맑았습니다. 점심에는 딸이 만들어준 국수를 먹었고, 오후에는 텔레비전을 보며 휴식을 취했습니다.",
            },
            {
                "title": "편안한 하루",
                "content": "오늘은 별 일 없이 평온하게 보냈어요. 아침 복약을 놓치지 않고 잘 했고, 점심 식사도 제때 먹었습니다. 저녁에는 이웃분과 함께 차를 마시며 이야기를 나누었어요.",
            },
            {
                "title": "딸과의 시간",
                "content": "오늘 딸이 찾아와서 같이 점심을 먹었어요. 요즘 일이 바쁘다고 하더라구요. 건강 챙기라고 조언도 해주고, 다음 주에 또 만나기로 했습니다.",
            },
            {
                "title": "복약 일기",
                "content": "오늘 복약을 잘 했는지 확인하고 일기를 쓰고 있어요. 아침 약, 점심 약, 저녁 약 모두 제대로 복용했습니다. 건강 관리가 잘 되고 있는 것 같아 기분이 좋아요.",
            },
            {
                "title": "산책 기록",
                "content": "오늘도 아침 산책을 나갔어요. 날씨가 선선해서 걷기 좋았습니다. 공원에서 다른 어르신들도 만나고 인사 나누었어요. 운동이 건강에 좋다는 걸 느끼고 있습니다.",
            },
            {
                "title": "건강 체크",
                "content": "오늘은 혈압을 재봤는데 정상이에요. 요즘 건강 관리를 잘 하고 있어서 다행입니다. 복약도 꾸준히 하고 있고, 식사도 규칙적으로 하고 있어요.",
            },
            {
                "title": "생각 정리",
                "content": "오늘 하루를 돌아보니 생각이 많아졌어요. 나이가 들면서 시간이 빨리 가는 것 같아요. 그래도 건강하게 하루하루를 보내고 있어서 감사합니다.",
            },
            {
                "title": "TV 시청",
                "content": "오늘은 TV를 보며 시간을 보냈어요. 재미있는 드라마를 봤는데 시간 가는 줄 몰랐습니다. 점심은 간단하게 먹었고, 오후에는 창밖을 보며 쉬었어요.",
            },
            {
                "title": "이웃과의 대화",
                "content": "오늘 이웃 어르신과 함께 차를 마시며 이야기를 나누었어요. 건강 이야기부터 자식 이야기까지 다양한 주제로 대화했습니다. 좋은 시간이었어요.",
            },
            {
                "title": "맛있는 식사",
                "content": "오늘 점심에 딸이 만들어준 비빔밥을 먹었어요. 정말 맛있었습니다. 요즘 식사가 규칙적으로 잘 되고 있어서 건강이 좋아진 것 같아요.",
            },
            {
                "title": "아침 산책",
                "content": "오늘 아침 일찍 일어나서 공원에 산책을 나갔어요. 새벽 공기가 참 맑았고, 새소리도 들렸습니다. 아침 운동 후 기분이 상쾌해졌어요.",
            },
            {
                "title": "오후 낮잠",
                "content": "오늘 오후에는 잠깐 낮잠을 잤어요. 요즘 피곤해서 자주 졸리는 것 같습니다. 낮잠 후에는 컨디션이 좀 나아졌어요.",
            },
            {
                "title": "전화 통화",
                "content": "오늘 아들한테 전화가 왔어요. 요즘 어떻게 지내는지 물어봐주고, 건강은 어떠냐고 걱정해주더라구요. 따뜻한 마음이 전해져서 좋았습니다.",
            },
            {
                "title": "독서 시간",
                "content": "오늘 오후에는 책을 읽으며 시간을 보냈어요. 오랜만에 읽는 소설책이 재미있었습니다. 책을 읽으면 시간이 빨리 가는 것 같아요.",
            },
            {
                "title": "건강 관리",
                "content": "오늘도 건강 관리를 잘 했어요. 복약 시간을 놓치지 않고, 식사도 규칙적으로 했습니다. 운동도 조금씩 하고 있어서 몸이 좋아진 것 같아요.",
            },
            {
                "title": "따뜻한 하루",
                "content": "오늘은 날씨가 따뜻해서 기분이 좋았어요. 창문을 열고 상쾌한 바람을 쐬었습니다. 오후에는 텔레비전을 보며 편하게 쉬었어요.",
            },
            {
                "title": "가족과의 대화",
                "content": "오늘 딸이 찾아와서 오랜만에 이야기를 나누었어요. 요즘 어떻게 지내는지, 건강은 어떠한지 서로 물어보고 걱정해주는 시간이었습니다.",
            },
            {
                "title": "규칙적인 하루",
                "content": "오늘도 규칙적으로 하루를 보냈어요. 아침 복약, 식사, 산책, 점심, 오후 휴식, 저녁 식사까지 모든 일정을 잘 소화했습니다.",
            },
            {
                "title": "평온한 하루",
                "content": "오늘은 특별한 일 없이 평온하게 보냈어요. 아침에 일어나서 복약하고, 식사하고, 쉬는 시간을 가졌습니다. 편안한 하루였어요.",
            },
            {
                "title": "기분 좋은 날",
                "content": "오늘은 기분이 정말 좋은 하루였어요. 날씨도 좋고, 건강도 좋고, 모든 게 순조로웠습니다. 이런 날이 많았으면 좋겠어요.",
            },
            {
                "title": "일상의 기록",
                "content": "오늘 하루를 돌아보니 특별한 일은 없었지만, 평온하고 편안한 하루였어요. 이런 작은 행복들이 모여서 하루를 만드는 것 같습니다.",
            },
            {
                "title": "건강한 하루",
                "content": "오늘도 건강하게 하루를 보냈어요. 복약도 제때 하고, 식사도 규칙적으로 했습니다. 운동도 조금씩 하고 있어서 몸이 좋아진 것 같아요.",
            },
            {
                "title": "따뜻한 마음",
                "content": "오늘은 마음이 따뜻했어요. 누군가 걱정해주고, 건강을 챙겨주는 게 느껴졌습니다. 감사한 마음으로 하루를 마무리했어요.",
            },
            {
                "title": "편안한 오후",
                "content": "오늘 오후에는 창가에 앉아서 햇살을 쬐며 시간을 보냈어요. 따뜻한 햇살이 몸을 감싸면서 편안한 기분이 들었습니다.",
            },
            {
                "title": "소소한 행복",
                "content": "오늘은 작은 행복들을 느낄 수 있었어요. 맛있는 식사, 좋은 날씨, 편안한 휴식. 이런 소소한 것들이 하루를 행복하게 만드는 것 같아요.",
            },
            {
                "title": "건강한 아침",
                "content": "오늘 아침 일찍 일어나서 복약을 하고, 간단한 운동을 했어요. 아침 공기가 상쾌해서 기분이 좋았습니다. 건강한 아침의 시작이었어요.",
            },
            {
                "title": "평범한 하루",
                "content": "오늘은 평범한 하루였어요. 특별한 일은 없었지만, 모든 일정을 잘 소화했고, 건강도 좋았습니다. 이런 평범한 하루가 소중한 것 같아요.",
            },
            {
                "title": "따뜻한 저녁",
                "content": "오늘 저녁에는 따뜻한 국을 먹었어요. 요즘 식사가 규칙적으로 잘 되고 있어서 건강이 좋아진 것 같습니다. 저녁 식사 후에는 편하게 쉬었어요.",
            },
            {
                "title": "편안한 휴식",
                "content": "오늘 오후에는 편안하게 휴식을 취했어요. 책도 읽고, 음악도 들으며 시간을 보냈습니다. 이런 여유로운 시간이 좋아요.",
            },
            {
                "title": "건강 관리 노트",
                "content": "오늘도 건강 관리를 잘 했어요. 복약 시간을 정확히 지키고, 식사도 규칙적으로 했습니다. 운동도 조금씩 하고 있어서 몸이 좋아진 것 같아요.",
            },
            {
                "title": "하루의 마무리",
                "content": "오늘 하루를 돌아보니 건강하게 보냈어요. 모든 일정을 잘 소화했고, 건강도 좋았습니다. 내일도 건강하게 보내면 좋겠어요.",
            },
        ]
        
        # 댓글 템플릿
        comment_templates = [
            "건강하게 잘 지내고 계시는 것 같아서 다행이에요. 복약도 꾸준히 하시고 계시는지 확인해주세요.",
            "좋은 하루 보내셨네요. 건강 관리 잘 하시고 계시는 것 같아서 안심이 됩니다.",
            "일기 잘 읽었어요. 규칙적으로 식사하고 계시는 것 같아서 다행입니다.",
            "오늘도 건강하게 하루를 보내셨군요. 계속 이렇게 잘 지내시길 바라요.",
            "산책 나가시는 거 보니 건강 관리 잘 하고 계시는 것 같아요. 계속 이렇게 하시면 좋겠어요.",
            "따뜻한 마음으로 하루를 보내셨군요. 건강 챙기시고 계속 좋은 일만 있으시길 바라요.",
            "일기 읽어보니 하루를 잘 보내셨네요. 복약 시간도 잘 지키시고 있는 것 같아서 다행입니다.",
            "건강하게 하루하루를 보내시는 모습이 보기 좋아요. 계속 이렇게 잘 지내시길 바라요.",
            "오늘도 규칙적으로 하루를 보내셨네요. 건강 관리 잘 하시고 계시는 것 같아서 안심이 됩니다.",
            "일기 잘 읽었어요. 건강하게 지내시고 계시는 것 같아서 다행입니다.",
            "좋은 하루 보내셨군요. 계속 이렇게 건강하게 지내시길 바라요.",
            "식사도 규칙적으로 하시고 계시는 것 같아서 좋아요. 건강 관리 계속 잘 하시길 바라요.",
            "따뜻한 하루 보내셨네요. 건강 챙기시고 좋은 일만 있으시길 바라요.",
            "일기 읽어보니 하루를 알차게 보내셨네요. 건강 관리도 잘 하고 계시는 것 같아서 다행입니다.",
            "오늘도 건강하게 하루를 보내셨군요. 계속 이렇게 잘 지내시길 바라요.",
        ]
        
        diaries = []
        all_comments = []
        all_photos = []
        # 10월 1일부터 10월 31일까지 (31일)
        october_start = date(2025, 10, 1)
        october_end = date(2025, 10, 31)
        
        current_date = october_start
        day_count = 0
        
        while current_date <= october_end:
            # 해당 날짜에 이미 일기가 있는지 확인 (중복 방지)
            existing_diary = db.query(Diary).filter(
                Diary.user_id == elderly.user_id,
                Diary.date == current_date
            ).first()
            
            if existing_diary:
                print(f"  ⏭️  {current_date} 날짜의 일기가 이미 존재합니다. 건너뜁니다.")
                # 다음 날로 이동
                from datetime import timedelta
                current_date = current_date + timedelta(days=1)
                continue
            
            # 템플릿에서 랜덤 선택
            template = random.choice(diary_templates)
            # 기분 랜덤 선택
            mood = random.choice(mood_options)
            
            diary = Diary(
                user_id=elderly.user_id,
                author_id=elderly.user_id,
                date=current_date,
                title=template["title"],  # 필수
                content=template["content"],  # 필수
                mood=mood,  # 랜덤
                author_type=AuthorType.ELDERLY,  # 어르신 고정
                is_auto_generated=False,
                status=DiaryStatus.PUBLISHED,
            )
            db.add(diary)
            db.flush()  # diary_id를 얻기 위해 flush
            diaries.append(diary)
            
            # 일기 생성 후 일부 일기에 댓글 추가 (60% 확률)
            if caregiver and random.random() < 0.6:
                comment_content = random.choice(comment_templates)
                comment = DiaryComment(
                    diary_id=diary.diary_id,
                    user_id=caregiver.user_id,
                    content=comment_content
                )
                db.add(comment)
                all_comments.append(comment)
            
            # 일기 생성 후 일부 일기에 haru-character.png 이미지 첨부 (40% 확률)
            if haru_image_path and haru_image_path.exists() and random.random() < 0.4:
                try:
                    # 고유 파일명 생성
                    filename = f"{diary.diary_id}_{elderly.user_id}_{uuid.uuid4().hex[:8]}.png"
                    dest_path = upload_dir / filename
                    
                    # 이미지 파일 복사
                    shutil.copy2(haru_image_path, dest_path)
                    
                    # DiaryPhoto 생성
                    photo_url = f"/uploads/diaries/{filename}"
                    photo = DiaryPhoto(
                        diary_id=diary.diary_id,
                        uploaded_by=elderly.user_id,
                        photo_url=photo_url
                    )
                    db.add(photo)
                    all_photos.append(photo)
                except Exception as e:
                    print(f"⚠️  이미지 첨부 실패 (일기 {diary.diary_id}): {e}")
            
            day_count += 1
            # 다음 날로 이동
            from datetime import timedelta
            current_date = current_date + timedelta(days=1)
        
        db.commit()
        
        print(f"\n✅ 총 {len(diaries)}개의 일기가 생성되었습니다!")
        print(f"   - 날짜 범위: {october_start} ~ {october_end}")
        print(f"   - 어르신: {elderly.name} ({elderly.email})")
        print(f"   - 작성자 타입: 어르신 고정")
        
        # 기분별 통계
        mood_counts = {}
        for mood_val in mood_options:
            mood_counts[mood_val] = sum(1 for d in diaries if d.mood == mood_val)
        
        print(f"\n📊 기분별 통계:")
        for mood_val, count in mood_counts.items():
            print(f"   - {mood_val}: {count}개")
        
        # 댓글 통계
        if caregiver:
            print(f"\n💬 댓글 통계:")
            print(f"   - 총 댓글 수: {len(all_comments)}개")
            if all_comments:
                print(f"   - 댓글 작성자: {caregiver.name} ({caregiver.email})")
        else:
            print(f"\n💬 댓글: 보호자가 없어서 댓글이 생성되지 않았습니다.")
        
        # 사진 통계
        print(f"\n📸 사진 통계:")
        print(f"   - 총 사진 수: {len(all_photos)}개")
        if haru_image_path and haru_image_path.exists():
            print(f"   - 이미지 파일: haru-character.png")
        else:
            print(f"   - 이미지 파일: 없음 (haru-character.png를 찾을 수 없음)")
        
    except Exception as e:
        print(f"❌ 일기 생성 오류: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_diaries()