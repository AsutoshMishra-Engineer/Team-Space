-- Create tables
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_idea text,
  team_code text UNIQUE DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('leader', 'member')),
  status text NOT NULL CHECK (status IN ('pending', 'active')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  posted_by uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  deadline date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.team_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_announcements_team ON public.announcements(team_id, created_at DESC);
CREATE INDEX idx_chat_messages_team ON public.chat_messages(team_id, created_at ASC);
CREATE INDEX idx_team_files_team ON public.team_files(team_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- Security Definer Helper Functions
CREATE OR REPLACE FUNCTION public.is_team_member(check_team_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_leader(check_team_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = check_team_id AND user_id = auth.uid() AND role = 'leader' AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- profiles
CREATE POLICY "authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users can update own profile OR admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_app_admin());
CREATE POLICY "allow insert for service role triggers only" ON public.profiles FOR INSERT WITH CHECK (false);

-- teams
CREATE POLICY "team members or admin can view" ON public.teams FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.team_members WHERE team_id = id AND user_id = auth.uid())
  OR created_by = auth.uid()
  OR public.is_app_admin()
);
CREATE POLICY "authenticated users can create team" ON public.teams FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "leader or admin can update" ON public.teams FOR UPDATE TO authenticated USING (public.is_team_leader(id) OR public.is_app_admin());
CREATE POLICY "leader or admin can delete" ON public.teams FOR DELETE TO authenticated USING (public.is_team_leader(id) OR public.is_app_admin());

-- team_members
CREATE POLICY "select team members" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(team_id) OR user_id = auth.uid() OR public.is_app_admin());
CREATE POLICY "insert team members" ON public.team_members FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid() AND role = 'leader' AND status = 'active') OR public.is_team_leader(team_id) OR public.is_app_admin());
CREATE POLICY "update team members" ON public.team_members FOR UPDATE TO authenticated USING (public.is_team_leader(team_id) OR (user_id = auth.uid() AND status = 'pending') OR public.is_app_admin());
CREATE POLICY "delete team members" ON public.team_members FOR DELETE TO authenticated USING (public.is_team_leader(team_id) OR (user_id = auth.uid() AND role != 'leader') OR public.is_app_admin());

-- announcements
CREATE POLICY "select announcements" ON public.announcements FOR SELECT TO authenticated USING (public.is_team_member(team_id) OR public.is_app_admin());
CREATE POLICY "insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_team_leader(team_id) AND posted_by = auth.uid());
CREATE POLICY "delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.is_team_leader(team_id) OR public.is_app_admin());

-- chat_messages
CREATE POLICY "select chat_messages" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_team_member(team_id) OR public.is_app_admin());
CREATE POLICY "insert chat_messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id) AND sender_id = auth.uid());
CREATE POLICY "delete chat_messages" ON public.chat_messages FOR DELETE TO authenticated USING (public.is_app_admin());

-- team_files
CREATE POLICY "select team_files" ON public.team_files FOR SELECT TO authenticated USING (public.is_team_member(team_id) OR public.is_app_admin());
CREATE POLICY "insert team_files" ON public.team_files FOR INSERT TO authenticated WITH CHECK (public.is_team_member(team_id) AND uploaded_by = auth.uid());
CREATE POLICY "delete team_files" ON public.team_files FOR DELETE TO authenticated USING ((uploaded_by = auth.uid() AND public.is_team_member(team_id)) OR public.is_team_leader(team_id) OR public.is_app_admin());

-- Storage Bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('team-files', 'team-files', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS on storage.objects
CREATE POLICY "select storage objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'team-files' AND (public.is_team_member((storage.foldername(name))[1]::uuid) OR public.is_app_admin()));
CREATE POLICY "insert storage objects" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-files' AND public.is_team_member((storage.foldername(name))[1]::uuid));
CREATE POLICY "delete storage objects" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'team-files' AND ((owner = auth.uid() AND public.is_team_member((storage.foldername(name))[1]::uuid)) OR public.is_team_leader((storage.foldername(name))[1]::uuid) OR public.is_app_admin()));

-- Trigger: Auto-generate User ID on email verification
CREATE OR REPLACE FUNCTION public.handle_new_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id text;
  id_exists boolean;
  letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
     OR (TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NOT NULL) THEN
    LOOP
      new_user_id := lpad(floor(random() * 1000)::text, 3, '0')
        || substr(letters, floor(random() * 26 + 1)::int, 1)
        || substr(letters, floor(random() * 26 + 1)::int, 1)
        || lpad(floor(random() * 100)::text, 2, '0');
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = new_user_id) INTO id_exists;
      EXIT WHEN NOT id_exists;
    END LOOP;
    INSERT INTO public.profiles (id, user_id, email, created_at, updated_at)
    VALUES (NEW.id, new_user_id, NEW.email, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      user_id = COALESCE(profiles.user_id, new_user_id),
      email = NEW.email,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_verified();

-- Trigger: Auto-generate Team Code
CREATE OR REPLACE FUNCTION public.generate_team_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
  letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
BEGIN
  IF NEW.team_code IS NULL OR NEW.team_code = '' THEN
    LOOP
      new_code := lpad(floor(random() * 1000)::text, 3, '0')
        || substr(letters, floor(random() * 26 + 1)::int, 1)
        || substr(letters, floor(random() * 26 + 1)::int, 1);
      SELECT EXISTS(SELECT 1 FROM public.teams WHERE team_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.team_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_team_insert_code
  BEFORE INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.generate_team_code();
