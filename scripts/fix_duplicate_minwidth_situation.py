from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "frontend/src/pages/coproprietaire/CoproprietaireSituationFinanciere.tsx"

text = path.read_text(encoding="utf-8")
original = text

def dedupe_style_object(source: str, object_name: str) -> str:
    pattern = re.compile(
        rf"({object_name}: \{{\n)(.*?)(\n  \}},)",
        re.S,
    )

    def repl(match: re.Match) -> str:
        start, body, end = match.groups()
        seen = set()
        cleaned_lines = []

        for line in body.splitlines():
            key_match = re.match(r"\s*([A-Za-z0-9_]+):", line)
            key = key_match.group(1) if key_match else None

            if key in {"width", "maxWidth", "minWidth"}:
                if key in seen:
                    continue
                seen.add(key)

            cleaned_lines.append(line)

        return start + "\n".join(cleaned_lines) + end

    return pattern.sub(repl, source, count=1)

text = dedupe_style_object(text, "heroContent")
text = dedupe_style_object(text, "heroScore")

if text != original:
    path.write_text(text, encoding="utf-8")
    print("Doublons width/maxWidth/minWidth supprimés dans Situation financière.")
else:
    print("Aucun doublon trouvé.")
