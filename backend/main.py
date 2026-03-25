from fastapi import FastAPI
from services.email import read_emails
from services.calendar import get_free_slots, suggest_slot, generate_reply
from services.audio import transcribe_audio, extract_actions

app = FastAPI()


@app.get("/")
def home():
    return {"message": "AI Meeting Agent Running"}


# 📩 Emails
@app.get("/emails")
def get_emails():
    return {"emails": read_emails()}


# 📅 Calendar busy slots
@app.get("/calendar")
def calendar():
    return {"busy": get_free_slots()}


# 🕒 Suggest slot
@app.get("/suggest")
def suggest():
    return {"slot": suggest_slot()}


# ✉️ Generate reply
@app.get("/reply")
def reply():
    slot = suggest_slot()
    return {"reply": generate_reply(slot)}


# 🎤 Audio + extraction
@app.get("/audio")
def audio():
    text = transcribe_audio("sample.mp3")  # put file in backend folder
    actions = extract_actions(text)

    return {
        "transcript": text,
        "actions": actions
    }