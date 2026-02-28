-- Create a public storage bucket for tour images (panoramas + hotspot images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-images',
  'tour-images',
  true,
  52428800, -- 50MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "users_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own files
CREATE POLICY "users_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "users_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read (public bucket for sharing tours)
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'tour-images');
