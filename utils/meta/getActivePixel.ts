import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getActiveMetaPixel() {
  const { data, error } = await supabase
    .from('meta_pixels')
    .select('pixel_id')
    .eq('active', true)
    .limit(1)
    .single();

  if (error || !data?.pixel_id) {
    throw new Error('No active Meta pixel configured');
  }

  return data.pixel_id;
}