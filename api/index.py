"""Punto de entrada único (serverless) del backend.

Local:   python -m uvicorn api.index:app --reload --port 8000
Vercel:  detecta `app` en api/index.py y lo despliega junto al frontend.
"""
import sys
from pathlib import Path
from typing import List, Literal, Optional

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import APIRouter, FastAPI  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from backend.designer import build, check_word  # noqa: E402
from backend.generator import LEVELS, generate_spec  # noqa: E402
from backend.rules import spec_sentences  # noqa: E402
from backend.validators import normalize_spec, sample_words, validate_spec  # noqa: E402


class RuleIn(BaseModel):
    symbol: str = ""
    mode: Literal["allow", "forbid"] = "allow"
    before: Optional[str] = None
    after: Optional[str] = None


class SpecIn(BaseModel):
    alphabet: List[str] = []
    start: str = ""
    end: str = ""
    rules: List[RuleIn] = []


class SpecBody(BaseModel):
    spec: SpecIn


class BuildBody(SpecBody):
    kind: Literal["AFD", "AFND"] = "AFD"


class WordBody(BuildBody):
    word: str = ""


class GenerateBody(BaseModel):
    level: Literal["facil", "medio", "dificil"] = "facil"
    alphabet_kind: Literal["random", "digits", "letters"] = "random"


app = FastAPI(title="Microproyecto AL - Autómatas Finitos")
router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "levels": list(LEVELS)}


def _validated(body):
    spec = normalize_spec(body.spec)
    return spec, validate_spec(spec)


@router.post("/designer/validate")
def designer_validate(body: SpecBody):
    spec, result = _validated(body)
    payload = {**result, "text": [], "examples": {"valid": [], "invalid": []}}
    if result["ok"]:
        payload["text"] = spec_sentences(spec)
        payload["examples"] = sample_words(spec)
    return payload


@router.post("/designer/build")
def designer_build(body: BuildBody):
    spec, result = _validated(body)
    if not result["ok"]:
        return {**result, "automaton": None, "steps": []}
    automaton, steps = build(spec, body.kind)
    return {**result, "text": spec_sentences(spec), "automaton": automaton, "steps": steps}


@router.post("/designer/check-word")
def designer_check_word(body: WordBody):
    spec, result = _validated(body)
    if not result["ok"]:
        return {"ok": False, "errors": result["errors"]}
    return {"ok": True, **check_word(spec, body.kind, body.word.strip())}


@router.post("/designer/generate")
def designer_generate(body: GenerateBody):
    spec = generate_spec(body.level, body.alphabet_kind)
    return {"level": body.level, "spec": spec, "text": spec_sentences(spec)}


app.include_router(router)
