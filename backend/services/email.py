import os
import pickle
import json
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request


# 🔹 Load environment
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


# 🔹 Pydantic Model (STRICT STRUCTURE)
class MeetingDetails(BaseModel):
    is_meeting: str
    date: str
    time: str


# 🔹 Gmail connection
def get_gmail_service():
    creds = None

    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return build('gmail', 'v1', credentials=creds)


# 🔹 Extract meeting details
def extract_meeting_details(text):
    prompt = f"""
    Extract meeting details from this email.

    Email:
    {text}

    Return ONLY JSON:
    {{
      "is_meeting": "YES or NO",
      "date": "YYYY-MM-DD or N/A",
      "time": "HH:MM or N/A"
    }}
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )

        content = response.choices[0].message.content
        content = content.strip().replace("```json", "").replace("```", "")

        data = json.loads(content)

        # 🔥 STRICT VALIDATION
        validated = MeetingDetails(**data)

        return validated.dict()

    except Exception as e:
        print("ERROR:", e)

        # 🔥 fallback logic
        text_lower = text.lower()

        if "interview" in text_lower or "meeting" in text_lower or "call" in text_lower:
            fallback = {
                "is_meeting": "YES",
                "date": "N/A",
                "time": "N/A"
            }
        else:
            fallback = {
                "is_meeting": "NO",
                "date": "N/A",
                "time": "N/A"
            }

        # 🔥 VALIDATE FALLBACK ALSO
        return MeetingDetails(**fallback).dict()


# 🔹 Read emails
def read_emails():
    service = get_gmail_service()

    results = service.users().messages().list(userId='me', maxResults=5).execute()
    messages = results.get('messages', [])

    email_list = []

    for msg in messages:
        txt = service.users().messages().get(userId='me', id=msg['id']).execute()
        snippet = txt['snippet']

        details = extract_meeting_details(snippet)

        email_list.append({
            "text": snippet,
            "details": details
        })

    return email_list


# 🔹 Reply generator
def generate_reply(slot):
    return f"""
Hello,

Thank you for your email.

I am available at {slot}. Please let me know if this works for you.

Best regards,
AI Meeting Agent
"""