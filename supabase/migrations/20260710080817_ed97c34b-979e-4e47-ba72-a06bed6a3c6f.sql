UPDATE auth.users
SET
  encrypted_password = extensions.crypt('marketings1', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  raw_app_meta_data = jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
  updated_at = now()
WHERE email = 'marketing1@shapeandprint.local';

UPDATE auth.identities i
SET identity_data = jsonb_set(
    jsonb_set(COALESCE(i.identity_data, '{}'::jsonb), '{email}', '"marketing1@shapeandprint.local"'::jsonb, true),
    '{sub}', to_jsonb(i.user_id::text), true
  ),
  provider = 'email',
  provider_id = i.user_id::text,
  updated_at = now()
FROM auth.users u
WHERE i.user_id = u.id
  AND u.email = 'marketing1@shapeandprint.local'
  AND i.provider = 'email';

UPDATE public.profiles p
SET email = 'marketing1@shapeandprint.local', full_name = COALESCE(NULLIF(full_name, ''), 'Marketing 1')
FROM auth.users u
WHERE p.id = u.id AND u.email = 'marketing1@shapeandprint.local';

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('marketings2', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  raw_app_meta_data = jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
  updated_at = now()
WHERE email = 'marketing2@shapeandprint.local';

UPDATE auth.identities i
SET identity_data = jsonb_set(
    jsonb_set(COALESCE(i.identity_data, '{}'::jsonb), '{email}', '"marketing2@shapeandprint.local"'::jsonb, true),
    '{sub}', to_jsonb(i.user_id::text), true
  ),
  provider = 'email',
  provider_id = i.user_id::text,
  updated_at = now()
FROM auth.users u
WHERE i.user_id = u.id
  AND u.email = 'marketing2@shapeandprint.local'
  AND i.provider = 'email';

UPDATE public.profiles p
SET email = 'marketing2@shapeandprint.local', full_name = COALESCE(NULLIF(full_name, ''), 'Marketing 2')
FROM auth.users u
WHERE p.id = u.id AND u.email = 'marketing2@shapeandprint.local';