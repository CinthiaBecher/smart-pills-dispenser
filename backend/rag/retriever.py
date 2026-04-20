# backend/rag/retriever.py
"""
Retriever para RAG do chatbot farmacêutico.

Fonte única: índice gerado a partir das bulas oficiais em PDF (Anvisa).
Se um medicamento não tiver PDF disponível, não injeta contexto
e o Gemini responde com conhecimento próprio.
"""

from __future__ import annotations
from .bulas_data import ALIASES, SECTION_KEYWORDS, resolve_drug_name

_index: dict | None = None


def _get_index() -> dict:
    """Carrega o índice de bulas em memória. Carrega uma só vez."""
    global _index
    if _index is None:
        try:
            from .pdf_extractor import load_index
            _index = load_index()
            if not _index:
                print("⚠️  RAG: bulas_index.json vazio. Rode: python3 backend/rag/pdf_extractor.py")
        except Exception as e:
            print(f"⚠️  RAG: erro ao carregar índice ({e}). Rode: python3 backend/rag/pdf_extractor.py")
            _index = {}
    return _index


def _detect_relevant_sections(question: str) -> list[str]:
    """Detecta quais seções da bula são relevantes para a pergunta."""
    question_lower = question.lower()
    scores = {s: sum(1 for kw in kws if kw in question_lower)
              for s, kws in SECTION_KEYWORDS.items()}
    relevant = [s for s, score in sorted(scores.items(), key=lambda x: -x[1]) if score > 0]
    return relevant if relevant else ["interacoes", "advertencias", "posologia"]


def _detect_relevant_drugs(question: str, patient_drug_names: list[str]) -> list[str]:
    """Detecta quais medicamentos do paciente são relevantes para a pergunta."""
    question_lower = question.lower()
    mentioned: list[str] = []

    for drug_name in patient_drug_names:
        key = resolve_drug_name(drug_name)
        if not key:
            continue
        # Checa nome direto ou aliases
        found = drug_name.lower() in question_lower or any(
            alias in question_lower for alias, k in ALIASES.items() if k == key
        )
        if found and key not in mentioned:
            mentioned.append(key)

    # Se nenhum mencionado explicitamente, inclui todos com bula disponível
    if not mentioned:
        index = _get_index()
        for drug_name in patient_drug_names:
            key = resolve_drug_name(drug_name)
            if key and key in index and key not in mentioned:
                mentioned.append(key)

    return mentioned


SECTION_LABELS = {
    "interacoes":       "Interações Medicamentosas",
    "contraindicacoes": "Contraindicações",
    "posologia":        "Posologia e Modo de Usar",
    "advertencias":     "Advertências e Precauções",
    "reacoes_adversas": "Reações Adversas",
}


def get_relevant_chunks(
    question: str,
    patient_drug_names: list[str],
    max_drugs: int = 3,
    max_sections: int = 2,
) -> str:
    """
    Retorna chunks das bulas oficiais relevantes para injetar no prompt do Gemini.

    Fonte: bulas_index.json (gerado a partir dos PDFs oficiais da Anvisa).
    Se não houver bula disponível para os medicamentos do paciente, retorna "".
    """
    if not patient_drug_names:
        return ""

    index = _get_index()
    if not index:
        return ""

    relevant_drug_keys = _detect_relevant_drugs(question, patient_drug_names)[:max_drugs]
    relevant_sections  = _detect_relevant_sections(question)[:max_sections]

    if not relevant_drug_keys:
        return ""

    chunks_by_drug: list[str] = []

    for drug_key in relevant_drug_keys:
        drug_data = index.get(drug_key)
        if not drug_data:
            continue  # Sem PDF para este medicamento — pula silenciosamente

        drug_sections = drug_data.get("sections", {})
        display_name  = drug_key.replace("_", " ").title()

        drug_chunks = [
            f"  [{SECTION_LABELS.get(s, s)}]\n  {drug_sections[s].strip()}"
            for s in relevant_sections if drug_sections.get(s)
        ]

        if drug_chunks:
            chunks_by_drug.append(
                f"📋 {display_name} (Bula Oficial — Anvisa)\n"
                + "\n\n".join(drug_chunks)
            )

    if not chunks_by_drug:
        return ""

    header = (
        "=== INFORMAÇÕES DAS BULAS OFICIAIS (Anvisa) ===\n"
        "Use as informações abaixo para embasar sua resposta. "
        "Cite a bula do medicamento quando relevante.\n\n"
    )
    return header + "\n\n---\n\n".join(chunks_by_drug) + "\n\n=== FIM DAS BULAS ==="