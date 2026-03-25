from langgraph.graph import StateGraph, END
from typing import TypedDict

from services.email import read_emails, generate_reply
from services.calendar import suggest_slot

# 🔹 Logs
logs = []

# 🔹 State
class AgentState(TypedDict):
    query: str
    emails: list
    slot: str
    reply: str


# 🔹 Step 1: Fetch Emails
def fetch_emails(state):
    logs.clear()   # 🔥 reset logs for each run

    try:
        emails = read_emails()
        logs.append("Fetched emails")
    except Exception as e:
        logs.append(f"Email error: {str(e)}")
        emails = []

    return {"emails": emails}


# 🔹 Step 2: Decide Slot
def decide_slot(state):
    try:
        slot = suggest_slot()
        logs.append(f"Suggested slot: {slot}")
    except Exception as e:
        logs.append(f"Slot error: {str(e)}")
        slot = "2026-03-25 14:00"  # fallback

    return {"slot": slot}


# 🔹 Step 3: Generate Reply
def create_reply(state):
    try:
        reply = generate_reply(state["slot"])
        logs.append("Reply generated")
    except Exception as e:
        logs.append(f"Reply error: {str(e)}")
        reply = "Unable to generate reply"

    return {"reply": reply}

def reviewer(state):
    reply = state.get("reply", "")

    if len(reply) < 20:
        logs.append("Reviewer: reply too short, fixing")
        reply = "Hello,\n\nThank you for your email. I will get back to you shortly.\n\nBest regards."

    else:
        logs.append("Reviewer: reply looks good")

    return {"reply": reply}


# 🔹 Final Output
def final_output(state):
    emails = state.get("emails", [])

    meeting_count = sum(
        1 for e in emails if e["details"]["is_meeting"] == "YES"
    )

    return {
        "output": {
            "query": state.get("query"),
            "emails": emails,  # 🔥 KEEP THIS
            "emails_analyzed": len(emails),
            "meeting_requests_found": meeting_count,
            "slot": state.get("slot"),  # 🔥 keep key name consistent
            "reply": state.get("reply")
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
    graph.add_node("reviewer", reviewer)   # 🔥 ADD THIS
    graph.add_node("final_output", final_output)

    graph.set_entry_point("fetch_emails")

    graph.add_edge("fetch_emails", "decide_slot")
    graph.add_edge("decide_slot", "create_reply")
    graph.add_edge("create_reply", "reviewer")   # 🔥 NEW
    graph.add_edge("reviewer", "final_output")   # 🔥 NEW
    graph.add_edge("final_output", END)

    return graph.compile()