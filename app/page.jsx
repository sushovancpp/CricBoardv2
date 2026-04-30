'use client';

import { useEffect, useState, useRef } from 'react';

function oStr(lb = 0) { return `${Math.floor(lb / 6)}.${lb % 6}`; }
function rr(runs, lb)  { return lb ? ((runs / lb) * 6).toFixed(2) : '0.00'; }
function sr(runs, balls) { return balls ? ((runs / balls) * 100).toFixed(1) : '0.00'; }
function rrr(target, runs, totalOvers, lb) {
  const rem = target - runs, remB = totalOvers * 6 - lb;
  if (remB <= 0) return '∞';
  if (rem  <= 0) return '0.00';
  return ((rem / remB) * 6).toFixed(2);
}

function BallChip({ code }) {
  if (!code) return null;
  const styles = {
    base: 'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium border',
    '4':  'bg-green-50 text-green-800 border-green-200',
    '6':  'bg-amber-50 text-amber-800 border-amber-200',
    W:    'bg-red-50 text-red-800 border-red-200',
    Wd:   'bg-blue-50 text-blue-800 border-blue-200',
    NB:   'bg-blue-50 text-blue-800 border-blue-200',
    '•':  'bg-gray-100 text-gray-500 border-gray-200',
    def:  'bg-white text-gray-800 border-gray-200',
  };
  const key = code.startsWith('Wd') ? 'Wd'
            : code.startsWith('NB') ? 'NB'
            : (styles[code] ? code : 'def');
  return (
    <span className={`${styles.base} ${styles[key]}`}>{code}</span>
  );
}

