'use client';

import { useEffect, useState, useRef } from 'react';

// ── Ball chip helper ─────────────────────────────────────
function BallChip({ code }) {
  if (!code) return null;
  let cls = 'ball-dot';
  if (code === '4')                            cls = 'ball-four';
  else if (code === '6')                       cls = 'ball-six';
  else if (code === 'W' || code.endsWith('W')) cls = 'ball-wkt';
  else if (code.startsWith('Wd'))              cls = 'ball-wide';
  else if (code.startsWith('NB'))              cls = 'ball-nb';
  else if (code.startsWith('B') || code.startsWith('LB')) cls = 'ball-bye';
  else if (code !== '•')                       cls = 'ball-runs';

  return (
    <span className={`${cls} inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold font-mono`}>
      {code}
    </span>
  );
}

function sr(runs, balls) {
  if (!balls) return '0.00';
  return ((runs / balls) * 100).toFixed(1);
}

function oStr(lb = 0) {
  return `${Math.floor(lb / 6)}.${lb % 6}`;
}

function rr(runs, lb) {
  if (!lb) return '0.00';
  return ((runs / lb) * 6).toFixed(2);
}

function rrr(target, currRuns, totalOvers, lb) {
  const rem  = target - currRuns;
  const remB = totalOvers * 6 - lb;
  if (remB <= 0) return '∞';
  if (rem  <= 0) return '0.00';
  return ((rem / remB) * 6).toFixed(2);
}

