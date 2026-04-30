'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function getToken() { return typeof window !== 'undefined' ? sessionStorage.getItem('admin_token') || '' : ''; }
function authH()    { return { 'Content-Type': 'application/json', 'x-admin-token': getToken() }; }
function oStr(lb=0) { return `${Math.floor(lb/6)}.${lb%6}`; }

// ── Toast ────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
      type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`}>{msg}</div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [match,   setMatch]   = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('score'); // score | create | history
  const [toast,   setToast]   = useState({ msg: '', type: 'ok' });
  const [editMode, setEditMode] = useState(false);

  // Create form
  const [form, setForm] = useState({ team1: '', team2: '', totalOvers: '10', toss: '', electedTo: 'bat' });
  // Player edit
  const [pe, setPe] = useState({ striker: '', nonStriker: '', bowler: '' });
  // New batsman name (shown after wicket)
  const [newBatsman, setNewBatsman] = useState('');
  const [needBatsman, setNeedBatsman] = useState(false);

  // ── Auth guard ──
  useEffect(() => { if (!getToken()) router.replace('/admin'); }, []);

  const showToast = (msg, type = 'ok') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'ok' }), 2500); };

  const fetchAll = useCallback(async () => {
    try {
      const [mRes, hRes] = await Promise.all([fetch('/api/score'), fetch('/api/history')]);
      const [m, h] = await Promise.all([mRes.json(), hRes.json()]);
      setMatch(m?.error ? null : m);
      setHistory(Array.isArray(h) ? h : []);
    } catch { showToast('Fetch failed', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const id = setInterval(fetchAll, 5000); return () => clearInterval(id); }, [fetchAll]);

  async function api(url, method, body) {
    try {
      const res  = await fetch(url, { method, headers: authH(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.error) { showToast(data.error || 'Error', 'error'); return false; }
      await fetchAll();
      return true;
    } catch { showToast('Network error', 'error'); return false; }
  }

  async function scoreBall(payload) {
    const isOut = payload.type === 'W';
    const ok = await api('/api/ball', 'POST', payload);
    if (ok) {
      if (isOut) { setNeedBatsman(true); setNewBatsman(''); }
      showToast(isOut ? 'Wicket! Enter new batsman' : `Scored: ${payload.runs ?? payload.type}`, isOut ? 'error' : 'ok');
    }
  }

  async function saveNewBatsman() {
    if (!newBatsman.trim()) return;
    const ok = await api('/api/players', 'PATCH', { striker: { name: newBatsman.trim() } });
    if (ok) { setNeedBatsman(false); showToast('New batsman set'); }
  }

  async function savePlayers() {
    const body = {};
    if (pe.striker)    body.striker    = { name: pe.striker };
    if (pe.nonStriker) body.nonStriker = { name: pe.nonStriker };
    if (pe.bowler)     body.bowler     = { name: pe.bowler };
    const ok = await api('/api/players', 'PATCH', body);
    if (ok) { setEditMode(false); showToast('Saved'); }
  }

  async function createMatch(e) {
    e.preventDefault();
    if (!form.team1 || !form.team2 || !form.toss) { showToast('Fill all fields', 'error'); return; }
    const ok = await api('/api/match', 'POST', {
      team1: form.team1.trim(), team2: form.team2.trim(),
      totalOvers: Number(form.totalOvers), toss: form.toss, electedTo: form.electedTo,
    });
    if (ok) { showToast('Match created!'); setTab('score'); }
  }

  async function matchAction(action) {
    if (action === 'reset' && !confirm('Reset and delete this match?')) return;
    if (action === 'end_match' && !confirm('End match now?')) return;
    const ok = await api('/api/match', 'PATCH', { action });
    if (ok) showToast(action === 'start_innings2' ? '2nd innings started' : action === 'end_match' ? 'Match ended' : 'Reset done');
  }

  const inn    = match ? (match.status === 'innings2' ? match.inn2 : match.inn1) : null;
  const isLive = match?.status === 'innings1' || match?.status === 'innings2';
  const isBreak = match?.status === 'innings_break';
  const isDone  = match?.status === 'completed';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm animate-pulse">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🏏</span>
          <span className="font-medium text-gray-800 text-sm">Admin dashboard</span>
          {match && <StatusPill status={match.status} />}
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors">
            View scoreboard
          </a>
          <button onClick={() => { sessionStorage.removeItem('admin_token'); router.push('/'); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-full transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1">
        {[
          { key: 'score',   label: 'Score' },
          { key: 'create',  label: match ? 'New match' : 'Create match' },
          { key: 'history', label: `History (${history.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ══ TAB: SCORE ══ */}
        {tab === 'score' && (
          <>
            {!match ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-800 font-medium mb-1">No active match</p>
                <p className="text-gray-500 text-sm mb-4">Create a match to start scoring</p>
                <button onClick={() => setTab('create')}
                  className="bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-blue-700 transition-colors">
                  Create match
                </button>
              </div>
            ) : (
              <>
                {/* Live score strip */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">{match.team1} vs {match.team2}</p>
                      {inn && (
                        <>
                          <p className="text-3xl font-light text-gray-900">
                            {inn.runs}<span className="text-xl text-gray-400">/{inn.wickets}</span>
                            <span className="text-sm text-gray-400 ml-2">({oStr(inn.lb)} ov)</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{inn.battingTeam} batting</p>
                        </>
                      )}
                    </div>
                    {match.status === 'innings2' && match.target && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Target</p>
                        <p className="text-2xl font-light text-blue-600">{match.target}</p>
                      </div>
                    )}
                  </div>

                  {isDone && match.result && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <p className="text-amber-800 text-sm font-medium">🏆 {match.result}</p>
                    </div>
                  )}
                </div>

                {/* New batsman prompt */}
                {needBatsman && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-red-800 text-sm font-medium mb-3">Wicket! Enter new batsman name</p>
                    <div className="flex gap-2">
                      <input value={newBatsman} onChange={e => setNewBatsman(e.target.value)}
                        placeholder="New batsman name" autoFocus
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400" />
                      <button onClick={saveNewBatsman}
                        className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                        Set
                      </button>
                    </div>
                  </div>
                )}

                {/* Players */}
                {isLive && inn && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    {!editMode ? (
                      <>
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Striker <span className="text-blue-500">*</span></span>
                            <span className="font-medium">{inn.striker?.name || '—'} &nbsp;<span className="text-gray-400 font-normal">{inn.striker?.runs ?? 0}({inn.striker?.balls ?? 0})</span></span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Non-striker</span>
                            <span className="font-medium">{inn.nonStriker?.name || '—'} &nbsp;<span className="text-gray-400 font-normal">{inn.nonStriker?.runs ?? 0}({inn.nonStriker?.balls ?? 0})</span></span>
                          </div>
                          <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                            <span className="text-gray-500">Bowler</span>
                            <span className="font-medium">{inn.bowler?.name || '—'} &nbsp;<span className="text-gray-400 font-normal">{oStr(inn.bowler?.lb ?? 0)} {inn.bowler?.runs ?? 0}R {inn.bowler?.wickets ?? 0}W</span></span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setPe({ striker: inn.striker?.name || '', nonStriker: inn.nonStriker?.name || '', bowler: inn.bowler?.name || '' });
                            setEditMode(true);
                          }} className="flex-1 text-sm border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors">
                            Edit names
                          </button>
                          <button onClick={() => api('/api/swap', 'POST', {})}
                            className="flex-1 text-sm border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors">
                            ⇄ Swap
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2 mb-3">
                          {[['striker','Striker'],['nonStriker','Non-striker'],['bowler','Bowler']].map(([k,l]) => (
                            <div key={k}>
                              <p className="text-xs text-gray-400 mb-1">{l}</p>
                              <input value={pe[k]} onChange={e => setPe(p => ({ ...p, [k]: e.target.value }))}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400" />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={savePlayers} className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-xl hover:bg-blue-700 transition-colors">Save</button>
                          <button onClick={() => setEditMode(false)} className="flex-1 text-sm border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors">Cancel</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ── Scoring pad ── */}
                {isLive && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    {/* Runs */}
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Runs</p>
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {[0,1,2,3,4,5,6].map(r => (
                        <button key={r} onClick={() => scoreBall({ runs: r })}
                          className={`h-12 rounded-xl text-base font-medium border transition-all active:scale-95 ${
                            r === 4 ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
                          : r === 6 ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          {r}
                        </button>
                      ))}
                    </div>

                    {/* Extras + Wicket + Undo in one row */}
                    <div className="flex gap-2">
                      <button onClick={() => scoreBall({ type: 'Wd', runs: 0 })}
                        className="flex-1 h-11 rounded-xl text-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                        Wide
                      </button>
                      <button onClick={() => scoreBall({ type: 'NB', runs: 0 })}
                        className="flex-1 h-11 rounded-xl text-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-medium">
                        No Ball
                      </button>
                      <button onClick={() => scoreBall({ type: 'W', runs: 0 })}
                        className="flex-1 h-11 rounded-xl text-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium">
                        Out
                      </button>
                      <button onClick={() => api('/api/undo', 'POST', {})}
                        className="h-11 px-4 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                        ↩
                      </button>
                    </div>
                  </div>
                )}

                {/* Match controls */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Match controls</p>
                  {isBreak && (
                    <button onClick={() => matchAction('start_innings2')}
                      className="w-full bg-blue-600 text-white text-sm font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors">
                      Start 2nd innings
                    </button>
                  )}
                  {isLive && (
                    <button onClick={() => matchAction('end_match')}
                      className="w-full border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium py-2.5 rounded-xl hover:bg-amber-100 transition-colors">
                      End match early
                    </button>
                  )}
                  <button onClick={() => matchAction('reset')}
                    className="w-full border border-red-200 text-red-500 text-sm py-2.5 rounded-xl hover:bg-red-50 transition-colors">
                    Reset match
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ TAB: CREATE MATCH ══ */}
        {tab === 'create' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="font-medium text-gray-900 mb-4">New match</h2>
            <form onSubmit={createMatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Team 1</label>
                  <input value={form.team1} onChange={e => setForm({...form, team1: e.target.value})}
                    placeholder="e.g. Mumbai" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Team 2</label>
                  <input value={form.team2} onChange={e => setForm({...form, team2: e.target.value})}
                    placeholder="e.g. Delhi" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Total overs</label>
                <input type="number" value={form.totalOvers} onChange={e => setForm({...form, totalOvers: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Toss won by</label>
                <select value={form.toss} onChange={e => setForm({...form, toss: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">Select team</option>
                  {form.team1 && <option value={form.team1}>{form.team1}</option>}
                  {form.team2 && <option value={form.team2}>{form.team2}</option>}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Elected to</label>
                <div className="flex gap-2">
                  {['bat','bowl'].map(o => (
                    <button key={o} type="button" onClick={() => setForm({...form, electedTo: o})}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                        form.electedTo === o ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit"
                className="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm">
                Start match
              </button>
            </form>
          </div>
        )}

        {/* ══ TAB: HISTORY ══ */}
        {tab === 'history' && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {history.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 text-sm">No completed matches yet</p>
              </div>
            ) : (
              history.map((m, i) => (
                <div key={m.id || i} className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{m.team1} vs {m.team2}</p>
                      {m.result && <p className="text-xs text-gray-500 mt-0.5">{m.result}</p>}
                      {m.inn1 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {m.inn1.battingTeam}: {m.inn1.runs}/{m.inn1.wickets} ({oStr(m.inn1.lb)} ov)
                          {m.inn2 && ` · ${m.inn2.battingTeam}: ${m.inn2.runs}/${m.inn2.wickets} (${oStr(m.inn2.lb)} ov)`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{m.totalOvers} ov</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    innings1:      ['Live · 1st innings', 'bg-green-50 text-green-700 border-green-200'],
    innings_break: ['Break', 'bg-yellow-50 text-yellow-700 border-yellow-200'],
    innings2:      ['Live · 2nd innings', 'bg-blue-50 text-blue-700 border-blue-200'],
    completed:     ['Completed', 'bg-gray-100 text-gray-500 border-gray-200'],
  };
  const [label, cls] = map[status] || ['—', 'bg-gray-100 text-gray-500 border-gray-200'];
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>{label}</span>;
}
