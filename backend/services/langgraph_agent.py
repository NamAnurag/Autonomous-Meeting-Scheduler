from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional

from services.email import read_emails, generate_reply
from services.calendar import suggest_slot
from services.rag import generate_brief

# 🔹 Execution logs
logs = []


# 🔹 State — all fields that flow through the graph
class AgentState(TypedDict):
    query: str
    emails: list
    slot: str
    reply: str
    message: str
    brief: dict
    output: dict


# 🔹 Step 1: Fetch & Classify Emails
def fetch_emails(state):
    logs.clear()
    logs.append("📧 Step 1: Fetching and classifying emails...")

    try:
        emails = read_emails()
        logs.append(f"✅ Fetched {len(emails)} email(s)")
        meeting_count = sum(
            1 for e in emails
            if e.get("details", {}).get("is_meeting") == "YES"
        )
        logs.append(f"📋 {meeting_count} meeting request(s) detected after classification")
    except Exception as e:
        logs.append(f"❌ Email error: {str(e)}")
        emails = []

    return {"emails": emails}


# 🔹 Step 2: Decide Slot — with ambiguity handling
def decide_slot(state):
    logs.append("📅 Step 2: Checking calendar for free slot...")

    try:
        slot = suggest_slot()

        # Ambiguity handling (Day 4 KPI: stability)
        # If slot is "No free slot", don't crash — use next business day fallback
        if not slot or slot == "No free slot":
            import datetime
            tomorrow = datetime.datetime.utcnow() + datetime.timedelta(days=1)
            # Find next weekday at 10 AM
            while tomorrow.weekday() >= 5:  # skip weekend
                tomorrow += datetime.timedelta(days=1)
            slot = tomorrow.replace(hour=10, minute=0).strftime("%Y-%m-%d %H:%M")
            logs.append(f"⚠️  No free slot found — using next business day fallback: {slot}")
        else:
            logs.append(f"✅ Suggested slot: {slot}")

    except Exception as e:
        logs.append(f"❌ Slot error: {str(e)} — using fallback")
        slot = "2026-03-28 10:00"

    return {"slot": slot}


# 🔹 Step 3: Generate Reply
def create_reply(state):
    logs.append("✉️ Step 3: Generating negotiation reply...")

    emails = state.get("emails", [])
    meeting_count = sum(
        1 for e in emails
        if e.get("details", {}).get("is_meeting") == "YES"
    )

    if meeting_count == 0:
        logs.append("⚠️ No meeting request found — reply skipped")
        return {
            "reply": "",
            "message": "No meeting request found. No follow-up email generated."
        }

    try:
        reply = generate_reply(state.get("slot", "TBD"))
        logs.append("✅ Negotiation reply generated")
    except Exception as e:
        logs.append(f"❌ Reply error: {str(e)}")
        reply = (
            "Hello,\n\nThank you for your email. "
            "I will get back to you shortly regarding scheduling.\n\n"
            "Best regards,\nAI Meeting Agent"
        )

    return {
        "reply": reply,
        "message": "Follow-up email drafted."
    }


# 🔹 Step 4: Generate Pre-Meeting Brief via RAG
def generate_pre_brief(state):
    logs.append("🧠 Step 4: Generating pre-meeting brief via RAG...")

    query = state.get("query", "")
    slot = state.get("slot", "TBD")

    # Extract attendees from query (simple heuristic)
    common_names = ["ravi", "sarah", "michael", "priya", "anurag"]
    attendees = [n.capitalize() for n in common_names if n in query.lower()]
    if not attendees:
        attendees = ["Team"]

    # Extract topic from query
    topic = query if query else "General meeting"

    try:
        brief = generate_brief(attendees=attendees, topic=topic, slot=slot)
        logs.append(f"✅ Brief generated for {len(attendees)} attendee(s)")
    except Exception as e:
        logs.append(f"❌ Brief error: {str(e)}")
        brief = {
            "topic": topic,
            "attendees": attendees,
            "slot": slot,
            "brief": "Brief generation unavailable. Please review past meeting notes manually.",
            "context_used": ""
        }

    return {"brief": brief}


# 🔹 Step 5: Reviewer — quality gate
def reviewer(state):
    logs.append("🔍 Step 5: Reviewing reply quality...")

    reply = state.get("reply", "")

    if not reply or len(reply) < 20:
        logs.append("⚠️ Reviewer: reply too short — applying fallback")
        reply = (
            "Hello,\n\n"
            "Thank you for your email. I will get back to you shortly "
            "regarding scheduling.\n\n"
            "Best regards,\n"
            "AI Meeting Agent"
        )
    else:
        logs.append("✅ Reviewer: reply quality looks good")

    return {"reply": reply}


# 🔹 Step 6: Final Output
def final_output(state):
    logs.append("📤 Step 6: Preparing final output...")

    emails = state.get("emails", [])
    meeting_count = sum(
        1 for e in emails
        if e.get("details", {}).get("is_meeting") == "YES"
    )

    logs.append(
        f"✅ Pipeline complete — {len(emails)} email(s), "
        f"{meeting_count} meeting(s), slot: {state.get('slot')}"
    )

    return {
        "output": {
            "query": state.get("query", ""),
            "emails": emails,
            "emails_analyzed": len(emails),
            "meeting_requests_found": meeting_count,
            "slot": state.get("slot", ""),
            "reply": state.get("reply", ""),
            "message": state.get("message", ""),
            "brief": state.get("brief", {})
        }
    }


# 🔹 Logs API
def get_logs():
    return logs


# 🔹 Build Graph
def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("fetch_emails", fetch_emails)
    graph.add_node("decide_slot", decide_slot)
    graph.add_node("create_reply", create_reply)
    graph.add_node("generate_pre_brief", generate_pre_brief)
    graph.add_node("reviewer", reviewer)
    graph.add_node("final_output", final_output)

    graph.set_entry_point("fetch_emails")

    graph.add_edge("fetch_emails", "decide_slot")
    graph.add_edge("decide_slot", "create_reply")
    graph.add_edge("create_reply", "generate_pre_brief")
    graph.add_edge("generate_pre_brief", "reviewer")
    graph.add_edge("reviewer", "final_output")
    graph.add_edge("final_output", END)

    return graph.compile()