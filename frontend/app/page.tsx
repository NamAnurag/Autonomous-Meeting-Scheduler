"use client";

import { useState, useEffect, useRef } from "react";

type EmailItem = {
  text: string;
  details: { is_meeting: string; date: string; time: string; };
};
type AgentResult = {
  query?: string; emails?: EmailItem[]; slot?: string; reply?: string; message?: string;
};
type AudioResult = {
  transcript?: string;
  actions?: { decisions?: string[]; assignees?: string[]; deadlines?: string[]; };
};
type CalendarSlot = { time: string; status: "free" | "busy" | "suggested"; };

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [audio, setAudio] = useState<AudioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");
  const [realBusy, setRealBusy] = useState<[string, string][]>([]);
  const [step, setStep] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Mouse tracking
  useEffect(() => {
    const move = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  // Canvas particle system with mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#06b6d4"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      radius: number; color: string; alpha: number;
      pulse: number; pulseSpeed: number;
    }[] = [];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }

    let time = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.01;

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const op = 0.08 * (1 - dist / 150) * (0.5 + Math.sin(time + dist * 0.02) * 0.3);
            ctx.strokeStyle = `rgba(139,92,246,${op})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Particles
      particles.forEach(p => {
        // Mouse repulsion
        const mx = mousePosRef.current.x;
        const my = mousePosRef.current.y;
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const angle = Math.atan2(dy, dx);
          const force = (150 - dist) / 150 * 0.8;
          p.vx += Math.cos(angle) * force * 0.2;
          p.vy += Math.sin(angle) * force * 0.2;
        }

        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.99; p.vy *= 0.99;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        p.pulse += p.pulseSpeed;
        const alpha = p.alpha * (0.6 + Math.sin(p.pulse) * 0.4);
        const hex = Math.floor(alpha * 255).toString(16).padStart(2, "0");

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color + hex;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + "20";
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, []);

  // Loading step animation
  useEffect(() => {
    if (!loading) { setStep(0); return; }
    const t = setInterval(() => setStep(s => (s + 1) % 4), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const runAgent = async () => {
    if (!query.trim()) { setError("Please enter a query."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch(`${API}/agent?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.status === "success") {
        setResult(data.result);
        try {
          const cal = await fetch(`${API}/calendar`);
          const calData = await cal.json();
          if (calData?.busy) setRealBusy(calData.busy);
        } catch {}
      } else { setError(data?.error || "Backend returned an error."); }
    } catch (e: any) { setError(e?.message || "Could not connect to backend."); }
    finally { setLoading(false); }
  };

  const processAudio = async () => {
    setAudioLoading(true); setError("");
    try {
      const res = await fetch(`${API}/audio`);
      const data = await res.json();
      setAudio(data);
    } catch (e: any) { setError(e?.message || "Audio API not working."); }
    finally { setAudioLoading(false); }
  };

  const emails = result?.emails || [];
  const meetingCount = emails.filter(e => e.details?.is_meeting === "YES").length;
  const hasMeeting = meetingCount > 0;

  const calSlots: CalendarSlot[] = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(time => {
    const slotTime = result?.slot?.split(" ")[1] ?? "";
    const isBusy = realBusy.some(([start]) => {
      try { return `${String(new Date(start).getHours()).padStart(2,"0")}:00` === time; } catch { return false; }
    });
    return { time, status: result?.slot && time === slotTime ? "suggested" : isBusy ? "busy" : "free" };
  });

  const steps = ["📧 Scanning inbox...", "📅 Analyzing calendar...", "✉️ Crafting reply...", "🧠 Generating insights..."];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; background: #0a0a1a; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg,#6366f1,#a855f7); border-radius: 10px; }

        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes borderFlow {
          0%   { background-position: 0%   50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes spinSlow  { to { transform: rotate(360deg); } }
        @keyframes pulseGlow {
          0%,100% { opacity:.4; transform:scale(1); }
          50%      { opacity:.9; transform:scale(1.07); }
        }
        @keyframes slideUpFade {
          from { opacity:0; transform:translateY(40px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes hologramScan {
          0%   { transform:translateY(-100%); opacity:0; }
          50%  { opacity:.4; }
          100% { transform:translateY(200%); opacity:0; }
        }
        @keyframes floatSlow {
          0%,100% { transform:translateY(0px) rotate(0deg); }
          50%      { transform:translateY(-20px) rotate(2deg); }
        }
        @keyframes cardReveal {
          from { opacity:0; transform:translateY(16px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.5), 0 0 40px rgba(99,102,241,0.2); }
          50%      { box-shadow: 0 0 40px rgba(99,102,241,0.9), 0 0 80px rgba(99,102,241,0.4), 0 0 120px rgba(168,85,247,0.2); }
        }
        @keyframes glowGreen {
          0%,100% { box-shadow: 0 0 20px rgba(6,182,212,0.5), 0 0 40px rgba(6,182,212,0.2); }
          50%      { box-shadow: 0 0 40px rgba(6,182,212,0.9), 0 0 80px rgba(16,185,129,0.4); }
        }
        @keyframes textGlitch {
          0%,100% { text-shadow: none; }
          33%      { text-shadow: -2px 0 #ec4899, 2px 0 #06b6d4; }
          66%      { text-shadow: 2px 0 #ec4899, -2px 0 #06b6d4; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes suggestedPulse {
          0%,100% { box-shadow: 0 0 14px rgba(16,185,129,0.4); }
          50%      { box-shadow: 0 0 28px rgba(16,185,129,0.8), 0 0 50px rgba(16,185,129,0.3); }
        }

        .hover-card {
          transition: all 0.3s cubic-bezier(0.2,0.9,0.4,1.1);
        }
        .hover-card:hover {
          border-color: rgba(139,92,246,0.55) !important;
          box-shadow: 0 0 28px rgba(139,92,246,0.2), 0 8px 32px rgba(0,0,0,0.4) !important;
          transform: translateY(-3px);
        }
        .btn-run {
          transition: all 0.2s ease;
          animation: glowPulse 2.5s ease-in-out infinite;
        }
        .btn-run:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 0 60px rgba(99,102,241,1), 0 0 120px rgba(168,85,247,0.6) !important;
          animation: none;
        }
        .btn-run:active { transform: scale(0.97); }
        .btn-audio {
          transition: all 0.2s ease;
          animation: glowGreen 2.5s ease-in-out infinite;
        }
        .btn-audio:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.03);
        }
        .email-row { transition: all 0.18s ease; }
        .email-row:hover {
          background: rgba(139,92,246,0.08) !important;
          padding-left: 20px !important;
        }
        .slot-chip { transition: all 0.18s ease; }
        .slot-chip:hover { transform: scale(1.1); z-index: 2; }
        .stat-card { transition: all 0.25s ease; }
        .stat-card:hover { transform: translateY(-5px) scale(1.02); border-color: rgba(168,85,247,0.5) !important; }
        .section-bar { display:flex; align-items:center; gap:12px; margin-bottom:18px; }
        .bar-accent { width:4px; border-radius:4px; }
      `}</style>

      {/* ── CANVAS ── */}
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />

      {/* ── AMBIENT ORBS ── */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        {[
          { w:600, c:"rgba(99,102,241,0.4)",  t:"-200px", l:"-200px", d:"25s", blur:80 },
          { w:500, c:"rgba(139,92,246,0.35)", t:"50%",    l:"70%",    d:"30s", blur:100, delay:"2s" },
          { w:450, c:"rgba(236,72,153,0.25)", t:"80%",    l:"10%",    d:"22s", blur:90,  delay:"1s" },
          { w:350, c:"rgba(6,182,212,0.2)",   t:"20%",    l:"85%",    d:"28s", blur:70,  delay:"3s" },
        ].map((o, i) => (
          <div key={i} style={{
            position:"absolute", width:o.w, height:o.w, borderRadius:"50%",
            background:`radial-gradient(circle, ${o.c} 0%, transparent 70%)`,
            top:o.t, left:o.l,
            filter:`blur(${o.blur}px)`,
            animation:`floatSlow ${o.d} ease-in-out infinite`,
            animationDelay: (o as any).delay || "0s",
            opacity:0.5,
          }} />
        ))}
      </div>

      {/* ── HOLOGRAM SCAN LINE ── */}
      <div style={{
        position:"fixed", top:0, left:0, width:"100%", height:4, zIndex:100, pointerEvents:"none",
        background:"linear-gradient(90deg, transparent, #6366f1, #a855f7, #ec4899, transparent)",
        animation:"hologramScan 8s linear infinite", opacity:0.5,
      }} />

      {/* ── MOUSE GLOW ── */}
      <div style={{
        position:"fixed", width:500, height:500, borderRadius:"50%", zIndex:1, pointerEvents:"none",
        background:"radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        transform:`translate(${mousePos.x - 250}px, ${mousePos.y - 250}px)`,
        transition:"transform 0.1s ease-out",
      }} />

      {/* ── PAGE ── */}
      <div style={{
        minHeight:"100vh", background:"#0a0a1a",
        fontFamily:"'Outfit', sans-serif",
        position:"relative", zIndex:2,
      }}>

        {/* ── NAV ── */}
        <nav style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 40px", height:70,
          background:"rgba(10,10,26,0.75)",
          backdropFilter:"blur(20px) saturate(180%)",
          borderBottom:"1px solid rgba(139,92,246,0.2)",
          position:"sticky", top:0, zIndex:100,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative", width:40, height:40 }}>
              <div style={{
                position:"absolute", inset:0, borderRadius:12,
                background:"linear-gradient(135deg,#6366f1,#a855f7,#ec4899)",
                animation:"spinSlow 4s linear infinite",
              }} />
              <div style={{
                position:"absolute", inset:2, borderRadius:10,
                background:"#0a0a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
              }}>⚡</div>
            </div>
            <div>
              <div style={{
                fontWeight:800, fontSize:18,
                background:"linear-gradient(135deg,#fff,#a855f7)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>MeetingOS</div>
              <div style={{ fontSize:10, color:"#8b5cf6", letterSpacing:"0.1em", fontWeight:600 }}>AI EXECUTIVE</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:16, alignItems:"center" }}>
            <div style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"6px 16px", borderRadius:40,
              background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)",
            }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#10b981", boxShadow:"0 0 8px #10b981", animation:"pulseGlow 1.5s infinite" }} />
              <span style={{ fontSize:12, fontWeight:600, color:"#10b981" }}>SYSTEM ACTIVE</span>
            </div>
            <div style={{
              padding:"6px 16px", borderRadius:40,
              background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))",
              border:"1px solid rgba(139,92,246,0.4)",
              fontSize:13, fontWeight:700,
              display:"flex", alignItems:"center", gap:8,
            }}>
              <div style={{
                width:26, height:26, borderRadius:"50%",
                background:"linear-gradient(135deg,#6366f1,#a855f7)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, color:"white", fontWeight:900,
              }}>AG</div>
              <span style={{ background:"linear-gradient(135deg,#fff,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                ANURAG GUPTA
              </span>
            </div>
          </div>
        </nav>

        <div style={{ maxWidth:1200, margin:"0 auto", padding:"52px 28px 80px" }}>

          {/* ── HERO ── */}
          <div style={{ textAlign:"center", marginBottom:56, animation:"slideUpFade 0.8s ease" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:10,
              padding:"8px 24px", borderRadius:100, marginBottom:28,
              background:"rgba(139,92,246,0.15)", border:"1px solid rgba(139,92,246,0.3)",
              backdropFilter:"blur(10px)",
            }}>
              <span style={{ fontSize:16, animation:"textGlitch 3s infinite" }}>✨</span>
              <span style={{
                fontSize:12, fontWeight:700, letterSpacing:"0.1em",
                background:"linear-gradient(135deg,#a855f7,#ec4899)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              }}>NEXT-GEN AI INTELLIGENCE</span>
            </div>

            <h1 style={{ margin:0, lineHeight:1.1, letterSpacing:"-0.03em" }}>
              <div style={{ fontSize:"clamp(44px,7vw,80px)", fontWeight:800, color:"white", textShadow:"0 0 30px rgba(99,102,241,0.3)" }}>
                Your meetings,
              </div>
              <div style={{
                fontSize:"clamp(44px,7vw,80px)", fontWeight:800,
                background:"linear-gradient(135deg,#6366f1,#a855f7,#ec4899,#06b6d4)",
                backgroundSize:"300% auto",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                animation:"shimmer 4s linear infinite",
              }}>
                fully automated.
              </div>
            </h1>

            <p style={{ color:"#a0a0c0", fontSize:17, maxWidth:560, margin:"24px auto 44px", lineHeight:1.65 }}>
              AI-powered email classification · calendar negotiation · meeting transcription · action item extraction
            </p>

            {/* ── SEARCH BAR ── */}
            <div style={{ position:"relative", maxWidth:700, margin:"0 auto" }}>
              {/* Animated gradient border */}
              <div style={{
                position:"absolute", inset:-2, borderRadius:60, zIndex:0,
                background:"linear-gradient(90deg,#6366f1,#a855f7,#ec4899,#6366f1)",
                backgroundSize:"200% 100%",
                animation:"borderFlow 3s linear infinite",
                opacity:0.7,
              }} />
              <div style={{
                position:"relative", zIndex:1,
                display:"flex", gap:12, alignItems:"center",
                background:"rgba(20,20,45,0.85)",
                backdropFilter:"blur(20px)",
                borderRadius:58, padding:"6px 6px 6px 24px",
              }}>
                <span style={{ fontSize:20, color:"#8b5cf6", flexShrink:0 }}>🔍</span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runAgent()}
                  placeholder="Schedule a meeting with Ravi about Q2 roadmap..."
                  style={{
                    flex:1, border:"none", outline:"none",
                    background:"transparent", fontSize:15,
                    color:"#e0e0ff", fontFamily:"inherit", padding:"14px 0",
                  }}
                />
                <button
                  className="btn-run"
                  onClick={runAgent}
                  disabled={loading}
                  style={{
                    padding:"13px 32px", borderRadius:40, border:"none",
                    background: loading ? "#4a4a6a" : "linear-gradient(135deg,#6366f1,#a855f7)",
                    color:"white", fontWeight:800, cursor: loading ? "not-allowed" : "pointer",
                    fontSize:14, fontFamily:"inherit",
                    display:"flex", alignItems:"center", gap:8, whiteSpace:"nowrap",
                    letterSpacing:"0.04em",
                  }}>
                  {loading
                    ? <><div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />PROCESSING...</>
                    : <>EXECUTE →</>}
                </button>
              </div>
            </div>

            {/* Tech pills */}
            <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:28, flexWrap:"wrap" }}>
              {["Gmail API","Google Calendar","GPT-4o-mini","LangGraph","Whisper AI"].map(f => (
                <span key={f} style={{
                  padding:"6px 16px", borderRadius:40, fontSize:12, fontWeight:500,
                  background:"rgba(255,255,255,0.03)", backdropFilter:"blur(10px)",
                  border:"1px solid rgba(139,92,246,0.2)", color:"#a0a0c0",
                }}>{f}</span>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
              borderRadius:20, padding:"14px 24px", marginBottom:24,
              color:"#f87171", fontWeight:500, backdropFilter:"blur(10px)",
            }}>⚠️ {error}</div>
          )}

          {/* ── EMPTY STATE ── */}
          {!result && !loading && (
            <div style={{
              textAlign:"center", padding:"80px 24px",
              background:"rgba(20,20,45,0.5)", backdropFilter:"blur(20px)",
              border:"1px dashed rgba(139,92,246,0.3)",
              borderRadius:32, marginBottom:28,
              animation:"slideUpFade 0.6s ease 0.2s both",
            }}>
              <div style={{ fontSize:56, marginBottom:20 }}>📭</div>
              <div style={{ fontSize:22, fontWeight:800, color:"white", marginBottom:10 }}>Awaiting instructions</div>
              <div style={{ fontSize:14, color:"#64748b", maxWidth:380, margin:"0 auto", lineHeight:1.7 }}>
                Enter a scheduling query and run the agent to analyse your inbox, check your calendar and generate a reply.
              </div>
            </div>
          )}

          {/* ── LOADING ── */}
          {loading && (
            <div style={{
              padding:"60px 24px", textAlign:"center",
              background:"rgba(20,20,45,0.6)", backdropFilter:"blur(20px)",
              borderRadius:32, marginBottom:28,
              border:"1px solid rgba(139,92,246,0.2)",
              position:"relative", overflow:"hidden",
            }}>
              {/* Grid texture */}
              <div style={{
                position:"absolute", inset:0,
                background:"repeating-linear-gradient(45deg,rgba(99,102,241,0.05) 0px,rgba(99,102,241,0.05) 2px,transparent 2px,transparent 8px)",
              }} />
              <div style={{
                width:70, height:70, borderRadius:"50%", margin:"0 auto 24px",
                border:"3px solid rgba(139,92,246,0.2)",
                borderTopColor:"#8b5cf6", animation:"spinSlow 1s linear infinite",
                position:"relative", zIndex:1,
              }} />
              <div style={{ fontSize:20, fontWeight:700, color:"white", marginBottom:12, position:"relative", zIndex:1 }}>
                {steps[step]}
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"center", marginTop:24, position:"relative", zIndex:1 }}>
                {steps.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 40 : 8, height:4, borderRadius:4,
                    background: i <= step ? "linear-gradient(90deg,#6366f1,#a855f7)" : "rgba(139,92,246,0.2)",
                    transition:"all 0.3s ease",
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* ── RESULTS ── */}
          {result && (
            <div style={{ animation:"cardReveal 0.5s ease" }}>

              {/* Status banner */}
              <div style={{
                padding:"18px 24px", borderRadius:24, marginBottom:28,
                background: hasMeeting
                  ? "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05))"
                  : "linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.05))",
                border:`1px solid ${hasMeeting ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.4)"}`,
                backdropFilter:"blur(10px)",
                display:"flex", alignItems:"center", gap:14,
              }}>
                <span style={{ fontSize:28 }}>{hasMeeting ? "🎯" : "📭"}</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:16, color: hasMeeting ? "#6ee7b7" : "#fbbf24" }}>
                    {hasMeeting ? `${meetingCount} Meeting Request${meetingCount > 1 ? "s" : ""} Detected` : "No Meeting Requests Found"}
                  </div>
                  {hasMeeting && (
                    <div style={{ fontSize:13, color:"#94a3b8", marginTop:4 }}>
                      AI filtered {emails.length - meetingCount} non-meeting emails automatically
                    </div>
                  )}
                </div>
              </div>

              {/* ── PIPELINE RESULTS LABEL ── */}
              <div className="section-bar">
                <div className="bar-accent" style={{ height:24, background:"linear-gradient(#6366f1,#ec4899)" }} />
                <span style={{ fontSize:12, fontWeight:700, color:"#a855f7", letterSpacing:"0.1em" }}>📊 PIPELINE RESULTS</span>
              </div>

              {/* Metric cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:18, marginBottom:32 }}>
                {[
                  { label:"Emails Analyzed", val:emails.length, icon:"📧", g:"linear-gradient(135deg,#6366f1,#8b5cf6)" },
                  { label:"Meetings Found", val:meetingCount, icon:"🗓️", g:"linear-gradient(135deg,#10b981,#06b6d4)" },
                  { label:"Suggested Slot", val:result.slot||"N/A", icon:"⏰", g:"linear-gradient(135deg,#f59e0b,#ef4444)", small:true },
                  { label:"Reply Status", val:result.reply ? "Ready ✓" : "N/A", icon:"📝", g:"linear-gradient(135deg,#a855f7,#ec4899)" },
                ].map(({ label, val, icon, g, small }) => (
                  <div key={label} className="hover-card stat-card" style={{
                    background:"rgba(20,20,45,0.6)", backdropFilter:"blur(12px)",
                    borderRadius:24, padding:"22px 24px",
                    border:"1px solid rgba(139,92,246,0.2)",
                    position:"relative", overflow:"hidden",
                  }}>
                    <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, borderRadius:"50%", background:g, opacity:0.06 }} />
                    <div style={{ fontSize:28, marginBottom:12 }}>{icon}</div>
                    <div style={{ fontSize:10, color:"#8b5cf6", letterSpacing:"0.1em", marginBottom:6, fontWeight:700 }}>{label}</div>
                    <div style={{ fontSize:small ? 18 : 32, fontWeight:800, background:g, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", wordBreak:"break-word" }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── CLASSIFIED EMAILS ── */}
              <div className="section-bar">
                <div className="bar-accent" style={{ height:24, background:"linear-gradient(#6366f1,#ec4899)" }} />
                <span style={{ fontSize:12, fontWeight:700, color:"#a855f7", letterSpacing:"0.1em" }}>📬 CLASSIFIED INBOX</span>
              </div>
              <div style={{
                background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
                borderRadius:24, padding:16, border:"1px solid rgba(139,92,246,0.2)",
                marginBottom:32,
              }}>
                {emails.map((email, i) => (
                  <div key={i} className="email-row" style={{
                    display:"flex", gap:12, padding:"12px 14px",
                    borderBottom: i < emails.length - 1 ? "1px solid rgba(139,92,246,0.1)" : "none",
                    borderRadius:12,
                  }}>
                    <span style={{
                      padding:"4px 12px", borderRadius:40, fontSize:10, fontWeight:700,
                      flexShrink:0, letterSpacing:"0.06em",
                      background: email.details.is_meeting === "YES" ? "rgba(16,185,129,0.2)" : "rgba(100,116,139,0.2)",
                      color: email.details.is_meeting === "YES" ? "#6ee7b7" : "#94a3b8",
                      border:`1px solid ${email.details.is_meeting === "YES" ? "rgba(16,185,129,0.4)" : "rgba(100,116,139,0.3)"}`,
                      boxShadow: email.details.is_meeting === "YES" ? "0 0 8px rgba(16,185,129,0.2)" : "none",
                    }}>
                      {email.details.is_meeting === "YES" ? "MEETING" : "OTHER"}
                    </span>
                    <span style={{ fontSize:13, color:"#c0c0e0", flex:1, lineHeight:1.5 }}>
                      {email.text.slice(0,110)}{email.text.length > 110 ? "…" : ""}
                    </span>
                  </div>
                ))}
              </div>

              {/* ── CALENDAR + REPLY GRID ── */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:24, marginBottom:32 }}>

                {/* Calendar */}
                <div className="hover-card" style={{
                  background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
                  borderRadius:24, padding:20, border:"1px solid rgba(139,92,246,0.2)",
                }}>
                  <div className="section-bar" style={{ marginBottom:16 }}>
                    <div className="bar-accent" style={{ height:18, background:"linear-gradient(#06b6d4,#10b981)" }} />
                    <span style={{ fontSize:11, fontWeight:700, color:"#06b6d4", letterSpacing:"0.1em" }}>📅 CALENDAR VIEW</span>
                  </div>
                  <div style={{ display:"flex", gap:16, marginBottom:18, flexWrap:"wrap" }}>
                    {[["#ef4444","Busy"],["#475569","Free"],["#10b981","Suggested"]].map(([c,l]) => (
                      <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#94a3b8" }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:c, boxShadow:`0 0 6px ${c}` }} />
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                    {calSlots.map(s => (
                      <div key={s.time} className="slot-chip" style={{
                        padding:"12px 8px", textAlign:"center", borderRadius:16,
                        background: s.status === "busy"
                          ? "rgba(239,68,68,0.1)"
                          : s.status === "suggested"
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(255,255,255,0.03)",
                        border: s.status === "suggested"
                          ? "1px solid #10b981"
                          : "1px solid rgba(139,92,246,0.2)",
                        animation: s.status === "suggested" ? "suggestedPulse 2s ease-in-out infinite" : "none",
                      }}>
                        <div style={{ fontWeight:700, fontSize:13, color: s.status === "busy" ? "#f87171" : s.status === "suggested" ? "#6ee7b7" : "#a0a0c0" }}>
                          {s.time}
                        </div>
                        <div style={{ fontSize:10, marginTop:4, color: s.status === "busy" ? "#ef4444" : s.status === "suggested" ? "#10b981" : "#64748b" }}>
                          {s.status === "busy" ? "❌ Busy" : s.status === "suggested" ? "✨ Best Pick" : "🟢 Free"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reply */}
                <div className="hover-card" style={{
                  background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
                  borderRadius:24, padding:20, border:"1px solid rgba(139,92,246,0.2)",
                }}>
                  <div className="section-bar" style={{ marginBottom:16 }}>
                    <div className="bar-accent" style={{ height:18, background:"linear-gradient(#a855f7,#ec4899)" }} />
                    <span style={{ fontSize:11, fontWeight:700, color:"#a855f7", letterSpacing:"0.1em" }}>✉️ GENERATED REPLY</span>
                  </div>
                  {hasMeeting ? (
                    <pre style={{
                      background:"rgba(0,0,0,0.3)", borderRadius:16, padding:16,
                      fontSize:12.5, color:"#c0c0e0", lineHeight:1.75,
                      fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre-wrap", wordBreak:"break-word",
                      maxHeight:220, overflowY:"auto", border:"1px solid rgba(139,92,246,0.1)",
                    }}>{result.reply || "No reply generated."}</pre>
                  ) : (
                    <div style={{ color:"#64748b", padding:"40px 0", textAlign:"center", fontSize:14, fontStyle:"italic" }}>
                      No meeting request detected
                    </div>
                  )}
                </div>
              </div>

              {/* ── NEGOTIATION PIPELINE ── */}
              <div className="section-bar">
                <div className="bar-accent" style={{ height:24, background:"linear-gradient(#6366f1,#ec4899)" }} />
                <span style={{ fontSize:12, fontWeight:700, color:"#a855f7", letterSpacing:"0.1em" }}>🔄 NEGOTIATION PIPELINE</span>
              </div>
              <div style={{
                background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
                borderRadius:24, padding:24, border:"1px solid rgba(139,92,246,0.2)", marginBottom:32,
              }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:18 }}>
                  {[
                    { n:"1", title:"Email Classification", desc:`${meetingCount} meeting(s) identified via GPT-4o-mini + Pydantic`, c:"#6366f1", g:"linear-gradient(135deg,#6366f1,#8b5cf6)" },
                    { n:"2", title:"Slot Negotiation", desc:`${realBusy.length} conflict(s) resolved → ${result.slot||"N/A"} proposed`, c:"#10b981", g:"linear-gradient(135deg,#10b981,#06b6d4)" },
                    { n:"3", title:"Reply Generation", desc:"Quality gate passed → Ready to send", c:"#a855f7", g:"linear-gradient(135deg,#a855f7,#ec4899)" },
                  ].map(({ n, title, desc, c, g }) => (
                    <div key={n} style={{
                      padding:16, borderRadius:20,
                      background:`linear-gradient(135deg,${c}10,${c}05)`,
                      border:`1px solid ${c}30`,
                    }}>
                      <div style={{
                        width:32, height:32, borderRadius:"50%", marginBottom:12,
                        background:g, display:"flex", alignItems:"center", justifyContent:"center",
                        fontWeight:800, color:"white", fontSize:15,
                        boxShadow:`0 4px 12px ${c}44`,
                      }}>{n}</div>
                      <div style={{ fontWeight:700, fontSize:14, color:"white", marginBottom:5 }}>{title}</div>
                      <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5 }}>{desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{
                  padding:"14px 18px", borderRadius:16,
                  background:"rgba(99,102,241,0.07)", border:"1px solid rgba(139,92,246,0.15)",
                  fontSize:13, color:"#8b8bdb", lineHeight:1.6,
                }}>
                  💡 Meeting request detected. Slot {result.slot || "N/A"} proposed. Reply drafted and ready. Focus time preserved outside this window.
                </div>
              </div>
            </div>
          )}

          {/* ── AUDIO INTELLIGENCE ── */}
          <div className="section-bar">
            <div className="bar-accent" style={{ height:24, background:"linear-gradient(#06b6d4,#10b981)" }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#06b6d4", letterSpacing:"0.1em" }}>🎤 AUDIO INTELLIGENCE</span>
          </div>
          <div className="hover-card" style={{
            background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
            borderRadius:24, padding:24, border:"1px solid rgba(139,92,246,0.2)", marginBottom:28,
          }}>
            <p style={{ color:"#a0a0c0", fontSize:13, marginBottom:20, lineHeight:1.6 }}>
              Transcribe{" "}
              <code style={{ background:"rgba(99,102,241,0.12)", padding:"3px 8px", borderRadius:7, color:"#8b5cf6", fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>sample.mp3</code>
              {" "}via Whisper → LangChain extracts structured action items
            </p>
            <button
              className="btn-audio"
              onClick={processAudio}
              disabled={audioLoading}
              style={{
                padding:"12px 28px", borderRadius:40, border:"none",
                background: audioLoading ? "#4a4a6a" : "linear-gradient(135deg,#06b6d4,#10b981)",
                color:"white", fontWeight:700, cursor: audioLoading ? "not-allowed" : "pointer",
                fontSize:14, fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:8, letterSpacing:"0.04em",
              }}>
              {audioLoading
                ? <><div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.7s linear infinite" }} />PROCESSING...</>
                : <>🎙️ PROCESS SAMPLE AUDIO</>}
            </button>

            {!audio && !audioLoading && (
              <div style={{ color:"#4a5568", fontSize:13, fontStyle:"italic", marginTop:16 }}>No audio processed yet.</div>
            )}

            {audio && (
              <div style={{ marginTop:24, display:"grid", gap:16 }}>
                <div style={{
                  background:"rgba(0,0,0,0.3)", borderRadius:20, padding:18,
                  borderLeft:"3px solid #06b6d4",
                }}>
                  <div style={{ fontSize:11, color:"#06b6d4", marginBottom:8, fontWeight:700, letterSpacing:"0.1em" }}>TRANSCRIPT</div>
                  <p style={{ color:"#c0c0e0", fontSize:13.5, lineHeight:1.7, fontStyle:"italic" }}>"{audio.transcript}"</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14 }}>
                  {([
                    { icon:"🗳️", label:"Decisions", items:audio.actions?.decisions, c:"#6366f1" },
                    { icon:"👤", label:"Assignees", items:audio.actions?.assignees, c:"#10b981" },
                    { icon:"⏳", label:"Deadlines", items:audio.actions?.deadlines, c:"#f59e0b" },
                  ] as const).map(({ icon, label, items, c }) => (
                    <div key={label} style={{
                      padding:16, borderRadius:18,
                      background:`linear-gradient(135deg,${c}10,transparent)`,
                      border:`1px solid ${c}30`,
                    }}>
                      <div style={{ fontSize:12, fontWeight:700, color:c, marginBottom:12, letterSpacing:"0.08em" }}>{icon} {label.toUpperCase()}</div>
                      {Array.isArray(items) && items.length > 0
                        ? items.map((d, i) => <div key={i} style={{ fontSize:12.5, color:"#c0c0e0", lineHeight:1.7 }}>→ {d}</div>)
                        : <div style={{ fontSize:12, color:"#64748b", fontStyle:"italic" }}>None extracted</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── WEEKLY REPORT ── */}
          <div className="section-bar">
            <div className="bar-accent" style={{ height:24, background:"linear-gradient(#f59e0b,#ef4444)" }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#f59e0b", letterSpacing:"0.1em" }}>📁 WEEKLY PRODUCTIVITY REPORT</span>
          </div>
          <div className="hover-card" style={{
            background:"rgba(20,20,45,0.5)", backdropFilter:"blur(12px)",
            borderRadius:24, padding:24, border:"1px solid rgba(139,92,246,0.2)",
          }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:16 }}>
              {[
                { label:"Meetings Scheduled", val: result ? meetingCount : "—", g:"linear-gradient(135deg,#6366f1,#8b5cf6)" },
                { label:"Emails Processed", val: result ? emails.length : "—", g:"linear-gradient(135deg,#10b981,#06b6d4)" },
                { label:"Action Items", val: audio?.actions ? (audio.actions.decisions?.length||0)+(audio.actions.assignees?.length||0) : "—", g:"linear-gradient(135deg,#a855f7,#ec4899)" },
                { label:"Focus Time Saved", val: result ? "2.5h" : "—", g:"linear-gradient(135deg,#f59e0b,#ef4444)" },
              ].map(({ label, val, g }) => (
                <div key={label} style={{
                  padding:"22px 18px", borderRadius:20, textAlign:"center",
                  background:"rgba(255,255,255,0.03)", border:"1px solid rgba(139,92,246,0.15)",
                }}>
                  <div style={{ fontSize:36, fontWeight:900, letterSpacing:"-0.03em", marginBottom:8, background:g, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                    {val}
                  </div>
                  <div style={{ fontSize:12, color:"#64748b", fontWeight:600, lineHeight:1.4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}