// ── Inline Admin Login Modal ─────────────────────────────
function AdminLoginModal({ onClose, onSuccess }) {
  const [pw,   setPw]   = useState('');
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  async function login(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res  = await fetch('/api/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('admin_token', data.token);
        onSuccess();
      } else {
        setErr('Wrong password. Try again.');
      }
    } catch {
      setErr('Server error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="w-full max-w-sm bg-pitch-900 border border-pitch-700 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Admin Login</h2>
            <p className="text-pitch-500 text-xs mt-0.5">Scorer & Match Controller</p>
          </div>
          <button
            onClick={onClose}
            className="text-pitch-600 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-pitch-400 uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter admin password"
              className="w-full bg-pitch-950 border border-pitch-700 focus:border-pitch-400 rounded-xl px-4 py-3 text-white text-sm outline-none transition-colors placeholder-pitch-700"
              autoFocus
            />
          </div>

          {err && (
            <p className="text-red-400 text-xs bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !pw}
            className="w-full bg-pitch-400 hover:bg-pitch-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl text-sm transition-colors"
          >
            {busy ? 'Checking…' : 'Login →'}
          </button>

          <p className="text-center text-pitch-600 text-xs">
            Default: <code className="text-pitch-500">cricket@123</code>
          </p>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export default function ScoreboardPage() {
  const [match,      setMatch]      = useState(null);
  const [conn,       setConn]       = useState('connecting');
  const [showLogin,  setShowLogin]  = useState(false);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const scoreKey = useRef(0);
  const esRef    = useRef(null);

  // Check if already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAdmin(!!sessionStorage.getItem('admin_token'));
    }
  }, []);

  useEffect(() => {
    function connect() {
      setConn('connecting');
      const es = new EventSource('/api/stream');
      esRef.current = es;
      es.onopen    = () => setConn('live');
      es.onmessage = (e) => {
        setMatch(JSON.parse(e.data));
        scoreKey.current += 1;
        setConn('live');
      };
      es.onerror = () => {
        setConn('reconnecting');
        es.close();
        setTimeout(connect, 3000);
      };
    }
    connect();
    return () => esRef.current?.close();
  }, []);

  function handleLoginSuccess() {
    setIsAdmin(true);
    setShowLogin(false);
    window.location.href = '/admin/dashboard';
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_token');
    setIsAdmin(false);
  }

  // ── No match ─────────────────────────────────────────
  if (!match) {
    return (
      <div className="min-h-screen bg-pitch-950 flex flex-col items-center justify-center gap-5 p-6">
        {/* Admin button top-right even on empty state */}
        <div className="fixed top-4 right-4 z-30">
          <AdminButton
            isAdmin={isAdmin}
            onLoginClick={() => setShowLogin(true)}
            onDashboard={() => { window.location.href = '/admin/dashboard'; }}
            onLogout={handleLogout}
          />
        </div>

        <div className="w-16 h-16 rounded-full bg-pitch-800 border-2 border-pitch-600 flex items-center justify-center text-3xl">
          🏏
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">No Live Match</h1>
          <p className="text-slate-500 text-sm">Waiting for admin to start a match…</p>
        </div>
        <ConnBadge status={conn} />

        {showLogin && (
          <AdminLoginModal
            onClose={() => setShowLogin(false)}
            onSuccess={handleLoginSuccess}
          />
        )}
      </div>
    );
  }

  const { team1, team2, totalOvers, status, inn1, inn2, target, result } = match;
  const currentInn = status === 'innings2' ? inn2 : inn1;
  if (!currentInn) return null;

  const isInn2  = status === 'innings2';
  const isDone  = status === 'completed';
  const isBreak = status === 'innings_break';
  const isLive  = status === 'innings1' || status === 'innings2';
  const extras  = currentInn.extras;
  const extTotal = (extras.wides || 0) + (extras.noBalls || 0) + (extras.byes || 0) + (extras.legByes || 0);

  const runsNeeded = target ? target - (inn2?.runs ?? 0) : null;
  const ballsLeft  = target ? totalOvers * 6 - (inn2?.lb ?? 0) : null;
  const oversLeft  = ballsLeft != null ? `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}` : null;

  return (
    <div className="min-h-screen bg-pitch-950 flex flex-col">

      {/* ── Header ── */}
      <header className="bg-pitch-900 border-b border-pitch-700 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        {/* Left: branding */}
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏏</span>
          <div>
            <p className="text-xs text-pitch-300 font-semibold tracking-wider uppercase">Live Cricket</p>
            <p className="text-white font-bold text-sm leading-none mt-0.5">
              {team1} <span className="text-pitch-500 mx-1 font-normal">vs</span> {team2}
            </p>
          </div>
        </div>

        {/* Right: connection + admin button */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1.5">
            <ConnBadge status={conn} />
            {isLive && (
              <span className="text-[10px] text-pitch-400 font-medium">
                {totalOvers} overs match
              </span>
            )}
          </div>

          {/* ── Admin Button ── */}
          <AdminButton
            isAdmin={isAdmin}
            onLoginClick={() => setShowLogin(true)}
            onDashboard={() => { window.location.href = '/admin/dashboard'; }}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* ── Admin Login Modal ── */}
      {showLogin && (
        <AdminLoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      )}

      {/* ── Match Result ── */}
      {isDone && result && (
        <div className="bg-gradient-to-r from-yellow-900/60 to-pitch-900 border-b border-yellow-700/40 px-4 py-3 text-center">
          <p className="text-yellow-300 font-bold text-base">🏆 {result}</p>
        </div>
      )}

      {/* ── Innings Break ── */}
      {isBreak && (
        <div className="bg-pitch-800 border-b border-pitch-600 px-4 py-3 text-center">
          <p className="text-pitch-300 font-semibold text-sm">
            ⏸ Innings Break — {inn2?.battingTeam ?? team2} needs{' '}
            <span className="text-white font-bold">{target}</span> to win
          </p>
        </div>
      )}

      <div className="flex-1 px-3 py-4 space-y-3 max-w-lg mx-auto w-full">

        {/* ── Score Card ── */}
        <div className="bg-pitch-900 rounded-2xl border border-pitch-700 overflow-hidden">
          <div className="flex border-b border-pitch-700">
            <InnTab label={`${inn1.battingTeam} — 1st Innings`} active={!isInn2 && !isDone} done={isInn2 || isDone} />
            {(isInn2 || isDone) && inn2 && (
              <InnTab label={`${inn2.battingTeam} — 2nd Innings`} active={isInn2} done={isDone} />
            )}
          </div>

          <div className="px-5 py-4">
            <div className="flex items-end justify-between">
              <div key={scoreKey.current} className="score-animate">
                <p className="text-5xl font-black text-white tracking-tight leading-none">
                  {currentInn.runs}
                  <span className="text-3xl text-pitch-400 font-bold">/{currentInn.wickets}</span>
                </p>
                <p className="text-pitch-300 text-sm font-semibold mt-1">
                  {oStr(currentInn.lb)} Overs{totalOvers ? ` / ${totalOvers}` : ''}
                  <span className="text-pitch-500 ml-2 font-mono text-xs">
                    RR {rr(currentInn.runs, currentInn.lb)}
                  </span>
                </p>
              </div>

              {isInn2 && target && inn2 && (
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-0.5">TARGET</p>
                  <p className="text-3xl font-black text-yellow-400">{target}</p>
                  {runsNeeded > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Need <span className="text-white font-bold">{runsNeeded}</span> in{' '}
                      <span className="text-white font-bold">{oversLeft}</span> ov
                    </p>
                  )}
                </div>
              )}
            </div>

            {isInn2 && target && inn2 && runsNeeded > 0 && (
              <div className="mt-3 bg-pitch-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <Stat label="Required RR" value={rrr(target, inn2.runs, totalOvers, inn2.lb)} color="text-yellow-400" />
                <Stat label="Runs Needed" value={runsNeeded} color="text-white" />
                <Stat label="Balls Left"  value={ballsLeft}  color="text-white" />
              </div>
            )}
          </div>

          {isLive && currentInn.currentOver.length > 0 && (
            <div className="border-t border-pitch-700 px-5 py-3">
              <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-2.5">
                This Over
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentInn.currentOver.map((c, i) => <BallChip key={i} code={c} />)}
              </div>
            </div>
          )}
        </div>

        {/* ── Batsmen ── */}
        {isLive && (currentInn.striker.name || currentInn.nonStriker.name) && (
          <div className="bg-pitch-900 rounded-2xl border border-pitch-700 overflow-hidden">
            <div className="px-4 pt-3 pb-1.5 border-b border-pitch-800">
              <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest">
                Batting — {currentInn.battingTeam}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-pitch-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-1.5 font-semibold">Batsman</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">R</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">B</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">4s</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">6s</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-14">SR</th>
                </tr>
              </thead>
              <tbody>
                <BatsmanRow b={currentInn.striker}    isStriker />
                <BatsmanRow b={currentInn.nonStriker} />
              </tbody>
            </table>
          </div>
        )}

        {/* ── Bowler ── */}
        {isLive && currentInn.bowler.name && (
          <div className="bg-pitch-900 rounded-2xl border border-pitch-700 overflow-hidden">
            <div className="px-4 pt-3 pb-1.5 border-b border-pitch-800">
              <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest">
                Bowling — {currentInn.bowlingTeam}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-pitch-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-1.5 font-semibold">Bowler</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-12">Ov</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">R</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-10">W</th>
                  <th className="text-center px-2 py-1.5 font-semibold w-14">Econ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-pitch-800">
                  <td className="px-4 py-3 font-semibold text-white">
                    {currentInn.bowler.name}
                    <span className="ml-1.5 text-pitch-400 text-xs">★</span>
                  </td>
                  <td className="text-center px-2 py-3 font-mono text-slate-300">{oStr(currentInn.bowler.lb)}</td>
                  <td className="text-center px-2 py-3 text-slate-300">{currentInn.bowler.runs}</td>
                  <td className="text-center px-2 py-3 font-bold text-red-400">{currentInn.bowler.wickets}</td>
                  <td className="text-center px-2 py-3 font-mono text-slate-400">
                    {rr(currentInn.bowler.runs, currentInn.bowler.lb)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Last 12 balls ── */}
        {isLive && currentInn.lastBalls.length > 0 && (
          <div className="bg-pitch-900 rounded-2xl border border-pitch-700 px-4 py-3">
            <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-2.5">
              Recent Deliveries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...currentInn.lastBalls].reverse().slice(0, 12).reverse().map((c, i) => (
                <BallChip key={i} code={c} />
              ))}
            </div>
          </div>
        )}

        {/* ── Extras ── */}
        {isLive && extTotal > 0 && (
          <div className="bg-pitch-900 rounded-2xl border border-pitch-700 px-4 py-3">
            <p className="text-[10px] font-bold text-pitch-500 uppercase tracking-widest mb-2">
              Extras — {extTotal}
            </p>
            <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
              <span>Wides:    <b className="text-white">{extras.wides    || 0}</b></span>
              <span>No Balls: <b className="text-white">{extras.noBalls  || 0}</b></span>
              <span>Byes:     <b className="text-white">{extras.byes     || 0}</b></span>
              <span>Leg Byes: <b className="text-white">{extras.legByes  || 0}</b></span>
            </div>
          </div>
        )}

        {/* ── 1st Innings summary (during 2nd innings) ── */}
        {isInn2 && inn1 && (
          <div className="bg-pitch-900/60 rounded-2xl border border-pitch-800 px-4 py-3">
            <p className="text-[10px] font-bold text-pitch-600 uppercase tracking-widest mb-1.5">
              1st Innings — {inn1.battingTeam}
            </p>
            <p className="text-white font-bold">
              {inn1.runs}/{inn1.wickets}{' '}
              <span className="text-pitch-500 font-normal text-sm">({oStr(inn1.lb)} ov)</span>
            </p>
          </div>
        )}

        <div className="pb-6" />
      </div>
    </div>
  );
}

