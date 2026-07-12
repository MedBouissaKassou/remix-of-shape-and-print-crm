REVOKE ALL ON FUNCTION public.set_commande_status(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.set_commande_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commande_status(uuid, text) TO service_role;
NOTIFY pgrst, 'reload schema';