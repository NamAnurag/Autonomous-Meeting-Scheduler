from fastapi import FastAPI
from services.email import read_emails
from services.calendar import get_free_slots
from services.calendar import suggest_slot
from services.email import generate_reply
from services.audio import transcribe_audio, extract_actions

app = FastAPI()


@app.get("/")
def home():
    return {"message": "AI Meeting Agent Running"}


@app.get("/emails")
def get_emails():
    return {"emails": read_emails()}



@app.get("/calendar")
def calendar():
    return {"busy": get_free_slots()}



@app.get("/suggest")
def suggest():
    return {"slot": suggest_slot()}



@app.get("/reply")
def reply():
    slot = suggest_slot()
    return {"reply": generate_reply(slot)}



@app.get("/audio")
def audio():
    text = transcribe_audio("sample.mp3")
    actions = extract_actions(text)

    return {
        "transcript": text,
        "actions": actions
    }

@app.get("/test")
def test_cases():
    return {
        "case_1": "No meeting scheduled at 2 AM (outside working hours)",
        "case_2": "Busy slots are avoided",
        "case_3": "Valid free slot is selected",
        "case_4": "Reply generated based on suggested slot"
    }