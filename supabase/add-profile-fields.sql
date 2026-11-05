-- Add new columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles(username);

-- Update the trigger to also save username and avatar from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_user_id text;
  id_exists boolean;
  letters text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  l1 text; l2 text; d1 text; d2 text;
  v_username text;
  v_avatar_url text;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
     OR (TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NOT NULL) THEN

    -- Get username and avatar from signup metadata
    v_username := NEW.raw_user_meta_data->>'username';
    v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

    -- Generate unique User ID
    LOOP
      d1 := lpad(floor(random() * 1000)::text, 3, '0');
      l1 := substr(letters, floor(random() * 26 + 1)::int, 1);
      l2 := substr(letters, floor(random() * 26 + 1)::int, 1);
      d2 := lpad(floor(random() * 100)::text, 2, '0');
      new_user_id := d1 || l1 || l2 || d2;
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = new_user_id) INTO id_exists;
      EXIT WHEN NOT id_exists;
    END LOOP;

    INSERT INTO public.profiles (id, email, user_id, username, avatar_url, created_at, updated_at)
    VALUES (NEW.id, NEW.email, new_user_id, v_username, v_avatar_url, now(), now())
    ON CONFLICT (id) DO UPDATE
    SET user_id    = COALESCE(public.profiles.user_id, new_user_id),
        email      = NEW.email,
        username   = COALESCE(public.profiles.username, v_username),
        avatar_url = COALESCE(public.profiles.avatar_url, v_avatar_url),
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_verified();

-- Update personal settings function to support avatar/username changes
CREATE OR REPLACE FUNCTION public.update_personal_settings(p_theme_color text, p_bg_color text, p_personal_quote text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.profiles 
  SET theme_color    = p_theme_color,
      bg_color       = p_bg_color,
      personal_quote = p_personal_quote, 
      updated_at     = now()
  WHERE id = auth.uid();
END;
$function$;

-- Function to update avatar and username (separate from settings)
CREATE OR REPLACE FUNCTION public.update_profile_info(p_username text, p_avatar_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Check username uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND id != auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Username already taken. Please choose another.');
  END IF;

  UPDATE public.profiles
  SET username   = p_username,
      avatar_url = p_avatar_url,
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_profile_info(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
