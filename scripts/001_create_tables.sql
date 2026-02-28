-- Profiles table for user metadata
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Tours table: stores the full tour JSON plus metadata
CREATE TABLE IF NOT EXISTS public.tours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Tour',
  description TEXT DEFAULT '',
  tour_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  scene_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;

-- Users can see their own tours
CREATE POLICY "tours_select_own" ON public.tours FOR SELECT USING (auth.uid() = user_id);
-- Anyone can see public tours (for sharing)
CREATE POLICY "tours_select_public" ON public.tours FOR SELECT USING (is_public = true);
-- Users can insert their own tours
CREATE POLICY "tours_insert_own" ON public.tours FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can update their own tours
CREATE POLICY "tours_update_own" ON public.tours FOR UPDATE USING (auth.uid() = user_id);
-- Users can delete their own tours
CREATE POLICY "tours_delete_own" ON public.tours FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tours_user_id ON public.tours(user_id);
CREATE INDEX IF NOT EXISTS idx_tours_is_public ON public.tours(is_public);
