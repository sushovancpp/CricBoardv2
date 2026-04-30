import { getMatch, setMatch, makeInnings, pushHistory } from '@/lib/store';

const PASS = process.env.ADMIN_PASSWORD || 'cricket@123';
const auth = (req) => req.headers.get('x-admin-token') === PASS;

export async function POST(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { team1, team2, totalOvers, toss, electedTo } = await req.json();
  const battingFirst = electedTo === 'bat' ? toss : (toss === team1 ? team2 : team1);
  const bowlingFirst = battingFirst === team1 ? team2 : team1;

  const match = {
    team1, team2,
    totalOvers: Number(totalOvers),
    toss, electedTo,
    status: 'innings1',
    inn1: makeInnings(battingFirst, bowlingFirst),
    inn2: null, target: null, result: null,
    createdAt: Date.now(),
  };
  await setMatch(match);
  return Response.json({ ok: true });
}

export async function PATCH(req) {
  if (!auth(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const match = await getMatch();
  if (!match) return Response.json({ error: 'No match' }, { status: 400 });
  const { action } = await req.json();

  if (action === 'start_innings2') {
    match.target      = match.inn1.runs + 1;
    match.status      = 'innings2';
    match.inn1.completed = true;
    match.inn2        = makeInnings(match.inn1.bowlingTeam, match.inn1.battingTeam);
  }

  if (action === 'end_match') {
    match.status = 'completed';
    const { inn1, inn2 } = match;
    if (inn2) {
      const diff = inn2.runs - inn1.runs;
      if (diff > 0)      match.result = `${inn2.battingTeam} won by ${10 - inn2.wickets} wickets`;
      else if (diff < 0) match.result = `${inn1.battingTeam} won by ${Math.abs(diff)} runs`;
      else               match.result = 'Match Tied';
    } else {
      match.result = `${inn1.battingTeam} won (match declared)`;
    }
    await pushHistory(match);
  }

  if (action === 'reset') {
    await setMatch(null);
    return Response.json({ ok: true });
  }

  await setMatch(match);
  return Response.json({ ok: true });
}
