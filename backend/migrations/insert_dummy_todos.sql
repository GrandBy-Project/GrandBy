-- ====================================
-- TODO 테스트 데이터
-- ====================================

-- 실행 방법:
-- docker exec -i grandby_postgres psql -U grandby -d grandby_db < insert_dummy_todos.sql

-- 기존 테스트 TODO 삭제 (안전하게)
DELETE FROM todos WHERE title IN ('혈압약 복용', '정형외과 진료', '산책하기', 'Blood Pressure Medicine', 'Hospital Visit', 'Walking');

-- 한글 테스트 데이터 삽입
-- elderly_id: 39aa74fd-80f7-434e-baf7-1d09357ee623 (테르신)
-- creator_id: 734b304c-8863-41a5-899b-b548be725fd1 (테호자)

INSERT INTO todos (
    todo_id, elderly_id, creator_id, 
    title, description, category, 
    due_date, due_time, 
    creator_type, status, is_confirmed, is_recurring,
    created_at, updated_at
) VALUES 
-- 1. 혈압약 복용
(
    gen_random_uuid()::text,
    '39aa74fd-80f7-434e-baf7-1d09357ee623',
    '734b304c-8863-41a5-899b-b548be725fd1',
    '혈압약 복용',
    '아침 식사 후 혈압약을 복용하세요',
    'MEDICINE',
    CURRENT_DATE,
    '08:00',
    'CAREGIVER',
    'PENDING',
    true,
    false,
    NOW(),
    NOW()
),
-- 2. 정형외과 진료
(
    gen_random_uuid()::text,
    '39aa74fd-80f7-434e-baf7-1d09357ee623',
    '734b304c-8863-41a5-899b-b548be725fd1',
    '정형외과 진료',
    '무릎 관절 정기 검진',
    'HOSPITAL',
    CURRENT_DATE,
    '14:00',
    'CAREGIVER',
    'PENDING',
    true,
    false,
    NOW(),
    NOW()
),
-- 3. 산책하기 (완료됨)
(
    gen_random_uuid()::text,
    '39aa74fd-80f7-434e-baf7-1d09357ee623',
    '734b304c-8863-41a5-899b-b548be725fd1',
    '산책하기',
    '공원에서 30분 산책',
    'EXERCISE',
    CURRENT_DATE,
    '16:00',
    'CAREGIVER',
    'COMPLETED',
    true,
    false,
    NOW(),
    NOW()
);

-- 삽입된 데이터 확인
SELECT title, category, due_time, status FROM todos WHERE due_date = CURRENT_DATE ORDER BY due_time;

