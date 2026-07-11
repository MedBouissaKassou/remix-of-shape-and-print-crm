CREATE OR REPLACE FUNCTION public.update_user_credentials(
  target_user_id uuid,
  new_username text DEFAULT NULL,
  new_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  normalized_username text;
  new_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Accès refusé : Super Admin requis';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur cible requis';
  END IF;

  IF new_username IS NULL AND new_password IS NULL THEN
    RAISE EXCEPTION 'Aucun changement';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Utilisateur introuvable';
  END IF;

  IF new_username IS NOT NULL THEN
    normalized_username := lower(trim(new_username));

    IF normalized_username !~ '^[a-zA-Z0-9._-]{1,50}$' THEN
      RAISE EXCEPTION 'Login invalide';
    END IF;

    new_email := normalized_username || '@shapeandprint.local';

    IF EXISTS (
      SELECT 1
      FROM auth.users
      WHERE lower(email) = lower(new_email)
        AND id <> target_user_id
    ) THEN
      RAISE EXCEPTION 'Ce login est déjà utilisé';
    END IF;

    UPDATE auth.users
    SET email = new_email,
        email_change = '',
        email_change_confirm_status = 0,
        raw_user_meta_data = jsonb_set(
          coalesce(raw_user_meta_data, '{}'::jsonb),
          '{username}',
          to_jsonb(normalized_username),
          true
        ),
        updated_at = now()
    WHERE id = target_user_id;

    UPDATE auth.identities
    SET identity_data = jsonb_set(
          coalesce(identity_data, '{}'::jsonb),
          '{email}',
          to_jsonb(new_email),
          true
        ),
        updated_at = now()
    WHERE user_id = target_user_id
      AND provider = 'email';

    UPDATE public.profiles
    SET email = new_email,
        updated_at = now()
    WHERE id = target_user_id;
  END IF;

  IF new_password IS NOT NULL THEN
    IF length(new_password) < 6 OR length(new_password) > 200 THEN
      RAISE EXCEPTION 'Mot de passe invalide';
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        recovery_token = '',
        confirmation_token = '',
        updated_at = now()
    WHERE id = target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_credentials(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_credentials(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_user_credentials(uuid, text, text) TO authenticated;