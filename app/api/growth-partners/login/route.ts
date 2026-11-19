import { authRateLimit } from '../../../../utils/auth/rateLimit';
import { createServerSupabaseClient } from '../../../../utils/businessSubscriptions';
import { sendGrowthEmail } from '../../../../utils/growthPartners/email';
import { createGrowthLoginHandler } from '../../../../utils/growthPartners/login';
export const POST = createGrowthLoginHandler({ limit: authRateLimit, admin: createServerSupabaseClient, send: sendGrowthEmail });
