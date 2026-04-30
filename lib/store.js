import { Redis } from '@upstash/redis';

// ── Redis client (reads env vars set in .env.local / Vercel dashboard) ──
export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MATCH_KEY   = 'cricket:match';
const HISTORY_KEY = 'cricket:history';

// ── CRUD helpers ──────────────────────────────────────────
export async function getMatch() {
  const raw = await redis.get(MATCH_KEY);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function setMatch(data) {
  if (data === null) { await redis.del(MATCH_KEY); return null; }
  await redis.set(MATCH_KEY, JSON.stringify(data));
  return data;
}

export async function getHistory() {
  const rows = await redis.lrange(HISTORY_KEY, 0, 29);
  return rows.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
}

export async function pushHistory(match) {
  const summary = {
    team1:      match.team1,
    team2:      match.team2,
    totalOvers: match.totalOvers,
    result:     match.result || 'No result',
    inn1: match.inn1
      ? { battingTeam: match.inn1.battingTeam, runs: match.inn1.runs, wickets: match.inn1.wickets, lb: match.inn1.lb }
      : null,
    inn2: match.inn2
      ? { battingTeam: match.inn2.battingTeam, runs: match.inn2.runs, wickets: match.inn2.wickets, lb: match.inn2.lb }
      : null,
    completedAt: Date.now(),
  };
  await redis.lpush(HISTORY_KEY, JSON.stringify(summary));
}

// ── Pure helpers (no I/O) ─────────────────────────────────
export function makeInnings(battingTeam, bowlingTeam) {
  return {
    battingTeam, bowlingTeam,
    runs: 0, wickets: 0, lb: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    striker:    { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
    nonStriker: { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
    bowler:     { name: '', lb: 0,   runs: 0,  wickets: 0 },
    currentOver: [], lastBalls: [], undoStack: [], completed: false,
  };
}

export function applyBall(inn, payload, totalOvers) {
  const { type, runs = 0, newBatsmanName = 'Player' } = payload;

  // Snapshot for undo
  const snap = JSON.parse(JSON.stringify(inn));
  delete snap.undoStack;
  inn.undoStack = [...(inn.undoStack || []), snap].slice(-5);

  let code = '', legitimate = false;

  switch (type) {
    case 'runs': {
      inn.runs += runs; inn.striker.runs += runs; inn.striker.balls++;
      inn.bowler.runs += runs; inn.bowler.lb++; inn.lb++;
      if (runs === 4) inn.striker.fours++;
      if (runs === 6) inn.striker.sixes++;
      code = runs === 0 ? '•' : String(runs);
      legitimate = true;
      if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      break;
    }
    case 'wide': {
      const w = runs + 1;
      inn.runs += w; inn.extras.wides += w; inn.bowler.runs += w;
      code = runs > 0 ? `Wd+${runs}` : 'Wd';
      break;
    }
    case 'noball': {
      const nb = runs + 1;
      inn.runs += nb; inn.extras.noBalls++; inn.striker.runs += runs; inn.bowler.runs += nb;
      code = runs > 0 ? `NB+${runs}` : 'NB';
      if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      break;
    }
    case 'wicket': {
      inn.wickets++; inn.striker.balls++; inn.bowler.lb++; inn.bowler.wickets++; inn.lb++;
      if (runs > 0) { inn.runs += runs; inn.striker.runs += runs; inn.bowler.runs += runs; }
      code = runs > 0 ? `${runs}W` : 'W';
      legitimate = true;
      inn.striker = { name: newBatsmanName, runs: 0, balls: 0, fours: 0, sixes: 0 };
      if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      break;
    }
    case 'bye': {
      inn.runs += runs; inn.extras.byes += runs; inn.striker.balls++;
      inn.bowler.lb++; inn.lb++;
      code = `B${runs}`; legitimate = true;
      if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      break;
    }
    case 'legbye': {
      inn.runs += runs; inn.extras.legByes += runs; inn.striker.balls++;
      inn.bowler.lb++; inn.lb++;
      code = `LB${runs}`; legitimate = true;
      if (runs % 2 === 1) [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
      break;
    }
  }

  inn.currentOver.push(code);
  inn.lastBalls.push(code);
  if (inn.lastBalls.length > 18) inn.lastBalls.shift();

  if (legitimate && inn.lb > 0 && inn.lb % 6 === 0) {
    [inn.striker, inn.nonStriker] = [inn.nonStriker, inn.striker];
    inn.currentOver = [];
  }

  if (inn.wickets >= 10 || (totalOvers && inn.lb >= totalOvers * 6)) {
    inn.completed = true;
  }

  return inn;
}
