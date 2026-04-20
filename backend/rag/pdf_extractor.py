#!/usr/bin/env python3
"""
backend/rag/pdf_extractor.py

Extrai seções específicas das bulas da Anvisa em PDF.
Gera um índice JSON (bulas_index.json) para carregamento rápido em memória.

Bulas da Anvisa têm estrutura padronizada com seções numeradas:
  1. NOME DO MEDICAMENTO
  2. COMPOSIÇÃO
  3. INDICAÇÕES
  4. CONTRAINDICAÇÕES
  5. ADVERTÊNCIAS E PRECAUÇÕES
  6. INTERAÇÕES MEDICAMENTOSAS
  7. REAÇÕES ADVERSAS / EFEITOS COLATERAIS
  8. POSOLOGIA
  9. SUPERDOSE / SUPERDOSAGEM
  ...

USO (rodar uma vez após baixar os PDFs):
    cd smart-pills-dispenser   # raiz do projeto
    python3 -m backend.rag.pdf_extractor

    Ou diretamente:
    python3 backend/rag/pdf_extractor.py

SAÍDA:
    backend/rag/bulas_index.json
"""

import json
import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("❌ Instale o pdfplumber: pip install pdfplumber")
    sys.exit(1)

# =============================================================================
# CONFIGURAÇÃO
# =============================================================================

PDFS_DIR   = Path(__file__).parent / "pdfs"
INDEX_PATH = Path(__file__).parent / "bulas_index.json"

# Mapeamento: nome_arquivo (sem .pdf) → nome normalizado usado no retriever
PDF_TO_DRUG_KEY = {
    # PDFs disponíveis em backend/rag/pdfs/
    "losartana":   "losartana",
    "sinvastatina":"sinvastatina",
    "levotiroxina":"levotiroxina",
    "dipirona":    "dipirona",
    "ibuprofeno":  "ibuprofeno",
}

# Padrões de cabeçalhos de seção nas bulas da Anvisa
# A Anvisa usa variações como "6. INTERAÇÕES MEDICAMENTOSAS" ou
# "6- INTERAÇÕES MEDICAMENTOSAS" ou só "INTERAÇÕES MEDICAMENTOSAS"
SECTION_PATTERNS = {
    "interacoes": [
        r"intera[çc][õo]es\s+medicamentosas",
        r"intera[çc][õo]es\s+com\s+outros\s+medicamentos",
        r"intera[çc][õo]es\s+drug",
    ],
    "contraindicacoes": [
        r"contraindica[çc][õo]es",
        r"contra[- ]indica[çc][õo]es",
        r"quando\s+n[ãa]o\s+devo\s+usar",
    ],
    "posologia": [
        r"posologia",
        r"modo\s+de\s+usar",
        r"como\s+devo\s+usar",
        r"dosagem",
    ],
    "advertencias": [
        r"advert[êe]ncias\s+e\s+precau[çc][õo]es",
        r"advert[êe]ncias",
        r"precau[çc][õo]es\s+e\s+advert[êe]ncias",
        r"o\s+que\s+devo\s+saber\s+antes",
        r"cuidados\s+e\s+advert[êe]ncias",
    ],
    "reacoes_adversas": [
        r"rea[çc][õo]es\s+adversas",
        r"efeitos\s+colaterais",
        r"efeitos\s+indesej[áa]veis",
        r"quais\s+os\s+males\s+que\s+este\s+medicamento\s+pode\s+me\s+causar",
    ],
}

# Seções que NÃO queremos (para detectar onde a seção termina)
SKIP_SECTIONS = [
    r"composi[çc][ãa]o",
    r"indica[çc][õo]es",
    r"superdose",
    r"superdosagem",
    r"caracter[íi]sticas\s+farmacol[óo]gicas",
    r"armazenagem",
    r"embalagem",
    r"dados\s+cl[íi]nicos",
    r"dados\s+farmac[êe]uticos",
]


