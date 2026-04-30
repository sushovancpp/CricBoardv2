import { createClient } from 'redis';

let client;
async function getClient() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (e) => console.error('Redis error:', e));
    await client.connect();
  }
  return client;
}

const MATCH_KEY    = 'cricboard:active';
const HISTORY_KEY  = 'cricboard:history';

// ── Innings factory ───────────────────────────────────────
export function makeInnings(battingTeam, bowlingTeam) {
  return {
    battingTeam, bowlingTeam,
    runs: 0, wickets: 0, lb: 0,
    striker:    { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
    nonStriker: { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
    bowler:     { name: '', runs: 0, lb: 0, wickets: 0 },
    currentOver: [],
    lastBalls:   [],
    extras:      { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    completed:   false,
    undoStack:   [],
  };
}

// ── Ball engine ───────────────────────────────────────────
export function applyBall(inn, payload, totalOvers) {
  // Save snapshot for undo (exclude undoStack itself)
  const { undoStack, ...snap } = inn;
  inn.undoStack = [...undoStack, JSON.parse(JSON.stringify(snap))];
  if (inn.undoStack.length > 30) inn.undoStack.shift();

  const { type, runs = 0 } = payload;
  const isWide   = type === 'Wd';
  const isNoBall = type === 'NB';
  const isOut    = type === 'W';
  const isExtra  = isWide || isNoBall;

  // ── Extras ──
  if (isWide) {
    inn.runs += 1 + runs;
    inn.extras.wides += 1 + runs;
    inn.currentOver.push(`Wd${runs > 0 ? '+' + runs : ''}`);
    inn.lastBalls.push(`Wd${runs > 0 ? '+' + runs : ''}`);
    inn.bowler.runs += 1 + runs;
    return inn; // ball not counted
  }

  if (isNoBall) {
    inn.runs += 1 + runs;
    inn.extras.noBalls += 1;
    if (runs > 0) inn.runs += runs;
    inn.currentOver.push(`NB${runs > 0 ? '+' + runs : ''}`);
    inn.lastBalls.push(`NB${runs > 0 ? '+' + runs : ''}`);
    inn.bowler.runs += 1 + runs;
    // striker still gets runs but ball not counted
    if (runs > 0) {
      inn.striker.runs += runs;
      if (runs === 4) inn.striker.fours++;
      if (runs === 6) inn.striker.sixes++;
    }
    return inn; // ball not counted
  }

  // ── Valid ball: count it ──
  inn.lb++;
  inn.bowler.lb++;

  if (isOut) {
    inn.wickets++;
    inn.bowler.wickets++;
    inn.currentOver.push('W');
    inn.lastBalls.push('W');

    // Reset new batsman (keeps nonStriker, resets striker)
    inn.striker = { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 };

    // Check innings complete (10 wickets or over limit)
    if (inn.wickets >= 10 || (totalOvers && inn.lb >= totalOvers * 6)) {
      inn.completed = true;
    }

    // End of over after wicket
    if (inn.lb % 6 === 0) {
      inn.currentOver = [];
      // rotate strike at end of over
      [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    }
    return inn;
  }

  // ── Normal runs ──
  inn.striker.runs  += runs;
  inn.striker.balls += 1;
  inn.runs          += runs;
  inn.bowler.runs   += runs;

  if (runs === 4) inn.striker.fours++;
  if (runs === 6) inn.striker.sixes++;

  // Ball chip
  const chip = runs === 0 ? '•' : String(runs);
  inn.currentOver.push(chip);
  inn.lastBalls.push(chip);

  // ── Strike rotation ──
  // Rotate on odd runs (1, 3, 5)
  if (runs % 2 === 1) {
    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
  }

  // End of over
  if (inn.lb % 6 === 0) {
    inn.currentOver = [];
    // Always rotate at end of over
    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
  }

  // Check completion
  if (totalOvers && inn.lb >= totalOvers * 6) {
    inn.completed = true;
  }

  return inn;
}

// ── Redis operations ──────────────────────────────────────
export async function getMatch() {
  const r    = await getClient();
  const raw  = await r.get(MATCH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function setMatch(match) {
  const r = await getClient();
  if (!match) {
    await r.del(MATCH_KEY);
    return;
  }
  await r.set(MATCH_KEY, JSON.stringify(match));
}

export async function getHistory() {
  const r   = await getClient();
  const raw = await r.get(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function pushHistory(match) {
  const r       = await getClient();
  const history = await getHistory();
  history.unshift({
    id:        match.createdAt,
    team1:     match.team1,
    team2:     match.team2,
    totalOvers: match.totalOvers,
    status:    'completed',
    result:    match.result || '',
    inn1:      match.inn1 ? { runs: match.inn1.runs, wickets: match.inn1.wickets, lb: match.inn1.lb, battingTeam: match.inn1.battingTeam } : null,
    inn2:      match.inn2 ? { runs: match.inn2.runs, wickets: match.inn2.wickets, lb: match.inn2.lb, battingTeam: match.inn2.battingTeam } : null,
    completedAt: Date.now(),
  });
  // Keep last 20 matches
  if (history.length > 20) history.pop();
  await r.set(HISTORY_KEY, JSON.stringify(history));
}
