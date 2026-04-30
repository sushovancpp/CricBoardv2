'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Helpers ───────────────────────────────────────────────
function oStr(lb = 0) { return `${Math.floor(lb / 6)}.${lb % 6}`; }

function BallChip({ code }) {
  if (!code) return null;
  let cls = 'bg-pitch-700 text-slate-400 border-pitch-600';
  if (code === '4')                             cls = 'bg-blue-900 text-blue-300 border-blue-700';
  else if (code === '6')                        cls = 'bg-yellow-900/80 text-yellow-300 border-yellow-700';
  else if (code === 'W' || code.endsWith('W'))  cls = 'bg-red-950 text-red-400 border-red-700';
  else if (code.startsWith('Wd'))               cls = 'bg-orange-950 text-orange-400 border-orange-700';
  else if (code.startsWith('NB'))               cls = 'bg-purple-950 text-purple-400 border-purple-700';
  else if (code !== '•')                        cls = 'bg-pitch-800 text-white border-pitch-500';

  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold font-mono border ${cls}`}>
      {code}
    </span>
  );
}

// ─── API helper ────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const token = sessionStorage.getItem('admin_token');
  const opts  = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'x-admin-token': token || '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(path, opts);
  return res.json();
}

// ─── Main Component ────────────────────────────────────────
export default function AdminDashboard() {
  const router  = useRouter();
  const esRef   = useRef(null);

  const [match,  setMatch]  = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Modals
  const [modal,       setModal]       = useState(null); // null | 'newmatch' | 'wicket' | 'newinnings' | 'endmatch'
  const [wicketData,  setWicketData]  = useState({ newName: '', type: 'Bowled', bowlerWicket: true });
  const [editPlayer,  setEditPlayer]  = useState(null); // null | 'striker' | 'nonStriker' | 'bowler'
  const [editName,    setEditName]    = useState('');
  const [editStats,   setEditStats]   = useState({});

  // New match form
  const [form, setForm] = useState({
    team1: '', team2: '', totalOvers: 20,
    toss: 'team1', electedTo: 'bat',
  });

  // ── Auth guard ──────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (!token) { router.push('/admin'); return; }
    // Load initial state
    api('/api/score').then((d) => { setMatch(d); setLoaded(true); });
    // SSE for live sync
    const es = new EventSource('/api/stream');
    esRef.current = es;
    es.onmessage = (e) => setMatch(JSON.parse(e.data));
    return () => es.close();
  }, [router]);

  // ── Ball action ─────────────────────────────────────────
  const sendBall = useCallback(async (payload) => {
    await api('/api/ball', 'POST', payload);
  }, []);

  // ── Quick ball buttons ───────────────────────────────────
  const quickBall = async (type, runs = 0) => {
    if (type === 'wicket') { setModal('wicket'); return; }
    await sendBall({ type, runs });
  };

  const applyWicket = async () => {
    await sendBall({
      type: 'wicket',
      runs: 0,
      newBatsmanName: wicketData.newName || 'Player',
      wicketType:     wicketData.type,
    });
    setModal(null);
    setWicketData({ newName: '', type: 'Bowled', bowlerWicket: true });
  };

  // ── Player edit ─────────────────────────────────────────
  const openEdit = (which) => {
    if (!inn) return;
    const src = which === 'bowler' ? inn.bowler
              : which === 'striker' ? inn.striker
              : inn.nonStriker;
    setEditPlayer(which);
    setEditName(src.name);
    if (which === 'bowler') {
      setEditStats({ lb: src.lb, runs: src.runs, wickets: src.wickets });
    } else {
      setEditStats({ runs: src.runs, balls: src.balls, fours: src.fours, sixes: src.sixes });
    }
  };

  const saveEdit = async () => {
    if (!editPlayer) return;
    const payload = {};
    if (editPlayer === 'bowler') {
      payload.bowler = { name: editName, ...editStats };
    } else {
      payload[editPlayer] = { name: editName, ...editStats };
    }
    await api('/api/players', 'PATCH', payload);
    setEditPlayer(null);
  };

  // ── Match actions ────────────────────────────────────────
  const createMatch = async () => {
    const body = {
      team1: form.team1 || 'Team A',
      team2: form.team2 || 'Team B',
      totalOvers: Number(form.totalOvers),
      toss: form.toss === 'team1' ? (form.team1 || 'Team A') : (form.team2 || 'Team B'),
      electedTo: form.electedTo,
    };
    await api('/api/match', 'POST', body);
    setModal(null);
  };

  const startInn2 = async () => {
    await api('/api/match', 'PATCH', { action: 'start_innings2' });
    setModal(null);
  };

  const endMatch = async () => {
    await api('/api/match', 'PATCH', { action: 'end_match' });
    setModal(null);
  };

  const resetMatch = async () => {
    if (!confirm('Reset match? All data will be lost.')) return;
    await api('/api/match', 'PATCH', { action: 'reset' });
  };

  const swapStrike = () => api('/api/swap', 'POST');
  const undoBall   = () => api('/api/undo', 'POST');

  // ── Derived ──────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="min-h-screen bg-pitch-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-pitch-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLive    = match?.status === 'innings1' || match?.status === 'innings2';
  const isBreak   = match?.status === 'innings_break';
  const isDone    = match?.status === 'completed';
  const inn       = match?.status === 'innings2' ? match?.inn2 : match?.inn1;
  const inn1      = match?.inn1;
  const totalOvers = match?.totalOvers;
  const target    = match?.target;

  return (
    <div className="min-h-screen bg-pitch-950 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-pitch-900 border-b border-pitch-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <a href="/" className="text-pitch-500 text-xs hover:text-white transition-colors">← Live</a>
          <span className="text-pitch-700">|</span>
          <span className="text-white font-bold text-sm">🏏 Admin</span>
        </div>
        <div className="flex gap-2">
          {!match && (
            <button
              onClick={() => setModal('newmatch')}
              className="bg-pitch-400 text-black font-bold text-xs px-3.5 py-2 rounded-lg hover:bg-pitch-300 transition-colors"
            >
              + New Match
            </button>
          )}
          {match && (
            <button
              onClick={resetMatch}
              className="bg-red-950 text-red-400 border border-red-900 text-xs px-3 py-2 rounded-lg hover:bg-red-900 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {/* ── No match ── */}
      {!match && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
          <p className="text-pitch-500 text-center text-sm">No match in progress.</p>
          <button
            onClick={() => setModal('newmatch')}
            className="bg-pitch-400 text-black font-bold px-6 py-3 rounded-xl text-sm hover:bg-pitch-300 transition-colors"
          >
            🏏 Create New Match
          </button>
        </div>
      )}

      {/* ── Active match ── */}
      {match && (
        <div className="flex-1 px-3 py-4 space-y-3 max-w-lg mx-auto w-full">

          {/* Score Summary */}
          <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-pitch-500 font-semibold uppercase tracking-wider">
                {match.status === 'innings2' ? '2nd Innings' : match.status === 'innings1' ? '1st Innings' : match.status.replace('_', ' ')}
              </span>
              {isDone && <span className="text-xs text-yellow-400 font-bold">✓ Match Over</span>}
              {isBreak && <span className="text-xs text-blue-400 font-bold">⏸ Break</span>}
            </div>
            <p className="text-white font-bold text-lg">
              {match.team1} <span className="text-pitch-500 font-normal text-sm">vs</span> {match.team2}
            </p>
            {inn && (
              <p className="text-3xl font-black text-white mt-1">
                {inn.runs}
                <span className="text-pitch-400 text-2xl font-bold">/{inn.wickets}</span>
                <span className="text-pitch-500 text-sm font-normal ml-2">
                  ({oStr(inn.lb)} / {totalOvers} ov)
                </span>
              </p>
            )}
            {match.status === 'innings2' && target && inn && (
              <p className="text-yellow-400 text-sm mt-0.5 font-semibold">
                Target {target} — Need {target - inn.runs} more
              </p>
            )}
            {isDone && match.result && (
              <p className="text-yellow-300 font-bold mt-1">🏆 {match.result}</p>
            )}
          </div>

          {/* ── Ball Controls (only when live) ── */}
          {isLive && inn && (
            <>
              {/* Current Over */}
              {inn.currentOver.length > 0 && (
                <div className="bg-pitch-900 border border-pitch-700 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-2">
                    Current Over ({oStr(inn.lb)})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {inn.currentOver.map((c, i) => <BallChip key={i} code={c} />)}
                  </div>
                </div>
              )}

              {/* RUNS buttons */}
              <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-3">
                  Add Ball
                </p>

                {/* Runs: 0-6 */}
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <button
                      key={r}
                      onClick={() => quickBall('runs', r)}
                      className={`py-3 rounded-xl font-bold text-sm active:scale-95 transition-all ${
                        r === 4
                          ? 'bg-blue-800 hover:bg-blue-700 text-blue-200 border border-blue-700'
                          : r === 6
                          ? 'bg-yellow-800/80 hover:bg-yellow-700/80 text-yellow-200 border border-yellow-700'
                          : r === 0
                          ? 'bg-pitch-800 hover:bg-pitch-700 text-slate-400 border border-pitch-600'
                          : 'bg-pitch-800 hover:bg-pitch-700 text-white border border-pitch-600'
                      }`}
                    >
                      {r === 0 ? '•' : r}
                    </button>
                  ))}
                  {/* Wicket */}
                  <button
                    onClick={() => quickBall('wicket')}
                    className="py-3 rounded-xl font-bold text-sm bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 active:scale-95 transition-all"
                  >
                    W
                  </button>
                </div>

                {/* Extras row */}
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => quickBall('wide')}    className="py-2.5 rounded-xl text-xs font-bold bg-orange-950 hover:bg-orange-900 text-orange-400 border border-orange-800 active:scale-95 transition-all">Wd</button>
                  <button onClick={() => quickBall('noball')}  className="py-2.5 rounded-xl text-xs font-bold bg-purple-950 hover:bg-purple-900 text-purple-400 border border-purple-800 active:scale-95 transition-all">NB</button>
                  <button onClick={() => quickBall('bye', 1)}  className="py-2.5 rounded-xl text-xs font-bold bg-teal-950 hover:bg-teal-900 text-teal-400 border border-teal-800 active:scale-95 transition-all">B</button>
                  <button onClick={() => quickBall('legbye', 1)} className="py-2.5 rounded-xl text-xs font-bold bg-teal-950 hover:bg-teal-900 text-teal-300 border border-teal-800 active:scale-95 transition-all">LB</button>
                </div>

                {/* Undo */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={undoBall}
                    className="flex items-center gap-1.5 text-xs text-pitch-500 hover:text-white border border-pitch-700 hover:border-pitch-500 px-3 py-2 rounded-lg transition-colors"
                  >
                    ↩ Undo Last Ball
                  </button>
                </div>
              </div>

              {/* ── Batsmen ── */}
              <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest">Batsmen</p>
                  <button
                    onClick={swapStrike}
                    className="text-xs text-pitch-400 hover:text-white border border-pitch-700 hover:border-pitch-500 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    ⇄ Swap Strike
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Striker */}
                  <div
                    className="flex items-center justify-between bg-pitch-800 border border-green-900/50 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-green-700/50 transition-colors"
                    onClick={() => openEdit('striker')}
                  >
                    <div>
                      <p className="text-[10px] text-green-500 font-bold mb-0.5">STRIKER ★</p>
                      <p className="text-white font-semibold text-sm">{inn.striker.name || <span className="text-pitch-600 italic text-xs">Tap to set name</span>}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-lg leading-none">{inn.striker.runs}</p>
                      <p className="text-pitch-500 text-xs">({inn.striker.balls}b)</p>
                    </div>
                  </div>

                  {/* Non-Striker */}
                  <div
                    className="flex items-center justify-between bg-pitch-800 border border-pitch-700 rounded-xl px-3.5 py-2.5 cursor-pointer hover:border-pitch-600 transition-colors"
                    onClick={() => openEdit('nonStriker')}
                  >
                    <div>
                      <p className="text-[10px] text-pitch-500 font-bold mb-0.5">NON-STRIKER</p>
                      <p className="text-white font-semibold text-sm">{inn.nonStriker.name || <span className="text-pitch-600 italic text-xs">Tap to set name</span>}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-lg leading-none">{inn.nonStriker.runs}</p>
                      <p className="text-pitch-500 text-xs">({inn.nonStriker.balls}b)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bowler ── */}
              <div
                className="bg-pitch-900 border border-pitch-700 rounded-2xl p-4 cursor-pointer hover:border-pitch-600 transition-colors"
                onClick={() => openEdit('bowler')}
              >
                <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-2">Current Bowler</p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold">
                    {inn.bowler.name || <span className="text-pitch-600 italic text-sm">Tap to set bowler</span>}
                  </p>
                  <p className="text-pitch-400 text-sm font-mono">
                    {oStr(inn.bowler.lb)}-{inn.bowler.runs}-{inn.bowler.wickets}
                  </p>
                </div>
              </div>

              {/* ── Match Controls ── */}
              <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-3">Match Controls</p>
                <div className="grid grid-cols-2 gap-2">
                  {match.status === 'innings1' && (
                    <button
                      onClick={() => setModal('newinnings')}
                      className="col-span-2 py-3 bg-blue-900/50 hover:bg-blue-900 border border-blue-800 text-blue-300 font-bold text-sm rounded-xl transition-colors"
                    >
                      ⏭ Start 2nd Innings
                    </button>
                  )}
                  <button
                    onClick={() => setModal('endmatch')}
                    className="col-span-2 py-3 bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 font-bold text-sm rounded-xl transition-colors"
                  >
                    🏁 End Match Now
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Innings Break Controls */}
          {isBreak && (
            <div className="bg-pitch-900 border border-pitch-700 rounded-2xl p-5 text-center space-y-3">
              <p className="text-white font-bold text-lg">Innings Break</p>
              <p className="text-pitch-400 text-sm">
                {inn1?.battingTeam} scored{' '}
                <span className="text-white font-bold">{inn1?.runs}/{inn1?.wickets}</span>.
                Target: <span className="text-yellow-400 font-bold">{match.target}</span>
              </p>
              <button
                onClick={startInn2}
                className="w-full py-3 bg-pitch-400 hover:bg-pitch-300 text-black font-bold rounded-xl text-sm transition-colors"
              >
                ▶ Start 2nd Innings
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* New Match Modal */}
      {modal === 'newmatch' && (
        <ModalWrap onClose={() => setModal(null)}>
          <h2 className="font-bold text-xl text-white mb-5">🏏 New Match</h2>
          <div className="space-y-4">
            <Field label="Team 1 Name" value={form.team1} onChange={(v) => setForm((p) => ({ ...p, team1: v }))} placeholder="Team A" />
            <Field label="Team 2 Name" value={form.team2} onChange={(v) => setForm((p) => ({ ...p, team2: v }))} placeholder="Team B" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total Overs" type="number" value={form.totalOvers} onChange={(v) => setForm((p) => ({ ...p, totalOvers: v }))} />
              <div>
                <label className="label-xs">Toss Won By</label>
                <select
                  value={form.toss}
                  onChange={(e) => setForm((p) => ({ ...p, toss: e.target.value }))}
                  className="select-field"
                >
                  <option value="team1">{form.team1 || 'Team 1'}</option>
                  <option value="team2">{form.team2 || 'Team 2'}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label-xs">Elected To</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {['bat', 'field'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setForm((p) => ({ ...p, electedTo: opt }))}
                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all capitalize ${
                      form.electedTo === opt
                        ? 'bg-pitch-400 text-black border-pitch-400'
                        : 'bg-pitch-950 text-pitch-400 border-pitch-700 hover:border-pitch-500'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={createMatch} className="w-full py-3 bg-pitch-400 hover:bg-pitch-300 text-black font-bold rounded-xl text-sm transition-colors mt-2">
              Create &amp; Start Match
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Wicket Modal */}
      {modal === 'wicket' && (
        <ModalWrap onClose={() => setModal(null)}>
          <h2 className="font-bold text-xl text-white mb-2">🔴 Wicket</h2>
          <p className="text-pitch-500 text-sm mb-5">{inn?.striker?.name || 'Striker'} is out</p>
          <div className="space-y-4">
            <div>
              <label className="label-xs">Wicket Type</label>
              <select
                value={wicketData.type}
                onChange={(e) => setWicketData((p) => ({ ...p, type: e.target.value }))}
                className="select-field"
              >
                {['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket', 'Obstructing', 'Timed Out'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <Field
              label="New Batsman Name"
              value={wicketData.newName}
              onChange={(v) => setWicketData((p) => ({ ...p, newName: v }))}
              placeholder="Enter incoming batsman name"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModal(null)} className="py-3 bg-pitch-800 border border-pitch-700 text-slate-400 font-semibold rounded-xl text-sm">
                Cancel
              </button>
              <button onClick={applyWicket} className="py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors">
                Apply Wicket
              </button>
            </div>
          </div>
        </ModalWrap>
      )}

      {/* Edit Player Modal */}
      {editPlayer && (
        <ModalWrap onClose={() => setEditPlayer(null)}>
          <h2 className="font-bold text-xl text-white mb-5 capitalize">
            ✏️ Edit {editPlayer === 'nonStriker' ? 'Non-Striker' : editPlayer === 'striker' ? 'Striker' : 'Bowler'}
          </h2>
          <div className="space-y-3">
            <Field label="Name" value={editName} onChange={setEditName} placeholder="Player name" autoFocus />
            {editPlayer !== 'bowler' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Runs" type="number" value={editStats.runs ?? 0}   onChange={(v) => setEditStats((p) => ({ ...p, runs: Number(v) }))} />
                <Field label="Balls" type="number" value={editStats.balls ?? 0} onChange={(v) => setEditStats((p) => ({ ...p, balls: Number(v) }))} />
                <Field label="4s" type="number" value={editStats.fours ?? 0}    onChange={(v) => setEditStats((p) => ({ ...p, fours: Number(v) }))} />
                <Field label="6s" type="number" value={editStats.sixes ?? 0}    onChange={(v) => setEditStats((p) => ({ ...p, sixes: Number(v) }))} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Leg. Balls" type="number" value={editStats.lb ?? 0}   onChange={(v) => setEditStats((p) => ({ ...p, lb: Number(v) }))} />
                <Field label="Runs" type="number" value={editStats.runs ?? 0}        onChange={(v) => setEditStats((p) => ({ ...p, runs: Number(v) }))} />
                <Field label="Wickets" type="number" value={editStats.wickets ?? 0} onChange={(v) => setEditStats((p) => ({ ...p, wickets: Number(v) }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setEditPlayer(null)} className="py-3 bg-pitch-800 border border-pitch-700 text-slate-400 font-semibold rounded-xl text-sm">Cancel</button>
              <button onClick={saveEdit} className="py-3 bg-pitch-400 hover:bg-pitch-300 text-black font-bold rounded-xl text-sm transition-colors">Save</button>
            </div>
          </div>
        </ModalWrap>
      )}

      {/* Start 2nd Innings Modal */}
      {modal === 'newinnings' && (
        <ModalWrap onClose={() => setModal(null)}>
          <h2 className="font-bold text-xl text-white mb-2">Start 2nd Innings?</h2>
          <p className="text-pitch-400 text-sm mb-5">
            {inn1?.battingTeam} scored <span className="text-white font-bold">{inn1?.runs}/{inn1?.wickets}</span>{' '}
            in <span className="text-white">{oStr(inn1?.lb ?? 0)}</span> overs.{' '}
            Target: <span className="text-yellow-400 font-bold">{(inn1?.runs ?? 0) + 1}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModal(null)} className="py-3 bg-pitch-800 border border-pitch-700 text-slate-400 font-semibold rounded-xl text-sm">Cancel</button>
            <button onClick={startInn2} className="py-3 bg-pitch-400 hover:bg-pitch-300 text-black font-bold rounded-xl text-sm transition-colors">Start 2nd Innings</button>
          </div>
        </ModalWrap>
      )}

      {/* End Match Modal */}
      {modal === 'endmatch' && (
        <ModalWrap onClose={() => setModal(null)}>
          <h2 className="font-bold text-xl text-white mb-2">End Match?</h2>
          <p className="text-pitch-400 text-sm mb-5">
            Result will be calculated based on current scores.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setModal(null)} className="py-3 bg-pitch-800 border border-pitch-700 text-slate-400 font-semibold rounded-xl text-sm">Cancel</button>
            <button onClick={endMatch} className="py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-colors">End Match</button>
          </div>
        </ModalWrap>
      )}
    </div>
  );
}

// ── Shared UI pieces ──────────────────────────────────────
function ModalWrap({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-pitch-900 border border-pitch-700 rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '', autoFocus = false }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-pitch-500 uppercase tracking-wider mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-pitch-950 border border-pitch-700 focus:border-pitch-400 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors placeholder-pitch-700"
      />
    </div>
  );
}
