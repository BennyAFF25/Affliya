-- Disposable PostgreSQL only; never run this fixture on production.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claims',true)::jsonb ->> 'email'; $$;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
CREATE TABLE public.business_profiles(id uuid PRIMARY KEY);
CREATE TABLE public.offers(id uuid PRIMARY KEY,business_email text,participation_mode text);
CREATE TABLE public.live_ads(id uuid PRIMARY KEY);
CREATE TABLE public.affiliate_requests(id uuid PRIMARY KEY,offer_id uuid,business_email text,affiliate_email text);
GRANT SELECT ON public.offers,public.affiliate_requests TO authenticated;
ALTER TABLE public.affiliate_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_requests ON public.affiliate_requests FOR SELECT TO authenticated USING(business_email=auth.email() OR affiliate_email=auth.email());
INSERT INTO public.offers VALUES('11111111-1111-4111-8111-111111111111','business@example.test','open');
INSERT INTO public.affiliate_requests VALUES('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','business@example.test','affiliate@example.test');
\i supabase/migrations/20261009010000_affiliate_inbox_messages.sql
\i supabase/migrations/20261009010100_activation_subsidy_storage_compatibility.sql
\i supabase/migrations/20261009010000_affiliate_inbox_messages.sql
\i supabase/migrations/20261009010100_activation_subsidy_storage_compatibility.sql
SET ROLE authenticated;
SET request.jwt.claims='{"email":"business@example.test"}';
INSERT INTO public.inbox_messages(id,sender_email,sender_role,recipient_email,recipient_role,message_type,title,body,offer_id)
VALUES('33333333-3333-4333-8333-333333333333','business@example.test','business','affiliate@example.test','affiliate','launch_invite','Invitation','Create a proposal','11111111-1111-4111-8111-111111111111');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.inbox_messages)<>1 THEN RAISE EXCEPTION 'Sender cannot see insert'; END IF;
 BEGIN UPDATE public.inbox_messages SET body='Tampered'; RAISE EXCEPTION 'Body rewrite allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.inbox_messages(sender_email,sender_role,recipient_email,recipient_role,message_type,title,body) VALUES('business@example.test','system','affiliate@example.test','affiliate','message','Spoof','No');
  RAISE EXCEPTION 'System spoof allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.inbox_messages(sender_email,sender_role,recipient_email,recipient_role,message_type,title,body) VALUES('business@example.test','business','stranger@example.test','affiliate','message','Unrelated','No');
  RAISE EXCEPTION 'Unrelated recipient allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claims='{"email":"affiliate@example.test"}';
UPDATE public.inbox_messages SET read_at=now(),archived_at=now();
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.inbox_messages WHERE read_at IS NOT NULL AND archived_at IS NOT NULL) THEN RAISE EXCEPTION 'Status update failed'; END IF;
 BEGIN UPDATE public.inbox_messages SET recipient_email='stranger@example.test'; RAISE EXCEPTION 'Recipient rewrite allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.inbox_messages(sender_email,sender_role,recipient_email,recipient_role,message_type,title,body) VALUES('business@example.test','business','affiliate@example.test','affiliate','message','Wrong sender','No');
  RAISE EXCEPTION 'Sender spoof allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET request.jwt.claims='{"email":"stranger@example.test"}';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.inbox_messages) THEN RAISE EXCEPTION 'Stranger can read'; END IF;
 UPDATE public.inbox_messages SET read_at=now();
 IF FOUND THEN RAISE EXCEPTION 'Stranger can update'; END IF;
 BEGIN INSERT INTO public.business_activation_subsidies(business_email,subsidy_amount) VALUES('stranger@example.test',100); RAISE EXCEPTION 'Client can issue credits'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.business_activation_subsidies) THEN RAISE EXCEPTION 'Automatic credits created'; END IF; END $$;
SELECT 'Inbox isolation, permitted status updates, spoof/write rejection, replay and empty subsidy storage passed' AS result;