# =============================================================================
# EXTRAÇÃO
# =============================================================================

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extrai todo o texto de um PDF usando pdfplumber."""
    text_parts = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        print(f"    ⚠️  Erro ao ler {pdf_path.name}: {e}")
        return ""
    return "\n".join(text_parts)


def find_section_boundaries(text: str) -> list[tuple[str, int]]:
    """
    Encontra os índices de início de cada seção no texto.
    Retorna lista de (nome_secao, posição_inicio) ordenada por posição.
    """
    boundaries = []
    text_lower = text.lower()

    # Seções que queremos
    for section_name, patterns in SECTION_PATTERNS.items():
        for pattern in patterns:
            # Busca padrão com possível número de seção antes
            full_pattern = rf"(?:\d+[\.\-\s]+)?{pattern}"
            for match in re.finditer(full_pattern, text_lower):
                boundaries.append((section_name, match.start()))
                break  # Primeiro match de cada seção

    # Seções que marcam o fim (não queremos o conteúdo)
    for pattern in SKIP_SECTIONS:
        full_pattern = rf"(?:\d+[\.\-\s]+)?{pattern}"
        for match in re.finditer(full_pattern, text_lower):
            boundaries.append(("__skip__", match.start()))

    return sorted(boundaries, key=lambda x: x[1])


def extract_sections(text: str, max_chars_per_section: int = 2000) -> dict[str, str]:
    """
    Extrai o conteúdo de cada seção relevante do texto da bula.
    Limita a max_chars_per_section caracteres por seção para não inflar o prompt.
    """
    boundaries = find_section_boundaries(text)
    sections: dict[str, str] = {}

    for i, (section_name, start_pos) in enumerate(boundaries):
        if section_name == "__skip__":
            continue

        # Determina o fim da seção (início da próxima)
        end_pos = boundaries[i + 1][1] if i + 1 < len(boundaries) else len(text)

        # Extrai o conteúdo
        content = text[start_pos:end_pos].strip()

        # Remove o cabeçalho da seção (primeira linha)
        lines = content.split("\n")
        content = "\n".join(lines[1:]).strip() if len(lines) > 1 else content

        # Limpa espaços extras e linhas vazias múltiplas
        content = re.sub(r"\n{3,}", "\n\n", content)
        content = re.sub(r"[ \t]+", " ", content)

        # Limita o tamanho
        if len(content) > max_chars_per_section:
            # Corta no final de uma frase
            cutoff = content.rfind(".", 0, max_chars_per_section)
            content = content[:cutoff + 1] if cutoff > 0 else content[:max_chars_per_section]
            content += " [...]"

        if content and len(content) > 50:  # Ignora seções muito curtas (provavelmente erro)
            # Se a seção já existe, mantém o mais longo (melhor extração)
            if section_name not in sections or len(content) > len(sections[section_name]):
                sections[section_name] = content

    return sections


# =============================================================================
# ÍNDICE
# =============================================================================

def build_index() -> dict:
    """
    Processa todos os PDFs em PDFS_DIR e gera o índice bulas_index.json.
    Retorna o índice gerado.
    """
    print("📚 Construindo índice de bulas...\n")

    if not PDFS_DIR.exists():
        print(f"❌ Pasta de PDFs não encontrada: {PDFS_DIR}")
        print(f"   Rode primeiro: python3 download_bulas.py")
        return {}

    index = {}
    pdf_files = list(PDFS_DIR.glob("*.pdf"))

    if not pdf_files:
        print(f"❌ Nenhum PDF encontrado em {PDFS_DIR}")
        return {}

    for pdf_path in sorted(pdf_files):
        drug_key = PDF_TO_DRUG_KEY.get(pdf_path.stem)
        if not drug_key:
            print(f"  ⏭️  {pdf_path.name} — sem mapeamento de medicamento, pulando")
            continue

        print(f"  📄 Processando: {pdf_path.name}")
        text = extract_text_from_pdf(pdf_path)

        if not text:
            print(f"     ❌ Texto vazio")
            continue

        sections = extract_sections(text)

        if not sections:
            print(f"     ⚠️  Nenhuma seção encontrada (estrutura do PDF pode ser diferente)")
        else:
            found = list(sections.keys())
            print(f"     ✅ Seções extraídas: {', '.join(found)}")

        index[drug_key] = {
            "source": pdf_path.name,
            "sections": sections,
        }

    # Salva o índice
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Índice salvo em: {INDEX_PATH}")
    print(f"   {len(index)} medicamentos indexados")
    return index


def load_index() -> dict:
    """
    Carrega o índice de bulas do JSON.
    Se não existir, tenta construir automaticamente.
    """
    if not INDEX_PATH.exists():
        print("⚠️  bulas_index.json não encontrado. Construindo...")
        return build_index()

    with open(INDEX_PATH, encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    build_index()
