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

    return build('calendar', 'v3', credentials=creds)


def get_free_slots():
    """Return list of busy (start, end) tuples from Google Calendar for next 24 hours."""
    service = get_calendar_service()

    now = datetime.datetime.utcnow()
    end = now + datetime.timedelta(days=1)

    events = service.events().list(
        calendarId='primary',
        timeMin=now.isoformat() + 'Z',
        timeMax=end.isoformat() + 'Z',
        singleEvents=True,
        orderBy='startTime'
    ).execute().get('items', [])

    busy = []
    for event in events:
        start = event['start'].get('dateTime')
        end_time = event['end'].get('dateTime')
        busy.append((start, end_time))

    return busy


def suggest_slot():
    busy = get_free_slots()

    # Force IST (UTC+5:30) — works regardless of server timezone
    ist_offset = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now = datetime.datetime.now(ist_offset).replace(
        minute=0, second=0, microsecond=0, tzinfo=None
    )

    # Start from NEXT hour minimum
    now = now + datetime.timedelta(hours=1)

    for i in range(0, 48):
        candidate = now + datetime.timedelta(hours=i)

        # Business hours only — 9 AM to 6 PM
        if candidate.hour < 9 or candidate.hour >= 18:
            continue

        # Skip weekends
        if candidate.weekday() >= 5:
            continue

        conflict = False
        for start, end in busy:
            if start and end:
                try:
                    start_dt = datetime.datetime.fromisoformat(start.replace('Z', ''))
                    end_dt = datetime.datetime.fromisoformat(end.replace('Z', ''))
                    if start_dt <= candidate < end_dt:
                        conflict = True
                        break
                except ValueError:
                    continue

        if not conflict:
            return candidate.strftime("%Y-%m-%d %H:%M")

    return "No free slot"