// ── Admin Button Component ────────────────────────────────
// Shows "Admin Login" if not logged in, or "Dashboard" + "Logout" if logged in
function AdminButton({ isAdmin, onLoginClick, onDashboard, onLogout }) {
  if (isAdmin) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={onDashboard}
          className="bg-green-800 hover:bg-green-700 text-green-200 border border-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
        >
          ⚙ Dashboard
        </button>
        <button
          onClick={onLogout}
          className="text-pitch-600 hover:text-red-400 text-xs font-medium px-2 py-1.5 rounded-lg transition-colors"
          title="Logout"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onLoginClick}
      className="bg-pitch-800 hover:bg-pitch-700 text-pitch-300 hover:text-white border border-pitch-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
    >
      👤 Admin
    </button>
  );
}

// ── Sub-components ────────────────────────────────────────
function ConnBadge({ status }) {
  const map = {
    live:         { dot: 'bg-green-400 live-dot',        text: 'Live',         color: 'text-green-400'  },
    connecting:   { dot: 'bg-yellow-400 animate-pulse',  text: 'Connecting',   color: 'text-yellow-400' },
    reconnecting: { dot: 'bg-red-400 animate-pulse',     text: 'Reconnecting', color: 'text-red-400'    },
  };
  const s = map[status] || map.connecting;
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-[10px] font-semibold ${s.color}`}>{s.text}</span>
    </div>
  );
}

function InnTab({ label, active, done }) {
  return (
    <div className={`flex-1 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
      active ? 'border-green-500 text-white bg-pitch-800/50'
             : done  ? 'border-transparent text-pitch-500'
                     : 'border-transparent text-pitch-600'
    }`}>
      {label}
    </div>
  );
}

function BatsmanRow({ b, isStriker }) {
  if (!b?.name) return null;
  return (
    <tr className="border-t border-pitch-800">
      <td className="px-4 py-3 font-semibold text-white">
        {b.name}
        {isStriker && <span className="ml-1.5 text-green-400 text-xs font-bold">★</span>}
      </td>
      <td className="text-center px-2 py-3 font-bold text-white">{b.runs}</td>
      <td className="text-center px-2 py-3 text-slate-400 font-mono">{b.balls}</td>
      <td className="text-center px-2 py-3 text-blue-400">{b.fours}</td>
      <td className="text-center px-2 py-3 text-yellow-400">{b.sixes}</td>
      <td className="text-center px-2 py-3 font-mono text-slate-400 text-xs">{sr(b.runs, b.balls)}</td>
    </tr>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <p className={`font-bold text-lg leading-none ${color}`}>{value}</p>
      <p className="text-[10px] text-pitch-500 mt-0.5">{label}</p>
    </div>
  );
}