BEGIN;
UPDATE public.ad_ideas SET rejected_at = NULL
WHERE id IN ('bee19d13-5e4d-4d91-ae1d-0e5e103b5e16','be494883-29c6-4e24-a748-ce46d8a29710','0237e3ba-949a-464b-b525-9f885dcb98d5');
COMMIT;
