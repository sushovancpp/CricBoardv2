import { getMatch } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const match = await getMatch();
  return Response.json(match);
}
