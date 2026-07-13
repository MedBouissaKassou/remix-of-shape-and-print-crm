
-- Remove any existing auth users with these emails (cascades to profiles, user_roles)
DELETE FROM auth.users WHERE email IN (
  'malekayari@shapeandprint.local',
  'design@shapeandprint.local',
  'production@shapeandprint.local',
  'livraison@shapeandprint.local',
  'dtf@shapeandprint.local',
  'admin@shapeandprint.local',
  'marketing1@shapeandprint.local',
  'marketing2@shapeandprint.local'
);

-- Insert users with their original UUIDs
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  u.id::uuid, 'authenticated', 'authenticated', u.email,
  extensions.crypt(u.pwd, extensions.gen_salt('bf')),
  now(), u.created_at::timestamptz, now(),
  jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', u.full_name),
  false, '', '', '', '', '', '', '', ''
FROM (VALUES
  ('428a5b63-5e3c-489e-9517-543168b9506d','malekayari@shapeandprint.local','Malek Ayari','Harut07175039','2026-05-23 13:56:50.164576+00'),
  ('200ef51f-e125-4d74-a80b-874cbf1413d2','design@shapeandprint.local','design','Restore2026!','2026-05-23 14:28:03.530013+00'),
  ('17d40b99-ed87-4167-9e34-9b28153b2d09','production@shapeandprint.local','production','Restore2026!','2026-05-23 14:28:03.814187+00'),
  ('ea8a8590-f25c-48f9-8778-f5eab79cad9f','livraison@shapeandprint.local','livraison','Restore2026!','2026-05-23 14:28:04.092315+00'),
  ('87479381-7dd4-44db-9e59-cb4ffc65d9b0','dtf@shapeandprint.local','dtf','Restore2026!','2026-05-23 14:28:04.378584+00'),
  ('014c6236-b2ca-4c0e-87a5-d969b0941255','admin@shapeandprint.local','admin','Restore2026!','2026-05-23 14:28:04.599085+00'),
  ('11748f10-c9ca-4666-9e47-ce29a33cf78d','marketing1@shapeandprint.local','marketing','Restore2026!','2026-05-23 14:28:03.18851+00'),
  ('23eaf361-af42-41bb-aaed-64afa3e17269','marketing2@shapeandprint.local','Marketing 2','Restore2026!','2026-07-09 14:35:23.387476+00')
) AS u(id, email, full_name, pwd, created_at);

-- Insert identities for each
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', u.id::text, now(), now(), now()
FROM auth.users u
WHERE u.email IN (
  'malekayari@shapeandprint.local','design@shapeandprint.local','production@shapeandprint.local',
  'livraison@shapeandprint.local','dtf@shapeandprint.local','admin@shapeandprint.local',
  'marketing1@shapeandprint.local','marketing2@shapeandprint.local'
);

-- Restore profiles
INSERT INTO public.profiles (id, full_name, email) VALUES
  ('428a5b63-5e3c-489e-9517-543168b9506d','Malek Ayari','malekayari@shapeandprint.local'),
  ('200ef51f-e125-4d74-a80b-874cbf1413d2','design','design@shapeandprint.local'),
  ('17d40b99-ed87-4167-9e34-9b28153b2d09','production','production@shapeandprint.local'),
  ('ea8a8590-f25c-48f9-8778-f5eab79cad9f','livraison','livraison@shapeandprint.local'),
  ('87479381-7dd4-44db-9e59-cb4ffc65d9b0','dtf','dtf@shapeandprint.local'),
  ('014c6236-b2ca-4c0e-87a5-d969b0941255','admin','admin@shapeandprint.local'),
  ('11748f10-c9ca-4666-9e47-ce29a33cf78d','marketing','marketing1@shapeandprint.local'),
  ('23eaf361-af42-41bb-aaed-64afa3e17269','Marketing 2','marketing2@shapeandprint.local')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

-- Restore user_roles
INSERT INTO public.user_roles (id, user_id, role) VALUES
  ('b31a9b3e-2633-4466-950f-d280eb6c994b','428a5b63-5e3c-489e-9517-543168b9506d','super_admin'),
  ('c98288c1-a08b-4c0f-b2bd-f97ff841dee2','11748f10-c9ca-4666-9e47-ce29a33cf78d','marketing'),
  ('8e2cf8a2-351c-4fac-aaa9-6b09ec9ad8e2','200ef51f-e125-4d74-a80b-874cbf1413d2','design'),
  ('21c07344-a180-4228-81be-e6dbdb1118e2','17d40b99-ed87-4167-9e34-9b28153b2d09','production'),
  ('130277da-9d18-458c-bc53-5893726a5bba','ea8a8590-f25c-48f9-8778-f5eab79cad9f','livraison'),
  ('02c10390-5fce-4e8b-893e-61591c435256','87479381-7dd4-44db-9e59-cb4ffc65d9b0','dtf'),
  ('4161a291-18b9-4018-b685-1867788fdf10','014c6236-b2ca-4c0e-87a5-d969b0941255','admin'),
  ('f07a2830-f215-46df-a0fa-113e6e74fa86','23eaf361-af42-41bb-aaed-64afa3e17269','marketing')
ON CONFLICT (id) DO NOTHING;
