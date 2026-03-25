import whisper
import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel

# 🔹 Load env
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 🔹 Load Whisper model
model = whisper.load_model("base")


# 🔹 Pydantic Model (STRICT STRUCTURE)
class ActionItems(BaseModel):
    decisions: list
    assignees: list
    deadlines: list


# 🔹 Transcribe audio
def transcribe_audio(file_path):
    result = model.transcribe(file_path)
    return result["text"]


# 🔹 Extract structured actions
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel


# 🔹 Pydantic model
class ActionItems(BaseModel):
    decisions: list
    assignees: list
    deadlines: list


# 🔹 LangChain LLM
llm = ChatOpenAI(model="gpt-4o-mini")


def extract_actions(text):
    parser = PydanticOutputParser(pydantic_object=ActionItems)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "Extract structured meeting data."),
        ("user", """
        Extract decisions, assignees, and deadlines.

        Transcript:
        {text}

        {format_instructions}
        """)
    ])

    chain = prompt | llm | parser

    try:
        result = chain.invoke({
            "text": text,
            "format_instructions": parser.get_format_instructions()
        })

        return result.dict()

    except Exception as e:
        print("ERROR:", e)

        # fallback
        text_lower = text.lower()

        deadlines = []
        if "monday" in text_lower:
            deadlines.append("Next Monday")

        decisions = []
        if "meeting" in text_lower:
            decisions.append("Meeting scheduled")

        return ActionItems(
            decisions=decisions,
            assignees=[],
            deadlines=deadlines
        ).dict()