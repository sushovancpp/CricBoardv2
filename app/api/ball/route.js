import { getMatch, setMatch, applyBall } from '@/lib/store';

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
    if (!match) {
      return Response.json({ error: 'No active match' }, { status: 400 });
    }

    const payload = await req.json();
    const { status, totalOvers } = match;

    // Apply ball to appropriate innings
    if (status === 'innings1' && match.inn1) {
      match.inn1 = applyBall(match.inn1, payload, totalOvers);

      if (match.inn1.completed && status === 'innings1') {
        match.status = 'innings_break';
      }
    } else if (status === 'innings2' && match.inn2) {
      match.inn2 = applyBall(match.inn2, payload, totalOvers);

      const { inn2, target } = match;
      if (inn2.runs >= target) {
        match.status = 'completed';
        const wktLeft = 10 - inn2.wickets;
        match.result = `${inn2.battingTeam} won by ${wktLeft} wicket${wktLeft !== 1 ? 's' : ''}`;
      } else if (inn2.completed) {
        match.status = 'completed';
        const diff = target - 1 - inn2.runs;
        match.result = `${match.inn1.battingTeam} won by ${diff} run${diff !== 1 ? 's' : ''}`;
      }
    }

    // Save to Redis
    await setMatch(match);

    // Broadcast to all connected clients
    await broadcastUpdate(match);

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Ball API error:', error);
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
