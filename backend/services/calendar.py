from googleapiclient.discovery import build
import datetime
import pickle
import os
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/calendar']


def get_calendar_service():
    creds = None

    if os.path.exists('token_calendar.pickle'):
        with open('token_calendar.pickle', 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)

        with open('token_calendar.pickle', 'wb') as token:
            pickle.dump(creds, token)

    service = build('calendar', 'v3', credentials=creds)
    return service


def get_free_slots():
    service = get_calendar_service()

    now = datetime.datetime.utcnow()
    end = now + datetime.timedelta(days=1)

    events_result = service.events().list(
        calendarId='primary',
        timeMin=now.isoformat() + 'Z',
        timeMax=end.isoformat() + 'Z',
        singleEvents=True,
        orderBy='startTime'
    ).execute()

    events = events_result.get('items', [])

    busy_times = []
    for event in events:
        start = event['start'].get('dateTime')
        end = event['end'].get('dateTime')
        busy_times.append((start, end))

    return busy_times

def suggest_slot():
    busy = get_free_slots()

    now = datetime.datetime.utcnow()

    # Try next 8 hours
    for i in range(1, 9):
        candidate = now + datetime.timedelta(hours=i)

        hour = candidate.hour

        # ❌ Avoid night time (before 9 AM or after 6 PM)
        if hour < 9 or hour > 18:
            continue

        candidate_str = candidate.isoformat()

        conflict = False

        for start, end in busy:
            if start and end:
                if start <= candidate_str <= end:
                    conflict = True
                    break

        if not conflict:
            return candidate.strftime("%Y-%m-%d %H:%M")

    return "No free slot available"

def generate_reply(slot):
    return f"""
Hello,

I am available at {slot}. Please let me know if this time works for you.

Best regards,
AI Meeting Agent
"""