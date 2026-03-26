"""
RAG Pipeline — Pre-Meeting Brief Generator (Day 4 KPI)
Uses in-memory past meeting notes to generate context-aware briefs.
For production: swap MOCK_MEETING_DB with FAISS + real embeddings.
"""

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini")

# 🔹 Mock RAG database — past meeting notes per attendee/topic
# In production: replace with FAISS vector store over real meeting transcripts
MOCK_MEETING_DB = [
    {
        "id": 1,
        "date": "2026-03-10",
        "attendees": ["Ravi", "Sarah", "Anurag"],
        "topic": "Q1 product review",
        "summary": "Discussed Q1 metrics. Ravi flagged backend latency issues. Sarah committed to client report by March 15. Team agreed to prioritize API optimization in Q2.",
        "action_items": ["Ravi: fix backend latency", "Sarah: send client report", "Anurag: approve Q2 roadmap"],
    },
    {
        "id": 2,
        "date": "2026-03-17",
        "attendees": ["Priya", "Michael", "Anurag"],
        "topic": "Staging environment review",
        "summary": "Priya identified 3 critical bugs in staging. Michael agreed to update documentation. Deployment pushed to March 25.",
        "action_items": ["Priya: fix staging bugs", "Michael: update docs", "Anurag: approve deployment"],
    },
    {
        "id": 3,
        "date": "2026-03-20",
        "attendees": ["Sarah", "Anurag"],
        "topic": "Client onboarding",
        "summary": "Client requested weekly status updates. Sarah to own communication. Budget approved for Q2 features.",
        "action_items": ["Sarah: set up weekly client calls", "Anurag: confirm budget"],
    },
]


def retrieve_context(attendees: list, topic: str) -> str:
    """Retrieve relevant past meeting notes for given attendees/topic."""
    relevant = []

    for note in MOCK_MEETING_DB:
        # Match if any attendee overlaps OR topic keyword matches
        attendee_match = any(
            a.lower() in [x.lower() for x in note["attendees"]]
            for a in attendees
        )
        topic_match = any(
            word.lower() in note["topic"].lower()
            for word in topic.split()
            if len(word) > 3
        )

        if attendee_match or topic_match:
            relevant.append(
                f"[{note['date']}] Topic: {note['topic']}\n"
                f"Summary: {note['summary']}\n"
                f"Open actions: {', '.join(note['action_items'])}"
            )

    if not relevant:
        # Return most recent note as fallback context
        latest = MOCK_MEETING_DB[-1]
        relevant.append(
            f"[{latest['date']}] Topic: {latest['topic']}\n"
            f"Summary: {latest['summary']}\n"
            f"Open actions: {', '.join(latest['action_items'])}"
        )

    return "\n\n---\n\n".join(relevant)


def generate_brief(attendees: list, topic: str, slot: str) -> dict:
    """Generate a structured pre-meeting brief using RAG context."""

    context = retrieve_context(attendees, topic)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an AI executive assistant preparing a pre-meeting brief. "
            "Use the past meeting context to create a genuinely useful brief. "
            "Be concise and actionable."
        ),
        (
            "user",
            "Generate a pre-meeting brief for the following:\n\n"
            "Meeting topic: {topic}\n"
            "Attendees: {attendees}\n"
            "Scheduled slot: {slot}\n\n"
            "Past meeting context (from RAG database):\n{context}\n\n"
            "Return a brief with:\n"
            "1. Key context from past meetings\n"
            "2. Open action items from previous meetings\n"
            "3. Suggested talking points\n"
            "4. Things to watch out for"
        )
    ])

    try:
        chain = prompt | llm
        result = chain.invoke({
            "topic": topic,
            "attendees": ", ".join(attendees),
            "slot": slot,
            "context": context
        })
        brief_text = result.content

    except Exception as e:
        print(f"Brief generation error: {e} — using template fallback")
        brief_text = (
            f"Pre-Meeting Brief: {topic}\n\n"
            f"Attendees: {', '.join(attendees)}\n"
            f"Slot: {slot}\n\n"
            f"Context from past meetings:\n{context}\n\n"
            f"Suggested talking points:\n"
            f"- Review open action items from previous meeting\n"
            f"- Align on priorities for this session\n"
            f"- Confirm owners and deadlines before closing"
        )

    return {
        "topic": topic,
        "attendees": attendees,
        "slot": slot,
        "brief": brief_text,
        "context_used": context
    }