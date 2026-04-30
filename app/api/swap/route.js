import { getMatch, setMatch } from '@/lib/store';

const PASS = process.env.ADMIN_PASSWORD || 'cricket@123';

// Get all connected SSE clients from global store
function getSSEClients() {
  if (!global.__sseClients) global.__sseClients = new Set();
  return global.__sseClients;
}

function broadcastUpdate(match) {
  const msg = `data: ${JSON.stringify(match)}\n\n`;
  const encoded = new TextEncoder().encode(msg);
  const clients = getSSEClients();
  const dead = [];

  clients.forEach((ctrl) => {
    try {
      ctrl.enqueue(encoded);
    } catch (err) {
      dead.push(ctrl);
    }
  });

  dead.forEach((c) => clients.delete(c));
}

export async function POST(req) {
  try {
    if (req.headers.get('x-admin-token') !== PASS) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const match = await getMatch();
    if (!match) return Response.json({ error: 'No match' }, { status: 400 });

    const inn = match.status === 'innings2' ? match.inn2 : match.inn1;
    if (!inn) return Response.json({ error: 'No innings' }, { status: 400 });

    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];

    await setMatch(match);
    await broadcastUpdate(match);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Swap error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
