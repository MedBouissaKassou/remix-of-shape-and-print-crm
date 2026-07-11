-- Seed initial users directly in auth.users so login no longer needs the service role key.
-- Idempotent: skips users that already exist.

DO $$
DECLARE
  seed RECORD;
  new_user_id UUID;
BEGIN
  FOR seed IN
    SELECT * FROM (VALUES
      ('malekayari', 'shapeandprint!!!', 'Malek Ayari',              'super_admin'::public.app_role),
      ('marketing',  '123456',           'Département Marketing',    'marketing'::public.app_role),
      ('design',     '123456',           'Département Design',       'design'::public.app_role),
      ('production', '123456',           'Département Production',   'production'::public.app_role),
      ('livraison',  '123456',           'Département Livraison',    'livraison'::public.app_role)
    ) AS t(username, password, full_name, role)
  LOOP
    -- Skip if user with this email already exists
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = seed.username || '@shapeandprint.local';

    IF new_user_id IS NULL THEN
      new_user_id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        seed.username || '@shapeandprint.local',
        crypt(seed.password, gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('full_name', seed.full_name, 'username', seed.username),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        new_user_id,
        jsonb_build_object('sub', new_user_id::text, 'email', seed.username || '@shapeandprint.local'),
        'email',
        new_user_id::text,
        now(), now(), now()
      );
    END IF;

    -- Ensure profile exists
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (new_user_id, seed.full_name, seed.username || '@shapeandprint.local')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

    -- Ensure role exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, seed.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;