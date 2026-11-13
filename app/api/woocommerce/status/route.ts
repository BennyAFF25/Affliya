import { businessRoute } from '../../../../lib/woocommerce/connections';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return businessRoute(req, 'status'); }
