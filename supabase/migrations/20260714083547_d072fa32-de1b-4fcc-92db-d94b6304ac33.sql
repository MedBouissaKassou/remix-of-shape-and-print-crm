
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.update_user_credentials(target_user_id uuid, new_username text, new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_email TEXT;
BEGIN
  IF new_username IS NOT NULL AND new_username != '' THEN
    v_email := lower(new_username) || '@shapeandprint.local';
    UPDATE auth.users
    SET email = v_email, email_confirmed_at = now()
    WHERE id = target_user_id;
  END IF;
  IF new_password IS NOT NULL AND new_password != '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf'))
    WHERE id = target_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_user(_username text, _password text, _role app_role, _full_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  v_email := lower(_username) || '@shapeandprint.local';
  v_uid := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', COALESCE(_full_name, _username)),
    false,
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email),
    'email', v_uid::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_uid, COALESCE(_full_name, _username), v_email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, _role)
  ON CONFLICT DO NOTHING;

  RETURN v_uid;
END;
$function$;
