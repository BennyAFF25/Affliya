'use client';

import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { type SupabaseClient } from '@supabase/supabase-js';

// The checked-in Database type is an example, not the application schema.
export const supabase: SupabaseClient = createPagesBrowserClient<any, "public", any>();
