DELETE FROM public.devis WHERE storage_path = 'pending' OR storage_path IS NULL;
DELETE FROM public.bons_livraison WHERE storage_path = 'pending' OR storage_path IS NULL;
DELETE FROM public.factures WHERE storage_path = 'pending' OR storage_path IS NULL;