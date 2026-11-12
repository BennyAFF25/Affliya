import { businessRoute } from '../../../../lib/woocommerce/connections';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) { return businessRoute(req, 'connect'); }
