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

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [audio, setAudio] = useState<AudioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");

  const runAgent = async () => {
    if (!query.trim()) {
      setError("Please enter a query.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/agent?query=${encodeURIComponent(query)}`
      );
      const data = await res.json();

      if (data?.status === "success") {
        setResult(data.result);
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
    setAudioLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/audio");
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
  const slotTime = (result?.slot || "").split(" ").slice(-1)[0] || "";

const calendarSlots: CalendarSlot[] = [
  { time: "09:00", status: "busy" },
  { time: "10:00", status: "free" },
  { time: "11:00", status: "free" },
  { time: "12:00", status: "busy" },
  { time: "13:00", status: "free" },
  { time: "14:00", status: "free" },
  { time: "15:00", status: "busy" },
  { time: "16:00", status: "free" },
  { time: "17:00", status: "free" },
].map((slot): CalendarSlot => {
  const slotFromResult = result?.slot?.split(" ")[1] ?? "";
  return {
    time: slot.time,
    status: (result?.slot && slot.time === slotFromResult
      ? "suggested"
      : slot.status) as "busy" | "free" | "suggested",
  };
});

  const briefText = hasMeeting
    ? `Meeting request found. Suggested slot: ${result?.slot || "N/A"}. A follow-up reply is ready.`
    : `No meeting request found in emails. The assistant preserved focus time and avoided unnecessary scheduling.`;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>🤖 AI Executive Meeting Assistant</h1>
            <p style={styles.subtitle}>
              Automate scheduling, extract insights, and manage meetings effortlessly.
            </p>
          </div>

          <div style={styles.authBadge}>🔐 Logged in as: Anurag Gupta</div>
        </div>

        <div style={styles.inputRow}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query"
            style={styles.input}
          />
          <button onClick={runAgent} style={styles.button} disabled={loading}>
            {loading ? "Running..." : "🚀 Run"}
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {result && (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>📊 Meeting Analysis</h2>

            {hasMeeting ? (
              <div style={styles.successBox}>
                ✅ {meetingCount} meeting request(s) found
              </div>
            ) : (
              <div style={styles.warningBox}>
                ⚠️ No meeting requests found
              </div>
            )}

            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>📧 Emails Analyzed</div>
                <div style={styles.metricValue}>{emails.length}</div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>📅 Meetings Found</div>
                <div style={styles.metricValue}>{meetingCount}</div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>⏰ Suggested Slot</div>
                <div style={styles.metricValue}>{result.slot || "N/A"}</div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>📝 Generated Briefs</div>
                <div style={styles.metricValue}>{result.reply ? 1 : 0}</div>
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <h3 style={styles.subSectionTitle}>📅 Calendar Optimization View</h3>
              <div style={styles.calendarGrid}>
                {calendarSlots.map((slot) => (
                  <div
                    key={slot.time}
                    style={{
                      ...styles.slotChip,
                      ...(slot.status === "busy"
                        ? styles.slotBusy
                        : slot.status === "suggested"
                        ? styles.slotSuggested
                        : styles.slotFree),
                    }}
                  >
                    <div style={styles.slotTime}>{slot.time}</div>
                    <div style={styles.slotStatus}>
                      {slot.status === "busy"
                        ? "Busy"
                        : slot.status === "suggested"
                        ? "Suggested"
                        : "Free"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <h3 style={styles.subSectionTitle}>📨 Generated Reply</h3>
              {hasMeeting ? (
                <pre style={styles.pre}>{result.reply || "No reply generated."}</pre>
              ) : (
                <div style={styles.noReplyBox}>
                  No reply generated because no meeting request was found.
                </div>
              )}
            </div>

            <div style={{ marginTop: 22 }}>
              <h3 style={styles.subSectionTitle}>🧠 Assistant Summary</h3>
              <div style={styles.summaryBox}>{briefText}</div>
            </div>
          </section>
        )}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>🔄 Negotiation History</h2>
          <div style={styles.timeline}>
            <div style={styles.timelineItem}>✔ Requested → 11 AM</div>
            <div style={styles.timelineItem}>✔ Rescheduled → 3 PM</div>
            <div style={styles.timelineItem}>✔ Confirmed → 5 PM</div>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>🎤 Audio Insights</h2>
          <button onClick={processAudio} style={styles.audioButton} disabled={audioLoading}>
            {audioLoading ? "Processing..." : "Process Audio"}
          </button>

          {audio && (
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div style={styles.audioBlock}>
                <strong>Transcript:</strong>
                <div style={{ marginTop: 8 }}>
                  {audio.transcript || "No transcript found."}
                </div>
              </div>

              <div style={styles.audioBlock}>
                <strong>Decisions:</strong>{" "}
                {Array.isArray(audio.actions?.decisions) && audio.actions.decisions.length > 0
                  ? audio.actions.decisions.join(", ")
                  : "N/A"}
              </div>

              <div style={styles.audioBlock}>
                <strong>Assignees:</strong>{" "}
                {Array.isArray(audio.actions?.assignees) && audio.actions.assignees.length > 0
                  ? audio.actions.assignees.join(", ")
                  : "N/A"}
              </div>

              <div style={styles.audioBlock}>
                <strong>Deadlines:</strong>{" "}
                {Array.isArray(audio.actions?.deadlines) && audio.actions.deadlines.length > 0
                  ? audio.actions.deadlines.join(", ")
                  : "N/A"}
              </div>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>📁 Demo Activity</h2>
          <div style={styles.demoList}>
            <div style={styles.demoItem}>✔ Last meeting scheduled at 5 PM</div>
            <div style={styles.demoItem}>✔ 3 meeting requests detected</div>
            <div style={styles.demoItem}>✔ Follow-up email generated automatically</div>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: any = {
  page: {
    background: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
    color: "white",
    minHeight: "100vh",
    padding: "40px 28px",
    fontFamily: "Inter, Arial, sans-serif",
  },
  container: {
    maxWidth: 1120,
    margin: "0 auto",
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  authBadge: {
    background: "rgba(34, 197, 94, 0.14)",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    color: "#bbf7d0",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
  },
  title: {
    fontSize: 36,
    fontWeight: 900,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 8,
    marginBottom: 0,
    fontSize: 15,
  },
  inputRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 22,
  },
  input: {
    width: 360,
    maxWidth: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: "1px solid #334155",
    background: "#020617",
    color: "white",
    outline: "none",
    fontSize: 15,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
  },
  button: {
    padding: "13px 20px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #22c55e, #16a34a)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(34,197,94,0.22)",
  },
  audioButton: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(90deg, #3b82f6, #2563eb)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(59,130,246,0.22)",
  },
  card: {
    background: "rgba(30, 41, 59, 0.72)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    padding: 24,
    borderRadius: 18,
    marginBottom: 22,
    boxShadow: "0 16px 32px rgba(0,0,0,0.26)",
  },
  sectionTitle: {
    fontSize: 22,
    marginBottom: 14,
    fontWeight: 800,
  },
  subSectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: 800,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginTop: 15,
  },
  metricCard: {
    background: "#020617",
    padding: 16,
    borderRadius: 14,
    border: "1px solid #334155",
    minHeight: 84,
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 6,
  },
  metricValue: {
    fontWeight: 800,
    fontSize: 18,
    wordBreak: "break-word",
  },
  pre: {
    background: "#020617",
    color: "#e2e8f0",
    padding: 16,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    minHeight: 120,
    border: "1px solid #334155",
    lineHeight: 1.7,
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 12,
  },
  slotChip: {
    borderRadius: 14,
    padding: 14,
    border: "1px solid #334155",
    textAlign: "center",
  },
  slotBusy: {
    background: "#3f1d1d",
    color: "#fecaca",
  },
  slotFree: {
    background: "#0f172a",
    color: "#cbd5e1",
  },
  slotSuggested: {
    background: "linear-gradient(180deg, #14532d, #166534)",
    color: "#bbf7d0",
    border: "1px solid rgba(34,197,94,0.45)",
    boxShadow: "0 0 0 1px rgba(34,197,94,0.08)",
  },
  slotTime: {
    fontSize: 16,
    fontWeight: 800,
  },
  slotStatus: {
    fontSize: 12,
    marginTop: 6,
    opacity: 0.95,
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  timelineItem: {
    color: "#e2e8f0",
    fontSize: 16,
  },
  audioBlock: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 12,
  },
  successBox: {
    background: "#14532d",
    color: "#bbf7d0",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 14,
    fontWeight: 700,
  },
  warningBox: {
    background: "#713f12",
    color: "#fde68a",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 14,
    fontWeight: 700,
  },
  errorBox: {
    background: "#7f1d1d",
    color: "#fecaca",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 16,
    fontWeight: 700,
  },
  noReplyBox: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 14,
    color: "#cbd5e1",
  },
  summaryBox: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 14,
    color: "#e2e8f0",
    lineHeight: 1.7,
  },
  demoList: {
    display: "grid",
    gap: 8,
  },
  demoItem: {
    color: "#e2e8f0",
    fontSize: 15,
  },
};