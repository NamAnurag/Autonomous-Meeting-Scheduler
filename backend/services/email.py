import os
import pickle
import json
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# 🔹 Classification refinement log (Day 4 KPI: debugging effort)
# Documents how prompt was improved to stop misclassifying newsletters
CLASSIFICATION_LOG = [
    {
        "version": "v1",
        "issue": "LLM was classifying promotional newsletters as meeting requests",
        "example": "'Flash sale this weekend — 50% off!' → classified as YES",
        "fix": "Added explicit negative examples to prompt: newsletters, promotions, alerts are NOT meetings",
    },
    {
        "version": "v2",
        "issue": "LLM was classifying email receipts and OTPs as meetings",
        "example": "'Your OTP is 482910' → classified as YES",
        "fix": "Added instruction: only classify as YES if email explicitly proposes a time/date for a meeting, call, or interview",
    },
    {
        "version": "v3 (current)",
        "issue": "Ambiguous emails like 'let's catch up sometime' were being classified as YES",
        "example": "'Hey, let's catch up sometime next week!' → classified as YES with date N/A",
        "fix": "Added rule: vague 'catch up' without a specific proposed time = NO. Must have explicit scheduling intent.",
    },
]


# 🔹 Pydantic Model — strict structure
from pydantic import BaseModel, field_validator
from typing import Literal

class MeetingDetails(BaseModel):
    is_meeting: Literal["YES", "NO"]   # only accepts exactly "YES" or "NO"
    date: str
    time: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        if v != "N/A":
            import re
            if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
                raise ValueError(f"date must be YYYY-MM-DD or N/A, got: {v}")
        return v

    @field_validator("time")
    @classmethod
    def validate_time(cls, v):
        if v != "N/A":
            import re
            if not re.match(r"^\d{2}:\d{2}$", v):
                raise ValueError(f"time must be HH:MM or N/A, got: {v}")
        return v

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


def extract_meeting_details(text: str) -> dict:
    """
    Classify email as meeting request or not.
    Uses GPT-4o-mini with refined prompt (v3) to prevent newsletter misclassification.
    """
    prompt = f"""
You are an email classifier. Determine if this email is a meeting request.

Rules (v3 — refined after classification errors):
- YES: Email explicitly proposes scheduling a meeting, call, interview, or sync with a specific or approximate time
- NO: Newsletters, promotions, OTPs, receipts, social notifications, vague "let's catch up someday" with no scheduling intent

Email:
{text}

Return ONLY valid JSON with no extra text:
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
            temperature=0,  # deterministic output for classification
        )

        content = response.choices[0].message.content
        content = content.strip().replace("```json", "").replace("```", "").strip()

        data = json.loads(content)
        validated = MeetingDetails(**data)
        return validated.dict()

    except Exception as e:
        print(f"Classification error: {e} — using keyword fallback")

        text_lower = text.lower()

        # Refined fallback — also excludes newsletters/promos
        promo_keywords = ["unsubscribe", "sale", "% off", "deal", "otp", "verification code", "receipt"]
        is_promo = any(kw in text_lower for kw in promo_keywords)

        meeting_keywords = ["meeting", "interview", "call", "sync", "schedule", "calendar invite", "zoom", "teams"]
        is_meeting = any(kw in text_lower for kw in meeting_keywords) and not is_promo

        return MeetingDetails(
            is_meeting="YES" if is_meeting else "NO",
            date="N/A",
            time="N/A"
        ).dict()


def read_emails() -> list:
    """Fetch last 5 emails from Gmail and classify each one."""
    service = get_gmail_service()

    results = service.users().messages().list(
        userId='me',
        maxResults=5,
        q="is:unread"  # only unread emails — more relevant for live demo
    ).execute()

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


def generate_reply(slot: str) -> str:
    """Generate a polished negotiation reply email."""
    return (
        f"Hello,\n\n"
        f"Thank you for reaching out.\n\n"
        f"I would like to propose the following time slot for our meeting:\n"
        f"📅 {slot}\n\n"
        f"Please let me know if this works for you, or suggest an alternative "
        f"time and I will do my best to accommodate.\n\n"
        f"Looking forward to connecting.\n\n"
        f"Best regards,\n"
        f"AI Meeting Agent"
    )


def get_classification_log() -> list:
    """Return the classification refinement log for the /logs endpoint (Day 4 KPI)."""
    return CLASSIFICATION_LOG