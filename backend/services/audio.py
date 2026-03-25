import whisper

model = whisper.load_model("base")

def transcribe_audio(file_path):
    result = model.transcribe(file_path)
    return result["text"]


def extract_actions(text):
    actions = []

    if "deadline" in text.lower():
        actions.append("Discussed deadlines")

    if "assign" in text.lower():
        actions.append("Tasks assigned")

    return {
        "actions": actions
    }