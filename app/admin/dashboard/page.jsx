'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── Auth helper ───────────────────────────────────────────
function getToken() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('admin_token') || '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-token': getToken(),
  };
}

// ── Small reusable button ─────────────────────────────────
function Btn({ onClick, disabled, color = 'default', children, className = '' }) {
  const colors = {
    default: 'bg-pitch-700 hover:bg-pitch-600 text-white border border-pitch-600',
    green:   'bg-green-700 hover:bg-green-600 text-white border border-green-600',
    red:     'bg-red-800   hover:bg-red-700   text-white border border-red-700',
    yellow:  'bg-yellow-700 hover:bg-yellow-600 text-black border border-yellow-600',
    blue:    'bg-blue-800  hover:bg-blue-700  text-white border border-blue-700',
    ghost:   'bg-transparent hover:bg-pitch-800 text-pitch-400 hover:text-white border border-pitch-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colors[color]} disabled:opacity-40 disabled:cursor-not-allowed font-semibold rounded-xl px-3 py-2 text-sm transition-all ${className}`}
    >
      {children}
    </button>
  );
}

// ── Section card ──────────────────────────────────────────
function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-pitch-900 border border-pitch-700 rounded-2xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-2.5 border-b border-pitch-800">
          <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest">{title}</p>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const color = type === 'error' ? 'bg-red-900 border-red-700 text-red-300'
                                 : 'bg-green-900 border-green-700 text-green-300';
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 border rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xl ${color}`}>
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════
export default function Dashboard() {
  const router = useRouter();

  const [match,   setMatch]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState({ msg: '', type: 'ok' });

  // Create match form
  const [form, setForm] = useState({
    team1: '', team2: '', totalOvers: '10',
    toss: '', electedTo: 'bat',
  });

  // Player name edit state
  const [editMode,   setEditMode]   = useState(false);
  const [playerEdit, setPlayerEdit] = useState({
    striker:    { name: '' },
    nonStriker: { name: '' },
    bowler:     { name: '' },
  });

  // ── Auth guard ──────────────────────────────────────────
  useEffect(() => {
    if (!getToken()) {
      router.replace('/admin');
    }
  }, []);

  // ── Fetch match state ───────────────────────────────────
  const fetchMatch = useCallback(async () => {
    try {
      const res  = await fetch('/api/score');
      const data = await res.json();
      setMatch(data);
    } catch {
      showToast('Failed to fetch match', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // Poll every 5s to stay in sync
  useEffect(() => {
    const id = setInterval(fetchMatch, 5000);
    return () => clearInterval(id);
  }, [fetchMatch]);

  // ── Toast helper ────────────────────────────────────────
  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 2500);
  }

  // ── API call wrapper ────────────────────────────────────
  async function api(url, method, body) {
    try {
      const res  = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Request failed', 'error');
        return false;
      }
      await fetchMatch();
      return true;
    } catch {
      showToast('Network error', 'error');
      return false;
    }
  }

  // ── Ball scoring ────────────────────────────────────────
  async function scoreBall(payload) {
    const ok = await api('/api/ball', 'POST', payload);
    if (ok) showToast(`Scored: ${payload.runs ?? payload.type ?? '?'}`, 'ok');
  }

  // ── Logout ──────────────────────────────────────────────
  function logout() {
    sessionStorage.removeItem('admin_token');
    router.push('/');
  }

  // ── Create match ────────────────────────────────────────
  async function createMatch(e) {
    e.preventDefault();
    if (!form.team1 || !form.team2 || !form.toss) {
      showToast('Fill all fields', 'error'); return;
    }
    const ok = await api('/api/match', 'POST', {
      team1:      form.team1.trim(),
      team2:      form.team2.trim(),
      totalOvers: Number(form.totalOvers),
      toss:       form.toss,
      electedTo:  form.electedTo,
    });
    if (ok) showToast('Match created!');
  }

  // ── Match actions ────────────────────────────────────────
  async function matchAction(action) {
    const ok = await api('/api/match', 'PATCH', { action });
    if (ok) showToast(
      action === 'start_innings2' ? '2nd Innings started!'
    : action === 'end_match'      ? 'Match ended!'
    : action === 'reset'          ? 'Match reset!'
    : 'Done'
    );
  }

  // ── Save player names ────────────────────────────────────
  async function savePlayers() {
    const body = {};
    if (playerEdit.striker.name)    body.striker    = { name: playerEdit.striker.name };
    if (playerEdit.nonStriker.name) body.nonStriker = { name: playerEdit.nonStriker.name };
    if (playerEdit.bowler.name)     body.bowler     = { name: playerEdit.bowler.name };
    const ok = await api('/api/players', 'PATCH', body);
    if (ok) { showToast('Players updated!'); setEditMode(false); }
  }

  // ── Derived state ────────────────────────────────────────
  const inn = match
    ? (match.status === 'innings2' ? match.inn2 : match.inn1)
    : null;

  const isLive    = match?.status === 'innings1' || match?.status === 'innings2';
  const isBreak   = match?.status === 'innings_break';
  const isDone    = match?.status === 'completed';
  const hasMatch  = !!match && !match.error;

  function oStr(lb = 0) {
    return `${Math.floor(lb / 6)}.${lb % 6}`;
  }

  // ══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-pitch-950 flex items-center justify-center">
        <p className="text-pitch-500 text-sm animate-pulse">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pitch-950">
      <Toast msg={toast.msg} type={toast.type} />

      {/* ── Top Bar ── */}
      <header className="bg-pitch-900 border-b border-pitch-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏏</span>
          <div>
            <p className="text-white font-bold text-sm">Admin Dashboard</p>
            <p className="text-pitch-500 text-[10px]">Scorer Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank"
            className="text-pitch-500 hover:text-white text-xs border border-pitch-700 px-2.5 py-1.5 rounded-lg transition-colors">
            👁 View Scoreboard
          </a>
          <Btn onClick={logout} color="ghost" className="text-xs px-2.5 py-1.5">
            Logout
          </Btn>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">

        {/* ══════════════════════════════════════════════════
            SECTION 1 — No match: Create Match form
        ══════════════════════════════════════════════════ */}
        {!hasMatch && (
          <Card title="Create New Match">
            <form onSubmit={createMatch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Team 1</label>
                  <Input
                    value={form.team1}
                    onChange={(v) => setForm({ ...form, team1: v, toss: v || form.toss })}
                    placeholder="e.g. Mumbai"
                  />
                </div>
                <div>
                  <label className="label">Team 2</label>
                  <Input
                    value={form.team2}
                    onChange={(v) => setForm({ ...form, team2: v })}
                    placeholder="e.g. Delhi"
                  />
                </div>
              </div>

              <div>
                <label className="label">Total Overs</label>
                <Input
                  type="number"
                  value={form.totalOvers}
                  onChange={(v) => setForm({ ...form, totalOvers: v })}
                  placeholder="10"
                />
              </div>

              <div>
                <label className="label">Toss Won By</label>
                <select
                  value={form.toss}
                  onChange={(e) => setForm({ ...form, toss: e.target.value })}
                  className="select"
                >
                  <option value="">Select team</option>
                  {form.team1 && <option value={form.team1}>{form.team1}</option>}
                  {form.team2 && <option value={form.team2}>{form.team2}</option>}
                </select>
              </div>

              <div>
                <label className="label">Elected To</label>
                <div className="flex gap-2">
                  {['bat', 'bowl'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm({ ...form, electedTo: opt })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all capitalize
                        ${form.electedTo === opt
                          ? 'bg-green-800 border-green-600 text-green-200'
                          : 'bg-pitch-800 border-pitch-700 text-pitch-400 hover:text-white'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <Btn color="green" className="w-full py-3 mt-1">
                🏏 Start Match
              </Btn>
            </form>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════
            SECTION 2 — Live match scoreline
        ══════════════════════════════════════════════════ */}
        {hasMatch && (
          <Card title="Match Status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-lg">
                  {match.team1} <span className="text-pitch-600 font-normal text-base">vs</span> {match.team2}
                </p>
                <p className="text-pitch-500 text-xs mt-0.5">{match.totalOvers} overs</p>
              </div>
              <StatusBadge status={match.status} />
            </div>

            {inn && (
              <div className="mt-3 bg-pitch-800 rounded-xl px-4 py-3">
                <p className="text-pitch-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                  {inn.battingTeam} batting
                </p>
                <p className="text-white font-black text-3xl">
                  {inn.runs}
                  <span className="text-pitch-500 font-bold text-2xl">/{inn.wickets}</span>
                  <span className="text-pitch-500 font-normal text-base ml-2">
                    ({oStr(inn.lb)} ov)
                  </span>
                </p>
                {match.status === 'innings2' && match.target && (
                  <p className="text-yellow-400 text-sm font-semibold mt-1">
                    Target: {match.target} — Need {match.target - inn.runs} in{' '}
                    {match.totalOvers * 6 - inn.lb} balls
                  </p>
                )}
              </div>
            )}

            {isDone && match.result && (
              <div className="mt-3 bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-2.5">
                <p className="text-yellow-300 font-bold text-sm">🏆 {match.result}</p>
              </div>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════════════════
            SECTION 3 — Current players (live only)
        ══════════════════════════════════════════════════ */}
        {isLive && inn && (
          <Card title="Current Players">
            {!editMode ? (
              <>
                <div className="space-y-2 mb-3">
                  <PlayerRow label="Striker ★"    name={inn.striker?.name}    sub={`${inn.striker?.runs ?? 0}(${inn.striker?.balls ?? 0})`} />
                  <PlayerRow label="Non-Striker"  name={inn.nonStriker?.name} sub={`${inn.nonStriker?.runs ?? 0}(${inn.nonStriker?.balls ?? 0})`} />
                  <PlayerRow label="Bowler"       name={inn.bowler?.name}     sub={`${oStr(inn.bowler?.lb ?? 0)} ov, ${inn.bowler?.runs ?? 0}R ${inn.bowler?.wickets ?? 0}W`} accent="text-red-400" />
                </div>
                <div className="flex gap-2">
                  <Btn
                    onClick={() => {
                      setPlayerEdit({
                        striker:    { name: inn.striker?.name    || '' },
                        nonStriker: { name: inn.nonStriker?.name || '' },
                        bowler:     { name: inn.bowler?.name     || '' },
                      });
                      setEditMode(true);
                    }}
                    color="ghost"
                    className="flex-1"
                  >
                    ✏️ Edit Names
                  </Btn>
                  <Btn
                    onClick={() => api('/api/swap', 'POST', {})}
                    color="blue"
                    className="flex-1"
                  >
                    ⇄ Swap Batsmen
                  </Btn>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3 mb-3">
                  {[
                    { key: 'striker',    label: 'Striker' },
                    { key: 'nonStriker', label: 'Non-Striker' },
                    { key: 'bowler',     label: 'Bowler' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="label">{label}</label>
                      <Input
                        value={playerEdit[key].name}
                        onChange={(v) =>
                          setPlayerEdit((p) => ({ ...p, [key]: { name: v } }))
                        }
                        placeholder={`Enter ${label.toLowerCase()} name`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Btn onClick={savePlayers} color="green" className="flex-1">✓ Save</Btn>
                  <Btn onClick={() => setEditMode(false)} color="ghost" className="flex-1">Cancel</Btn>
                </div>
              </>
            )}
          </Card>
        )}

        {/* ══════════════════════════════════════════════════
            SECTION 4 — Score a Ball (live only)
        ══════════════════════════════════════════════════ */}
        {isLive && (
          <Card title="Score a Ball">
            {/* Runs */}
            <p className="text-[10px] text-pitch-600 uppercase font-bold tracking-widest mb-2">Runs</p>
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <Btn
                  key={r}
                  onClick={() => scoreBall({ runs: r })}
                  color={r === 4 ? 'blue' : r === 6 ? 'yellow' : 'default'}
                  className="py-3 text-base font-black"
                >
                  {r}
                </Btn>
              ))}
            </div>

            {/* Wicket */}
            <p className="text-[10px] text-pitch-600 uppercase font-bold tracking-widest mb-2">Wicket</p>
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {[
                { label: 'Bowled',      type: 'W',        runs: 0 },
                { label: 'Caught',      type: 'W',        runs: 0 },
                { label: 'LBW',         type: 'W',        runs: 0 },
                { label: 'Run Out',     type: 'W',        runs: 0 },
                { label: 'Stumped',     type: 'W',        runs: 0 },
                { label: 'Hit Wicket',  type: 'W',        runs: 0 },
              ].map((w) => (
                <Btn
                  key={w.label}
                  onClick={() => scoreBall({ type: 'W', runs: w.runs, dismissal: w.label })}
                  color="red"
                  className="text-xs py-2.5"
                >
                  🔴 {w.label}
                </Btn>
              ))}
            </div>

            {/* Extras */}
            <p className="text-[10px] text-pitch-600 uppercase font-bold tracking-widest mb-2">Extras</p>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {[
                { label: 'Wide +1',    payload: { type: 'Wd', runs: 1 } },
                { label: 'Wide +2',    payload: { type: 'Wd', runs: 2 } },
                { label: 'No Ball +1', payload: { type: 'NB', runs: 1 } },
                { label: 'No Ball +2', payload: { type: 'NB', runs: 2 } },
                { label: 'Bye 1',      payload: { type: 'B',  runs: 1 } },
                { label: 'Bye 4',      payload: { type: 'B',  runs: 4 } },
                { label: 'Leg Bye 1',  payload: { type: 'LB', runs: 1 } },
                { label: 'Leg Bye 4',  payload: { type: 'LB', runs: 4 } },
              ].map((x) => (
                <Btn
                  key={x.label}
                  onClick={() => scoreBall(x.payload)}
                  color="ghost"
                  className="text-xs py-2"
                >
                  {x.label}
                </Btn>
              ))}
            </div>

            {/* Undo */}
            <Btn
              onClick={() => api('/api/undo', 'POST', {})}
              color="red"
              className="w-full py-2.5 mt-1"
            >
              ↩ Undo Last Ball
            </Btn>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════
            SECTION 5 — Match controls
        ══════════════════════════════════════════════════ */}
        {hasMatch && (
          <Card title="Match Controls">
            <div className="space-y-2">

              {isBreak && (
                <Btn
                  onClick={() => matchAction('start_innings2')}
                  color="green"
                  className="w-full py-3"
                >
                  ▶ Start 2nd Innings
                </Btn>
              )}

              {isLive && (
                <Btn
                  onClick={() => {
                    if (confirm('End match now?')) matchAction('end_match');
                  }}
                  color="yellow"
                  className="w-full py-2.5"
                >
                  🏁 End Match Early
                </Btn>
              )}

              {(isDone || isBreak) && (
                <Btn
                  onClick={() => {
                    if (confirm('Reset and clear all match data?')) matchAction('reset');
                  }}
                  color="red"
                  className="w-full py-2.5"
                >
                  🗑 Reset Match
                </Btn>
              )}

              {isLive && (
                <Btn
                  onClick={() => {
                    if (confirm('Reset and clear all match data?')) matchAction('reset');
                  }}
                  color="ghost"
                  className="w-full py-2 text-xs text-red-500 hover:text-red-400"
                >
                  Reset Match
                </Btn>
              )}

            </div>
          </Card>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-pitch-950 border border-pitch-700 focus:border-pitch-400 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-colors placeholder-pitch-700 mt-1"
    />
  );
}

function PlayerRow({ label, name, sub, accent = 'text-green-400' }) {
  return (
    <div className="flex items-center justify-between bg-pitch-800 rounded-xl px-3 py-2.5">
      <div>
        <p className="text-[10px] text-pitch-500 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-white font-semibold text-sm mt-0.5">{name || '—'}</p>
      </div>
      <p className={`text-xs font-mono font-bold ${accent}`}>{sub}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    innings1:      { label: '1st Innings', color: 'bg-green-900 text-green-300 border-green-700' },
    innings_break: { label: 'Break',       color: 'bg-yellow-900 text-yellow-300 border-yellow-700' },
    innings2:      { label: '2nd Innings', color: 'bg-blue-900 text-blue-300 border-blue-700' },
    completed:     { label: 'Completed',   color: 'bg-pitch-800 text-pitch-400 border-pitch-700' },
  };
  const s = map[status] || { label: status, color: 'bg-pitch-800 text-pitch-400 border-pitch-700' };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${s.color}`}>
      {s.label}
    </span>
  );
}