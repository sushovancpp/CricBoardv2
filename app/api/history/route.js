import { getHistory } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const history = await getHistory();
  return Response.json(history);
}