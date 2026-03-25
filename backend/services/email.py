import os
import pickle
import json
from dotenv import load_dotenv
from openai import OpenAI

from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# 🔹 Load env
load_dotenv()
client = OpenAI()   # ✅ new correct way

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


# 🔹 Gmail auth (token saved)
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


# 🔹 Fallback classifier (FAST + SAFE)
def fallback_classifier(text):
    text = text.lower()

    keywords = ["meeting", "schedule", "call", "discussion", "zoom", "meet"]

    if "google account" in text or "access" in text:
        return {
            "is_meeting": "NO",
            "date": "N/A",
            "time": "N/A"
        }

    for word in keywords:
        if word in text:
            return {
                "is_meeting": "YES",
                "date": "N/A",
                "time": "N/A"
            }

    return {
        "is_meeting": "NO",
        "date": "N/A",
        "time": "N/A"
    }


# 🔹 AI extraction (with safety)
def extract_meeting_details(text):
    prompt = f"""
    Extract meeting details from this email.

    Email:
    {text}

    Return STRICT JSON only:
    {{
      "is_meeting": "YES or NO",
      "date": "...",
      "time": "..."
    }}
    """

    try:
        print("Calling OpenAI...")

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            timeout=8
        )

        content = response.choices[0].message.content.strip()

        print("AI Response:", content)

        # Try parsing JSON
        return json.loads(content)

    except Exception as e:
        print("AI FAILED → using fallback:", e)
        return fallback_classifier(text)


# 🔹 MAIN FUNCTION
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