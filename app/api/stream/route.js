export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getMatch } from '@/lib/store';

// Global SSE client tracking
if (!global.__sseClients) {
  global.__sseClients = new Set();
}

export async function GET(request) {
  let ctrl;

  const stream = new ReadableStream({
    async start(c) {
      ctrl = c;
      global.__sseClients.add(ctrl);

      // Send current state immediately on connect
      try {
        const match = await getMatch();
        const msg = `data: ${JSON.stringify(match || { error: 'No match' })}\n\n`;
        ctrl.enqueue(new TextEncoder().encode(msg));
      } catch (err) {
        console.error('Stream init error:', err);
      }
    },
    cancel() {
      global.__sseClients.delete(ctrl);
    },
  });

  // Listen for abort
  request.signal.addEventListener('abort', () => {
    global.__sseClients.delete(ctrl);
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
