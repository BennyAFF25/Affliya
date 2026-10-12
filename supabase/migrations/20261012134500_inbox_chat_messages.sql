-- Business/affiliate private conversations. Additive; leaves existing inbox notifications untouched.
CREATE TABLE IF NOT EXISTS public.inbox_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers(id),
  business_user_id uuid NOT NULL REFERENCES auth.users(id),
  affiliate_user_id uuid NOT NULL REFERENCES auth.users(id),
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  client_message_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT chat_sender_participant CHECK (
    sender_user_id = business_user_id OR sender_user_id = affiliate_user_id
  ),
  CONSTRAINT chat_distinct_users CHECK (business_user_id <> affiliate_user_id),
  CONSTRAINT chat_idempotency UNIQUE(sender_user_id, client_message_id)
);
CREATE INDEX IF NOT EXISTS inbox_chat_conversation_idx
  ON public.inbox_chat_messages (offer_id,business_user_id,affiliate_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_chat_business_idx
  ON public.inbox_chat_messages (business_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inbox_chat_affiliate_idx
  ON public.inbox_chat_messages (affiliate_user_id,created_at DESC);

ALTER TABLE public.inbox_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inbox_chat_participants_select ON public.inbox_chat_messages;
CREATE POLICY inbox_chat_participants_select ON public.inbox_chat_messages FOR SELECT TO authenticated
  USING (business_user_id = (SELECT auth.uid()) OR affiliate_user_id = (SELECT auth.uid()));
-- Writes go only through API handlers which verify the offer and approved
-- affiliate relationship. Do not allow direct clients to forge chat identities.
REVOKE ALL ON public.inbox_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.inbox_chat_messages TO authenticated;
GRANT ALL ON public.inbox_chat_messages TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='inbox_chat_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_chat_messages;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
