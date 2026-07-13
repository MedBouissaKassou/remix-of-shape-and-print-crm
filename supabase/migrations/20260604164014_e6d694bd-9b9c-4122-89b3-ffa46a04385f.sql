
-- Create a trigger that delivers each new reminder to the matching users as notifications
CREATE OR REPLACE FUNCTION public.notify_users_on_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cmd_number text;
  v_link text;
BEGIN
  SELECT number INTO v_cmd_number FROM public.commandes WHERE id = NEW.commande_id;
  v_link := '/commandes/' || NEW.commande_id::text;

  IF NEW.target_role IS NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT ur.user_id,
           'Rappel commande ' || COALESCE(v_cmd_number, ''),
           NEW.message,
           v_link
    FROM public.user_roles ur
    WHERE ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  ELSE
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT DISTINCT ur.user_id,
           'Rappel commande ' || COALESCE(v_cmd_number, ''),
           NEW.message,
           v_link
    FROM public.user_roles ur
    WHERE ur.role = NEW.target_role
      AND ur.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_users_on_reminder ON public.reminders;
CREATE TRIGGER trg_notify_users_on_reminder
AFTER INSERT ON public.reminders
FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_reminder();

-- Enable realtime for notifications so toasts pop up live
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
