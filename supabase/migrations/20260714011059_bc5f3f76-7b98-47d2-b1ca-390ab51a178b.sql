ALTER TABLE public.commandes ENABLE TRIGGER USER;
ALTER TABLE public.reminders ENABLE TRIGGER USER;
ALTER TABLE public.commande_items ENABLE TRIGGER USER;
ALTER TABLE public.bons_livraison ENABLE TRIGGER USER;
ALTER TABLE public.factures ENABLE TRIGGER USER;
ALTER TABLE public.devis ENABLE TRIGGER USER;
-- Advance commande number sequence past imported values
SELECT setval('public.commande_number_seq', GREATEST((SELECT COALESCE(MAX(SUBSTRING(number FROM 'CMD-([0-9]+)$')::int), 0) FROM public.commandes), 1));