-- =====================================================
-- TravelLog - Supabase 초기 설정 SQL
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- =====================================================

-- 1. visits 테이블 생성
CREATE TABLE IF NOT EXISTS public.visits (
  city_code   TEXT        PRIMARY KEY,
  city_name   TEXT        NOT NULL,
  province    TEXT        NOT NULL,
  user1       BOOLEAN     NOT NULL DEFAULT FALSE,
  user2       BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Row Level Security 활성화
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- 3. RLS 정책: 로그인한 사용자는 읽기/쓰기 가능
CREATE POLICY "authenticated_select" ON public.visits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert" ON public.visits
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update" ON public.visits
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;

-- =====================================================
-- 사용자 생성 방법 (SQL로 직접)
-- =====================================================
-- Supabase 대시보드 > Authentication > Users > Add User 에서
-- 아래와 같이 2명을 생성하세요:
--
-- [사용자 1]
--   Email: user1@travel.local  (예시, 아무 이메일이나 가능)
--   Password: 원하는 비밀번호
--
-- [사용자 2]
--   Email: user2@travel.local
--   Password: 원하는 비밀번호
--
-- 생성 후 아래 SQL로 메타데이터(slot, display_name)를 설정하세요:
-- (실제 user ID는 Authentication > Users에서 확인)

-- UPDATE auth.users
--   SET raw_user_meta_data = '{"slot": 1, "display_name": "나"}'
-- WHERE email = 'user1@travel.local';

-- UPDATE auth.users
--   SET raw_user_meta_data = '{"slot": 2, "display_name": "여친"}'
-- WHERE email = 'user2@travel.local';

-- =====================================================
-- 중요: 신규 가입 차단
-- Supabase 대시보드 > Authentication > Providers > Email
-- "Enable Email Signup" 을 OFF 로 설정하세요.
-- 그래야 2명 외에 다른 사람이 가입하지 못합니다.
-- =====================================================
