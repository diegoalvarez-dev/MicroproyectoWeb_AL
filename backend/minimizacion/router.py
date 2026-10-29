"""Rutas HTTP del módulo 3 (se registran en api/index.py)."""
from typing import Dict, List, Literal

from fastapi import APIRouter
from pydantic import BaseModel

from . import service

router = APIRouter(prefix="/api/minimizer")


class NfaIn(BaseModel):
    alphabet: List[str] = []
    states: List[str] = []
    initial: str = ""
    finals: List[str] = []
    delta: Dict[str, Dict[str, List[str]]] = {}


class NfaBody(BaseModel):
    nfa: NfaIn


class NfaWordBody(NfaBody):
    word: str = ""


class GenerateBody(BaseModel):
    level: Literal["facil", "medio", "dificil"] = "facil"
    alphabet_kind: Literal["random", "digits", "letters"] = "random"


@router.post("/validate")
def validate(body: NfaBody):
    return service.validate(body.nfa)


@router.post("/run")
def run(body: NfaBody):
    return service.run(body.nfa)


@router.post("/check-word")
def check_word(body: NfaWordBody):
    return service.check_word(body.nfa, body.word.strip())


@router.post("/generate")
def generate(body: GenerateBody):
    return service.generate(body.level, body.alphabet_kind)