# backend/rag/bulas_data.py
"""
Configuração do RAG: aliases de medicamentos e keywords de seções.

NÃO contém chunks de texto hardcoded — o conteúdo vem exclusivamente
dos PDFs oficiais em backend/rag/pdfs/ (bulas_index.json).

Se um medicamento não tiver PDF disponível, o sistema não injeta
contexto de bula e o Gemini responde com conhecimento próprio.
"""

import json
import pathlib

_INDEX_PATH = pathlib.Path(__file__).parent / "bulas_index.json"

with open(_INDEX_PATH, encoding="utf-8") as _f:
    _raw = json.load(_f)

# drug_key → dict de seções (ex: {"posologia": "...", "interacoes": "..."})
BULAS: dict[str, dict[str, str]] = {
    key: data["sections"]
    for key, data in _raw.items()
}

# Aliases: mapeiam variações de nome → chave normalizada (= nome do PDF sem extensão)
ALIASES: dict[str, str] = {
    # Losartana
    "losartana":            "losartana",
    "losartana potassica":  "losartana",
    "losartana potássica":  "losartana",
    "cozaar":               "losartana",
    # Sinvastatina
    "sinvastatina":         "sinvastatina",
    "zocor":                "sinvastatina",
    # Levotiroxina
    "levotiroxina":             "levotiroxina",
    "levotiroxina sodica":      "levotiroxina",
    "levotiroxina sódica":      "levotiroxina",
    "puran":                    "levotiroxina",
    "puran t4":                 "levotiroxina",
    "synthroid":                "levotiroxina",
    # Dipirona
    "dipirona":             "dipirona",
    "dipirona sodica":      "dipirona",
    "dipirona sódica":      "dipirona",
    "novalgina":            "dipirona",
    "analgina":             "dipirona",
    # Ibuprofeno
    "ibuprofeno":           "ibuprofeno",
    "advil":                "ibuprofeno",
    "alivium":              "ibuprofeno",
    "buscofem":             "ibuprofeno",
}

# Keywords que indicam qual seção da bula é mais relevante para a pergunta
SECTION_KEYWORDS: dict[str, list[str]] = {
    "interacoes": [
        "interação", "interações", "junto", "combinação", "combinar",
        "junto com", "ao mesmo tempo", "concomitante", "misturar",
        "toranja", "grapefruit", "álcool", "bebida", "vinho",
        "outro medicamento", "outros remédios",
    ],
    "contraindicacoes": [
        "contraindicado", "não pode", "não devo", "não posso",
        "proibido", "não é indicado", "gestante", "grávida",
        "gravidez", "amamentação", "amamentar",
    ],
    "posologia": [
        "dose", "dosagem", "posologia", "quantas vezes", "quando tomar",
        "horário", "jejum", "refeição", "antes de comer", "depois de comer",
        "tomar como", "modo de usar", "comprimido", "esqueci",
    ],
    "advertencias": [
        "cuidado", "atenção", "alerta", "aviso", "risco",
        "perigo", "seguro", "perigoso", "monitorar", "monitoramento",
        "precaução", "advertência",
    ],
    "reacoes_adversas": [
        "efeito colateral", "efeitos colaterais", "reação adversa",
        "reações adversas", "efeito indesejado", "sintoma", "sintomas",
        "mal estar", "enjoo", "náusea", "tontura",
    ],
}


def resolve_drug_name(name: str) -> str | None:
    """Resolve nome de medicamento para chave normalizada (= nome do PDF sem .pdf)."""
    return ALIASES.get(name.lower().strip())