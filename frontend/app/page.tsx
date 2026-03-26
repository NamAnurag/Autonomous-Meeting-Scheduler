"use client";

import { useState } from "react";

type EmailItem = {
  text: string;
  details: {
    is_meeting: string;
    date: string;
    time: string;
  };
};

type AgentResult = {
  query?: string;
  emails?: EmailItem[];
  slot?: string;
  reply?: string;
  message?: string;
};

type AudioResult = {
  transcript?: string;
  actions?: {
    decisions?: string[];
    assignees?: string[];
    deadlines?: string[];
  };
};

type CalendarSlot = {
  time: string;
  status: "free" | "busy" | "suggested";
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [audio, setAudio] = useState<AudioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");
  const [realBusy, setRealBusy] = useState<[string, string][]>([]);

  const runAgent = async () => {
    if (!query.trim()) { setError("Please enter a query."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API}/agent?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.status === "success") {
        setResult(data.result);
        try {
          const calRes = await fetch(`${API}/calendar`);
          const calData = await calRes.json();
          if (calData?.busy) setRealBusy(calData.busy);
        } catch {}
      } else {
        setError(data?.error || "Backend returned an error.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const processAudio = async () => {
    setAudioLoading(true); setError("");
    try {
      const res = await fetch(`${API}/audio`);
      const data = await res.json();
      setAudio(data);
    } catch (e: any) {
      setError(e?.message || "Audio API not working.");
    } finally {
      setAudioLoading(false);
    }
  };

  const emails = result?.emails || [];
  const meetingCount = emails.filter((e) => e.details?.is_meeting === "YES").length;
  const pendingCount = Math.max(emails.length - meetingCount, 0);
  const hasMeeting = meetingCount > 0;

  const calendarSlots: CalendarSlot[] = [
    "09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"
  ].map((time): CalendarSlot => {
    const slotFromResult = result?.slot?.split(" ")[1] ?? "";
    const isReallyBusy = realBusy.some(([start]) => {
      if (!start) return false;
      try {
        const h = new Date(start).getHours();
        return `${String(h).padStart(2, "0")}:00` === time;
      } catch { return false; }
    });
    const status: CalendarSlot["status"] =
      result?.slot && time === slotFromResult ? "suggested"
      : isReallyBusy ? "busy" : "free";
    return { time, status };
  });

  const briefText = hasMeeting
    ? `Meeting request detected. Slot ${result?.slot || "N/A"} proposed. Reply drafted and ready. Focus time preserved outside this window.`
    : `No meeting requests detected. Focus time preserved. No unnecessary scheduling overhead introduced.`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #050810;
          color: #e2e8f0;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          background: #050810;
          background-image:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 80% 80%, rgba(16,185,129,0.06) 0%, transparent 50%);
          padding: 0;
        }

        /* TOP NAV */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 48px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          background: rgba(5,8,16,0.8);
          backdrop-filter: blur(20px);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-logo {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .nav-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 17px;
          letter-spacing: -0.3px;
          color: #f1f5f9;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #10b981; }
          50% { opacity: 0.5; box-shadow: 0 0 16px #10b981; }
        }

        .nav-user {
          font-size: 13px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-avatar {
          width: 28px;
          height: 28px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          color: white;
        }

        /* MAIN CONTENT */
        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 48px 48px 80px;
        }

        /* HERO */
        .hero {
          margin-bottom: 40px;
        }

        .hero-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #10b981;
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.2);
          padding: 5px 12px;
          border-radius: 99px;
          margin-bottom: 20px;
        }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: 42px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -1px;
          color: #f8fafc;
          margin-bottom: 12px;
        }

        .hero-title span {
          background: linear-gradient(135deg, #6366f1, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
          max-width: 520px;
        }

        /* SEARCH BAR */
        .search-wrap {
          display: flex;
          gap: 0;
          margin-bottom: 40px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-wrap:focus-within {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .search-icon {
          display: flex;
          align-items: center;
          padding: 0 16px;
          color: #475569;
          font-size: 16px;
          flex-shrink: 0;
        }

        .search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          padding: 16px 0;
          font-size: 15px;
          font-family: 'DM Sans', sans-serif;
          color: #e2e8f0;
        }

        .search-input::placeholder { color: #334155; }

        .search-btn {
          margin: 6px;
          padding: 10px 24px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s, transform 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ERROR */
        .error-bar {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 24px;
        }

        /* GRID LAYOUT */
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        @media (max-width: 900px) {
          .grid-2, .grid-3 { grid-template-columns: 1fr; }
          .main { padding: 24px 20px; }
          .nav { padding: 14px 20px; }
          .hero-title { font-size: 28px; }
        }

        /* PANEL */
        .panel {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
          transition: border-color 0.2s;
        }

        .panel:hover { border-color: rgba(255,255,255,0.12); }

        .panel-full {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 16px;
          transition: border-color 0.2s;
        }

        .panel-full:hover { border-color: rgba(255,255,255,0.12); }

        .panel-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #475569;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .panel-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.05);
        }

        .panel-title {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #f1f5f9;
          margin-bottom: 6px;
        }

        /* EMPTY STATE */
        .empty-state {
          text-align: center;
          padding: 80px 24px;
          border: 1px dashed rgba(255,255,255,0.06);
          border-radius: 16px;
          margin-bottom: 16px;
        }

        .empty-glyph {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.4;
        }

        .empty-heading {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #334155;
          margin-bottom: 8px;
        }

        .empty-body {
          font-size: 14px;
          color: #1e293b;
          max-width: 340px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* LOADING */
        .loading-state {
          text-align: center;
          padding: 60px 24px;
          border: 1px solid rgba(99,102,241,0.1);
          border-radius: 16px;
          margin-bottom: 16px;
          background: rgba(99,102,241,0.02);
        }

        .loading-spinner {
          width: 36px;
          height: 36px;
          border: 2px solid rgba(99,102,241,0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .loading-steps {
          font-size: 13px;
          color: #334155;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }

        .loading-step { color: #475569; }
        .loading-step.active { color: #6366f1; }

        /* STATUS BADGE */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 99px;
        }

        .badge-green {
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          color: #10b981;
        }

        .badge-amber {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          color: #f59e0b;
        }

        /* STAT CARDS */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        @media (max-width: 900px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }

        .stat-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 18px 20px;
        }

        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #f1f5f9;
          line-height: 1;
          margin-bottom: 6px;
        }

        .stat-label {
          font-size: 11px;
          color: #475569;
          letter-spacing: 0.5px;
        }

        /* EMAIL ROWS */
        .email-list { display: flex; flex-direction: column; gap: 6px; }

        .email-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }

        .email-row:hover { background: rgba(255,255,255,0.04); }

        .email-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.8px;
          padding: 3px 8px;
          border-radius: 5px;
          flex-shrink: 0;
          text-transform: uppercase;
        }

        .tag-meeting {
          background: rgba(16,185,129,0.12);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.2);
        }

        .tag-other {
          background: rgba(71,85,105,0.2);
          color: #475569;
          border: 1px solid rgba(71,85,105,0.2);
        }

        .email-text {
          font-size: 13px;
          color: #94a3b8;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* CALENDAR GRID */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 6px;
        }

        @media (max-width: 700px) { .cal-grid { grid-template-columns: repeat(5, 1fr); } }

        .cal-slot {
          border-radius: 10px;
          padding: 10px 6px;
          text-align: center;
          border: 1px solid transparent;
          transition: transform 0.15s;
          cursor: default;
        }

        .cal-slot:hover { transform: translateY(-2px); }

        .cal-free {
          background: rgba(255,255,255,0.03);
          border-color: rgba(255,255,255,0.06);
        }

        .cal-busy {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.15);
        }

        .cal-suggested {
          background: rgba(16,185,129,0.1);
          border-color: rgba(16,185,129,0.3);
          box-shadow: 0 0 16px rgba(16,185,129,0.1);
        }

        .cal-time {
          font-size: 12px;
          font-weight: 700;
          font-family: 'Syne', sans-serif;
          margin-bottom: 4px;
        }

        .cal-free .cal-time { color: #475569; }
        .cal-busy .cal-time { color: #f87171; }
        .cal-suggested .cal-time { color: #10b981; }

        .cal-status {
          font-size: 9px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .cal-free .cal-status { color: #334155; }
        .cal-busy .cal-status { color: rgba(248,113,113,0.7); }
        .cal-suggested .cal-status { color: rgba(16,185,129,0.8); }

        .cal-legend {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #475569;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 3px;
        }

        /* REPLY BOX */
        .reply-box {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 18px;
          font-family: 'DM Sans', monospace;
          font-size: 13px;
          line-height: 1.8;
          color: #94a3b8;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* TIMELINE */
        .timeline { display: flex; flex-direction: column; gap: 0; }

        .tl-item {
          display: flex;
          gap: 14px;
          padding-bottom: 20px;
          position: relative;
        }

        .tl-item:last-child { padding-bottom: 0; }

        .tl-item:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 13px;
          top: 28px;
          bottom: 0;
          width: 1px;
          background: rgba(255,255,255,0.06);
        }

        .tl-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 11px;
          color: #10b981;
        }

        .tl-content { flex: 1; padding-top: 3px; }

        .tl-title {
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          margin-bottom: 2px;
        }

        .tl-desc { font-size: 12px; color: #475569; }

        /* AUDIO */
        .audio-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid rgba(99,102,241,0.3);
          background: rgba(99,102,241,0.08);
          color: #818cf8;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.15s;
          margin-bottom: 16px;
        }

        .audio-btn:hover:not(:disabled) {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.5);
        }

        .audio-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .transcript-box {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 16px;
          font-size: 13px;
          line-height: 1.8;
          color: #64748b;
          margin-bottom: 12px;
          font-style: italic;
        }

        .action-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        @media (max-width: 700px) { .action-cards { grid-template-columns: 1fr; } }

        .action-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 14px;
        }

        .action-card-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #334155;
          margin-bottom: 10px;
        }

        .action-item {
          font-size: 13px;
          color: #94a3b8;
          padding: 4px 0;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          line-height: 1.5;
        }

        .action-item::before {
          content: '→';
          color: #334155;
          flex-shrink: 0;
          font-size: 11px;
          margin-top: 1px;
        }

        /* REPORT */
        .report-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 700px) { .report-grid { grid-template-columns: repeat(2, 1fr); } }

        .report-card {
          text-align: center;
          padding: 20px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .report-num {
          font-family: 'Syne', sans-serif;
          font-size: 30px;
          font-weight: 800;
          background: linear-gradient(135deg, #6366f1, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
          margin-bottom: 8px;
        }

        .report-label { font-size: 11px; color: #334155; letter-spacing: 0.5px; }

        /* SUMMARY */
        .summary-box {
          padding: 14px 18px;
          background: rgba(99,102,241,0.05);
          border: 1px solid rgba(99,102,241,0.1);
          border-radius: 12px;
          font-size: 13px;
          color: #64748b;
          line-height: 1.7;
        }

        .empty-inline {
          font-size: 13px;
          color: #1e293b;
          font-style: italic;
          padding: 8px 0;
        }

        .no-reply-box {
          font-size: 13px;
          color: #334155;
          font-style: italic;
          padding: 14px;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.04);
        }
      `}</style>

      <div className="page">
        {/* NAV */}
        <nav className="nav">
          <div className="nav-brand">
            <div className="nav-logo">🤖</div>
            <span className="nav-title">MeetingOS</span>
          </div>
          <div className="nav-right">
            <div className="status-dot" />
            <div className="nav-user">
              <div className="nav-avatar">AG</div>
              Anurag Gupta
            </div>
          </div>
        </nav>

        <div className="main">
          {/* HERO */}
          <div className="hero">
            <div className="hero-label">
              <span>⚡</span> AI-Powered Executive Assistant
            </div>
            <h1 className="hero-title">
              Your meetings,<br /><span>fully automated.</span>
            </h1>
            <p className="hero-sub">
              Monitors inbox, negotiates slots, transcribes calls, extracts action items.
              You focus — the agent handles the rest.
            </p>
          </div>

          {/* SEARCH */}
          <div className="search-wrap">
            <div className="search-icon">⌕</div>
            <input
              className="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAgent()}
              placeholder="e.g. Schedule a meeting with Ravi about Q2 roadmap..."
            />
            <button className="search-btn" onClick={runAgent} disabled={loading}>
              {loading ? (
                <><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}} /> Running</>
              ) : (
                <><span>▶</span> Run Agent</>
              )}
            </button>
          </div>

          {error && <div className="error-bar">⚠ {error}</div>}

          {/* EMPTY */}
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-glyph">📭</div>
              <div className="empty-heading">Awaiting instructions</div>
              <div className="empty-body">
                Enter a scheduling query and run the agent to analyze your inbox, check your calendar, and generate a reply.
              </div>
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <div className="loading-steps">
                <span className="loading-step active">📧 Fetching & classifying emails...</span>
                <span className="loading-step">📅 Checking calendar availability...</span>
                <span className="loading-step">✉️ Drafting negotiation reply...</span>
                <span className="loading-step">🧠 Building pre-meeting brief...</span>
              </div>
            </div>
          )}

          {/* RESULTS */}
          {result && (
            <>
              {/* STATUS + STATS */}
              <div className="panel-full">
                <div className="panel-label">📊 Pipeline Results</div>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                  <span className={`badge ${hasMeeting ? "badge-green" : "badge-amber"}`}>
                    {hasMeeting ? `✓ ${meetingCount} meeting(s) detected` : "⚠ No meetings found"}
                  </span>
                  {hasMeeting && (
                    <span style={{fontSize:12,color:"#475569"}}>{pendingCount} non-meeting email(s) filtered out</span>
                  )}
                </div>
                <div className="stat-grid">
                  <div className="stat-card">
                    <div className="stat-num">{emails.length}</div>
                    <div className="stat-label">Emails analyzed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num">{meetingCount}</div>
                    <div className="stat-label">Meetings detected</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num" style={{fontSize:16}}>{result.slot || "N/A"}</div>
                    <div className="stat-label">Suggested slot</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-num">{result.reply ? "Yes" : "No"}</div>
                    <div className="stat-label">Reply drafted</div>
                  </div>
                </div>
              </div>

              {/* EMAILS + CALENDAR */}
              <div className="grid-2">
                <div className="panel">
                  <div className="panel-label">📬 Classified Emails</div>
                  <div className="email-list">
                    {emails.map((email, i) => (
                      <div className="email-row" key={i}>
                        <span className={`email-tag ${email.details.is_meeting === "YES" ? "tag-meeting" : "tag-other"}`}>
                          {email.details.is_meeting === "YES" ? "Meeting" : "Other"}
                        </span>
                        <span className="email-text">{email.text.slice(0, 90)}{email.text.length > 90 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-label">📅 Calendar View</div>
                  <div className="cal-legend">
                    <div className="legend-item"><div className="legend-dot" style={{background:"#ef4444",opacity:0.6}} /> Busy</div>
                    <div className="legend-item"><div className="legend-dot" style={{background:"#334155"}} /> Free</div>
                    <div className="legend-item"><div className="legend-dot" style={{background:"#10b981"}} /> Suggested</div>
                  </div>
                  <div className="cal-grid">
                    {calendarSlots.map((slot) => (
                      <div key={slot.time} className={`cal-slot ${slot.status === "busy" ? "cal-busy" : slot.status === "suggested" ? "cal-suggested" : "cal-free"}`}>
                        <div className="cal-time">{slot.time}</div>
                        <div className="cal-status">
                          {slot.status === "busy" ? "Busy" : slot.status === "suggested" ? "Pick" : "Free"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* REPLY + SUMMARY */}
              <div className="grid-2">
                <div className="panel">
                  <div className="panel-label">📨 Auto-Generated Reply</div>
                  {hasMeeting ? (
                    <div className="reply-box">{result.reply || "No reply generated."}</div>
                  ) : (
                    <div className="no-reply-box">No reply generated — no meeting request detected.</div>
                  )}
                </div>

                <div className="panel">
                  <div className="panel-label">🧠 Negotiation History</div>
                  <div className="timeline">
                    <div className="tl-item">
                      <div className="tl-dot">1</div>
                      <div className="tl-content">
                        <div className="tl-title">Email classified</div>
                        <div className="tl-desc">GPT-4o-mini + Pydantic validation → {meetingCount} meeting(s) found</div>
                      </div>
                    </div>
                    <div className="tl-item">
                      <div className="tl-dot">2</div>
                      <div className="tl-content">
                        <div className="tl-title">Slot negotiated</div>
                        <div className="tl-desc">Calendar checked → {realBusy.length} conflict(s) → {result.slot || "N/A"} proposed</div>
                      </div>
                    </div>
                    <div className="tl-item">
                      <div className="tl-dot">3</div>
                      <div className="tl-content">
                        <div className="tl-title">Reply reviewed</div>
                        <div className="tl-desc">Quality gate passed → Ready to send</div>
                      </div>
                    </div>
                  </div>
                  <div className="summary-box" style={{marginTop:16}}>{briefText}</div>
                </div>
              </div>
            </>
          )}

          {/* AUDIO INSIGHTS — always visible */}
          <div className="panel-full">
            <div className="panel-label">🎤 Post-Meeting Audio Insights</div>
            <p style={{fontSize:13,color:"#334155",marginBottom:14}}>
              Transcribe <code style={{color:"#6366f1",background:"rgba(99,102,241,0.08)",padding:"2px 6px",borderRadius:4}}>sample.mp3</code> via Whisper → LangChain extracts structured action items
            </p>
            <button className="audio-btn" onClick={processAudio} disabled={audioLoading}>
              {audioLoading ? "Processing..." : "▶ Process Audio"}
            </button>

            {!audio && !audioLoading && (
              <div className="empty-inline">No audio processed yet.</div>
            )}

            {audio && (
              <>
                <div className="transcript-box">"{audio.transcript}"</div>
                <div className="action-cards">
                  <div className="action-card">
                    <div className="action-card-label">🗳 Decisions</div>
                    {audio.actions?.decisions?.length
                      ? audio.actions.decisions.map((d, i) => <div key={i} className="action-item">{d}</div>)
                      : <div style={{fontSize:12,color:"#1e293b"}}>None extracted</div>}
                  </div>
                  <div className="action-card">
                    <div className="action-card-label">👤 Assignees</div>
                    {audio.actions?.assignees?.length
                      ? audio.actions.assignees.map((a, i) => <div key={i} className="action-item">{a}</div>)
                      : <div style={{fontSize:12,color:"#1e293b"}}>None extracted</div>}
                  </div>
                  <div className="action-card">
                    <div className="action-card-label">⏳ Deadlines</div>
                    {audio.actions?.deadlines?.length
                      ? audio.actions.deadlines.map((d, i) => <div key={i} className="action-item">{d}</div>)
                      : <div style={{fontSize:12,color:"#1e293b"}}>None extracted</div>}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* WEEKLY REPORT */}
          <div className="panel-full">
            <div className="panel-label">📁 Weekly Productivity Report</div>
            <div className="report-grid">
              <div className="report-card">
                <div className="report-num">{result ? meetingCount : "—"}</div>
                <div className="report-label">Meetings Scheduled</div>
              </div>
              <div className="report-card">
                <div className="report-num">{result ? emails.length : "—"}</div>
                <div className="report-label">Emails Processed</div>
              </div>
              <div className="report-card">
                <div className="report-num">
                  {audio?.actions ? (audio.actions.decisions?.length || 0) + (audio.actions.assignees?.length || 0) : "—"}
                </div>
                <div className="report-label">Action Items Extracted</div>
              </div>
              <div className="report-card">
                <div className="report-num">{result ? "2.5h" : "—"}</div>
                <div className="report-label">Focus Time Saved</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}