export default function ScoreboardPage() {
  const [match, setMatch] = useState(null);
  const [conn,  setConn]  = useState('connecting');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    setIsAdmin(!!sessionStorage.getItem('admin_token'));
    function connect() {
      setConn('connecting');
      const es = new EventSource('/api/stream');
      esRef.current = es;
      es.onopen    = () => setConn('live');
      es.onmessage = (e) => { setMatch(JSON.parse(e.data)); setConn('live'); };
      es.onerror   = () => { setConn('reconnecting'); es.close(); setTimeout(connect, 3000); };
    }
    connect();
    return () => esRef.current?.close();
  }, []);

  function handleLoginSuccess() {
    setIsAdmin(true);
    setShowAdminModal(false);
    window.location.href = '/admin/dashboard';
  }

  const inn     = match ? (match.status === 'innings2' ? match.inn2 : match.inn1) : null;
  const isInn2  = match?.status === 'innings2';
  const isDone  = match?.status === 'completed';
  const isBreak = match?.status === 'innings_break';
  const isLive  = match?.status === 'innings1' || match?.status === 'innings2';
  const runsNeeded = isInn2 && match?.target ? match.target - (match.inn2?.runs ?? 0) : null;
  const ballsLeft  = isInn2 && match?.target ? match.totalOvers * 6 - (match.inn2?.lb ?? 0) : null;
  const extras  = inn?.extras;
  const extTotal = extras ? (extras.wides + extras.noBalls + extras.byes + extras.legByes) : 0;

  return (
    <div className="min-h-screen bg-white">

      {/* Top nav — Google style */}
      <nav className="border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 bg-white z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏏</span>
          <span className="font-medium text-gray-800 text-sm">CricBoard</span>
        </div>
        <div className="flex items-center gap-3">
          <ConnDot status={conn} />
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <a href="/admin/dashboard"
                className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors">
                Dashboard
              </a>
              <button onClick={() => { sessionStorage.removeItem('admin_token'); setIsAdmin(false); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-full transition-colors">
                Sign out
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAdminModal(true)}
              className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors">
              Admin
            </button>
          )}
        </div>
      </nav>

      {showAdminModal && (
        <AdminModal onClose={() => setShowAdminModal(false)} onSuccess={handleLoginSuccess} />
      )}

      {!match || match.error ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="text-4xl">🏏</div>
          <p className="text-gray-800 font-medium">No live match</p>
          <p className="text-gray-500 text-sm">Waiting for admin to start a match</p>
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

          {/* Match header */}
          <div>
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">
              {match.team1} vs {match.team2} · {match.totalOvers} overs
            </p>
            {isDone && match.result && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-3">
                <p className="text-amber-800 font-medium text-sm">🏆 {match.result}</p>
              </div>
            )}
            {isBreak && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-3">
                <p className="text-blue-800 text-sm font-medium">
                  Innings break — {match.inn2?.battingTeam ?? ''} need{' '}
                  <strong>{match.target}</strong> to win
                </p>
              </div>
            )}
          </div>

          {/* Score */}
          {inn && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{inn.battingTeam}</p>
                  <p className="text-5xl font-light text-gray-900 leading-none tracking-tight">
                    {inn.runs}
                    <span className="text-3xl text-gray-400">/{inn.wickets}</span>
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {oStr(inn.lb)} ov{match.totalOvers ? ` / ${match.totalOvers}` : ''}&ensp;·&ensp;RR {rr(inn.runs, inn.lb)}
                  </p>
                </div>
                {isInn2 && match.target && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Target</p>
                    <p className="text-3xl font-light text-blue-600">{match.target}</p>
                    {runsNeeded > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Need <strong className="text-gray-800">{runsNeeded}</strong> in{' '}
                        <strong className="text-gray-800">{ballsLeft}</strong> balls
                      </p>
                    )}
                  </div>
                )}
              </div>

              {isInn2 && match.target && runsNeeded > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Req RR',     value: rrr(match.target, inn.runs, match.totalOvers, inn.lb), color: 'text-blue-600' },
                    { label: 'Need',       value: runsNeeded, color: 'text-gray-800' },
                    { label: 'Balls left', value: ballsLeft,  color: 'text-gray-800' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className={`text-lg font-medium ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {isLive && inn.currentOver.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">This over</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {inn.currentOver.map((c, i) => <BallChip key={i} code={c} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batsmen */}
          {isLive && inn && (inn.striker?.name || inn.nonStriker?.name) && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <p className="text-xs text-gray-400 px-4 pt-3 pb-1 uppercase tracking-wide">Batting</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left px-4 py-1.5 font-normal">Batter</th>
                    <th className="px-3 py-1.5 font-normal">R</th>
                    <th className="px-3 py-1.5 font-normal">B</th>
                    <th className="px-3 py-1.5 font-normal">4s</th>
                    <th className="px-3 py-1.5 font-normal">6s</th>
                    <th className="px-3 py-1.5 font-normal">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {[{ b: inn.striker, isStriker: true }, { b: inn.nonStriker }].map(({ b, isStriker }) =>
                    b?.name ? (
                      <tr key={b.name} className="border-t border-gray-100">
                        <td className="px-4 py-3">
                          {b.name}
                          {isStriker && <span className="ml-1 text-blue-500 text-xs">*</span>}
                        </td>
                        <td className="text-center px-3 py-3 font-medium">{b.runs}</td>
                        <td className="text-center px-3 py-3 text-gray-500">{b.balls}</td>
                        <td className="text-center px-3 py-3 text-green-700">{b.fours}</td>
                        <td className="text-center px-3 py-3 text-amber-700">{b.sixes}</td>
                        <td className="text-center px-3 py-3 text-gray-500 text-xs">{sr(b.runs, b.balls)}</td>
                      </tr>
                    ) : null
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Bowler */}
          {isLive && inn?.bowler?.name && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <p className="text-xs text-gray-400 px-4 pt-3 pb-1 uppercase tracking-wide">Bowling</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400">
                    <th className="text-left px-4 py-1.5 font-normal">Bowler</th>
                    <th className="px-3 py-1.5 font-normal">O</th>
                    <th className="px-3 py-1.5 font-normal">R</th>
                    <th className="px-3 py-1.5 font-normal">W</th>
                    <th className="px-3 py-1.5 font-normal">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3">{inn.bowler.name} <span className="text-blue-500 text-xs">*</span></td>
                    <td className="text-center px-3 py-3 text-gray-500">{oStr(inn.bowler.lb)}</td>
                    <td className="text-center px-3 py-3">{inn.bowler.runs}</td>
                    <td className="text-center px-3 py-3 font-medium text-red-600">{inn.bowler.wickets}</td>
                    <td className="text-center px-3 py-3 text-gray-500">{rr(inn.bowler.runs, inn.bowler.lb)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Extras */}
          {isLive && extTotal > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Extras — {extTotal}</p>
              <div className="flex gap-4 text-sm text-gray-500 flex-wrap">
                <span>W <strong className="text-gray-800">{extras.wides}</strong></span>
                <span>NB <strong className="text-gray-800">{extras.noBalls}</strong></span>
                <span>B <strong className="text-gray-800">{extras.byes}</strong></span>
                <span>LB <strong className="text-gray-800">{extras.legByes}</strong></span>
              </div>
            </div>
          )}

          {/* 1st innings summary during 2nd */}
          {isInn2 && match.inn1 && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">1st innings — {match.inn1.battingTeam}</p>
              <p className="font-medium text-gray-800">
                {match.inn1.runs}/{match.inn1.wickets}
                <span className="text-gray-400 font-normal text-sm ml-1">({oStr(match.inn1.lb)} ov)</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin login modal ─────────────────────────────────────
function AdminModal({ onClose, onSuccess }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res  = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const data = await res.json();
      if (data.ok) { sessionStorage.setItem('admin_token', data.token); onSuccess(); }
      else setErr('Wrong password');
    } catch { setErr('Server error'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-medium text-gray-900">Admin login</h2>
            <p className="text-sm text-gray-500">Scorer & match controller</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={login} className="space-y-3">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="Password" autoFocus
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-colors" />
          {err && <p className="text-red-500 text-xs">{err}</p>}
          <button type="submit" disabled={busy || !pw}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition-colors">
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <p className="text-center text-xs text-gray-400">Default: <code>cricket@123</code></p>
        </form>
      </div>
    </div>
  );
}

function ConnDot({ status }) {
  const map = { live: 'bg-green-500', connecting: 'bg-yellow-500 animate-pulse', reconnecting: 'bg-red-500 animate-pulse' };
  return <span className={`w-2 h-2 rounded-full ${map[status] || map.connecting}`} title={status} />;
}
