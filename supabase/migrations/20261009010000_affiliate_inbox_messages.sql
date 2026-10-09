-- Inbox persistence; emails are private backend identity keys.
CREATE TABLE IF NOT EXISTS public.inbox_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_email text NOT NULL,
 sender_role text NOT NULL CHECK(sender_role IN ('affiliate','business','admin','system')),
 sender_name text,
 recipient_email text NOT NULL,
 recipient_role text NOT NULL CHECK(recipient_role IN ('affiliate','business','admin')),
 message_type text NOT NULL CHECK(message_type IN ('message','launch_invite','question','system_nudge')),
 title text NOT NULL CHECK(length(btrim(title)) > 0),
 body text NOT NULL CHECK(length(btrim(body)) > 0),
 preview text,
 offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
 campaign_id uuid,
 affiliate_request_id uuid REFERENCES public.affiliate_requests(id) ON DELETE SET NULL,
 cta_label text, cta_url text,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 read_at timestamptz, archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inbox_messages_recipient_created_idx ON public.inbox_messages(recipient_email,recipient_role,created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_messages_sender_created_idx ON public.inbox_messages(sender_email,created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_messages_offer_idx ON public.inbox_messages(offer_id) WHERE offer_id IS NOT NULL;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inbox_participant_select ON public.inbox_messages;
CREATE POLICY inbox_participant_select ON public.inbox_messages FOR SELECT TO authenticated
 USING(recipient_email=auth.email() OR sender_email=auth.email());
DROP POLICY IF EXISTS inbox_sender_insert ON public.inbox_messages;
CREATE POLICY inbox_sender_insert ON public.inbox_messages FOR INSERT TO authenticated WITH CHECK(
 sender_email=auth.email() AND sender_role IN ('affiliate','business')
 AND read_at IS NULL AND archived_at IS NULL
 AND EXISTS(
   SELECT 1 FROM public.affiliate_requests r JOIN public.offers o ON o.id=r.offer_id AND o.business_email=r.business_email
   WHERE (inbox_messages.offer_id IS NULL OR r.offer_id=inbox_messages.offer_id)
   AND (inbox_messages.affiliate_request_id IS NULL OR r.id=inbox_messages.affiliate_request_id)
   AND ((inbox_messages.sender_role='business' AND inbox_messages.recipient_role='affiliate'
         AND r.business_email=inbox_messages.sender_email AND r.affiliate_email=inbox_messages.recipient_email)
     OR (inbox_messages.sender_role='affiliate' AND inbox_messages.recipient_role='business'
         AND r.affiliate_email=inbox_messages.sender_email AND r.business_email=inbox_messages.recipient_email))
 ));
DROP POLICY IF EXISTS inbox_recipient_update ON public.inbox_messages;
CREATE POLICY inbox_recipient_update ON public.inbox_messages FOR UPDATE TO authenticated
 USING(recipient_email=auth.email()) WITH CHECK(recipient_email=auth.email());
REVOKE ALL ON public.inbox_messages FROM anon,authenticated;
GRANT SELECT,INSERT ON public.inbox_messages TO authenticated;
GRANT UPDATE(read_at,archived_at) ON public.inbox_messages TO authenticated;
GRANT ALL ON public.inbox_messages TO service_role;
NOTIFY pgrst,'reload schema';
