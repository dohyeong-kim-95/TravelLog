-- Supabase SQL Editor에서 실행하세요 (기존 schema.sql 이후)

-- 사진 테이블
CREATE TABLE IF NOT EXISTS public.photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  city_code    TEXT        NOT NULL,
  city_name    TEXT        NOT NULL,
  user_slot    INTEGER     NOT NULL CHECK (user_slot IN (1, 2)),
  storage_path TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON public.photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "photos_insert" ON public.photos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "photos_delete" ON public.photos
  FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;

-- =====================================================
-- Storage 버킷 설정 (SQL Editor에서 실행)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('travel-photos', 'travel-photos', true)
ON CONFLICT DO NOTHING;

-- 인증된 사용자만 업로드 가능
CREATE POLICY "auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'travel-photos');

-- 누구나 사진 열람 가능 (공개 버킷)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'travel-photos');

CREATE POLICY "auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'travel-photos');
