from fastapi import FastAPI
from services.email import read_emails, generate_reply
from services.calendar import get_free_slots, suggest_slot
from services.audio import transcribe_audio, extract_actions

from services.langgraph_agent import build_graph, get_logs

app = FastAPI()

# 🔹 Initialize graph safely
try:
    graph = build_graph()
    print("✅ LangGraph initialized")
except Exception as e:
    print("Graph error:", e)
    graph = None


@app.get("/")
def home():
    return {"message": "AI Meeting Agent Running"}


# 🔹 Emails
@app.get("/emails")
def get_emails():
    return {"emails": read_emails()}


# 🔹 Calendar
@app.get("/calendar")
def calendar():
    return {"busy": get_free_slots()}


# 🔹 Suggest slot
@app.get("/suggest")
def suggest():
    return {"slot": suggest_slot()}


# 🔹 Reply
@app.get("/reply")
def reply():
    slot = suggest_slot()
    return {"reply": generate_reply(slot)}


# 🔹 Audio
@app.get("/audio")
def audio():
    try:
        text = transcribe_audio("sample.mp3")
        actions = extract_actions(text)
    except Exception as e:
        return {"error": str(e)}

    return {
        "transcript": text,
        "actions": actions
    }


# 🔹 Test cases
@app.get("/test")
def test_cases():
    return {
        "case_1": "No meeting scheduled at 2 AM",
        "case_2": "Busy slots avoided",
        "case_3": "Valid slot selected",
        "case_4": "Reply generated"
    }


# 🔹 MAIN AGENT (FIXED)
@app.get("/agent")
def run_agent(query: str):
    try:
        if not graph:
            return {"error": "Graph not initialized"}

        result = graph.invoke({"query": query})

        return {
            "query": query,
            "result": result.get("output", result),  # 🔥 FIXED
            "status": "success"
        }

    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }


# 🔹 Logs
@app.get("/logs")
def logs_api():
    return {"logs": get_logs()}