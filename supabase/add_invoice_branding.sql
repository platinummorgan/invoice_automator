-- Add invoice branding fields and logo storage support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS invoice_template TEXT DEFAULT 'classic'
    CHECK (invoice_template IN ('classic', 'painter', 'minimal')),
  ADD COLUMN IF NOT EXISTS template_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.logo_url IS 'Public URL for business logo used in invoice preview/email.';
COMMENT ON COLUMN public.profiles.invoice_template IS 'Selected invoice visual template (classic, painter, minimal).';
COMMENT ON COLUMN public.profiles.template_settings IS 'JSON settings used by the template builder (accent color, layout, visibility toggles, and footer text).';

-- Public bucket for business logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view logo files" ON storage.objects;
CREATE POLICY "Public can view logo files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Users can upload own logos" ON storage.objects;
CREATE POLICY "Users can upload own logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own logos" ON storage.objects;
CREATE POLICY "Users can update own logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own logos" ON storage.objects;
CREATE POLICY "Users can delete own logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
