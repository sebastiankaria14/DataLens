from fastapi import APIRouter
from pydantic import BaseModel
from app.services.llm_service import ask_llm
from app.utils.prompt_builder import build_prompt
import json

router = APIRouter(prefix="/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    dataset_id: str
    question: str


def load_metadata(dataset_id: str):
    # Replace later with real profiling metadata
    return """
Columns:
Date (VARCHAR)
Close (DOUBLE)
High (DOUBLE)
Low (DOUBLE)
Open (DOUBLE)
Volume (BIGINT)

2514 rows. No missing values.
"""


@router.post("/")
def chat_with_dataset(request: ChatRequest):

    metadata = load_metadata(request.dataset_id)

    prompt = build_prompt(metadata, request.question)

    llm_response = ask_llm(prompt)

    try:
        parsed = json.loads(llm_response)
        return parsed
    except:
        return {"type": "text", "message": llm_response}
