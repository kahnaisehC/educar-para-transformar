#!/usr/bin/env bash
# Convierte un plan de trabajo en Markdown a PDF con portada, índice,
# estilos de impresión y diagramas Mermaid renderizados.
#
# Uso: ./scripts/build-plan-pdf.sh <plan.md> <salida.pdf>
set -euo pipefail

PLAN="${1:-docs/planDeTrabajoMovil.md}"
OUT="${2:-docs/pdf/planDeTrabajoMovil.pdf}"
IMAGE="docker.io/linuxserver/chromium:latest"

if [[ ! -f "$PLAN" ]]; then
  echo "Error: no se encontró el plan $PLAN" >&2
  exit 1
fi

CSS="docs/planDeTrabajo.css"
[[ -f "$CSS" ]] || CSS="$(dirname "$PLAN")/planDeTrabajo.css"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

MERMAID_JS="$WORK/mermaid.min.js"
if [[ ! -s "$MERMAID_JS" ]]; then
  echo "Descargando Mermaid..."
  curl -sL -o "$MERMAID_JS" \
    https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js
fi

cat > "$WORK/header.html" <<'HTML'
<style>
HTML
cat "$CSS" >> "$WORK/header.html"
cat >> "$WORK/header.html" <<'HTML'
  /* La portada y el índice ocupan una página propia cada uno. */
  .cover { min-height: 22cm; }
  pre.mermaid { text-align: center; border-left: none; background: none; }
  pre.mermaid svg { max-width: 100%; height: auto; }
</style>
HTML

# pandoc -> HTML. raw_html conserva la portada y el índice del documento.
#
# pandoc trata el contenido interno de un <div> con líneas en blanco como
# markdown y lo escapa, así que portada e índice se extraen aparte y se
# inyectan como HTML crudo en el resultado.
python3 - "$PLAN" "$WORK" <<'PY'
import json, re, sys, pathlib

plan, work = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
text = plan.read_text(encoding="utf8")
raw = []

def extract(match):
    raw.append(match.group(0))
    return f"\n\nDIVBLOCK{len(raw) - 1}\n\n"

text = re.sub(r'<div class="(?:cover|index-page)">.*?</div>\s*</div>', extract, text, flags=re.S)
(work / "raw.json").write_text(json.dumps(raw), encoding="utf8")
(work / "body.md").write_text(text, encoding="utf8")
PY

pandoc "$WORK/body.md" \
  --from=markdown+raw_html \
  --to=html5 \
  --standalone \
  --metadata title="Plan de Trabajo" \
  --include-in-header="$WORK/header.html" \
  --output="$WORK/plan.html"

# Se reemplazan los marcadores por el HTML crudo y se normalizan las rutas
# de las imágenes para que el navegador las encuentre desde el HTML temporal.
python3 - "$WORK/plan.html" "$WORK/raw.json" "$PLAN" <<'PY'
import json, re, sys, pathlib

html_path, raw_path, plan_path = (pathlib.Path(p) for p in sys.argv[1:4])
html = html_path.read_text(encoding="utf8")
raw = json.loads(raw_path.read_text(encoding="utf8"))
assets = (plan_path.parent / "assets").resolve()

# Pandoc envuelve los marcadores en <p>; se sustituye por el bloque completo.
for index, block in enumerate(raw):
    html = re.sub(
        r"<p>DIVBLOCK" + str(index) + r"</p>",
        lambda _m, b=block: b,
        html,
        flags=re.IGNORECASE,
    )

# Rutas absolutas para los logos de la portada.
html = html.replace('src="assets/', f'src="file://{assets}/')
html = re.sub(r"<p>DIVBLOCK\d+</p>", "", html)

# Pandoc emite un encabezado con el título que duplica la portada.
html = re.sub(r'<header id="title-block-header">.*?</header>', "", html, flags=re.S)

html_path.write_text(html, encoding="utf8")
PY

# Mermaid se carga desde archivo local para que la impresión no requiera red.
python3 - "$WORK/plan.html" "$MERMAID_JS" <<'PY'
import sys, pathlib

html_path, mermaid_js = sys.argv[1], sys.argv[2]
html = pathlib.Path(html_path).read_text(encoding="utf8")
js = pathlib.Path(mermaid_js).read_text(encoding="utf8")

# Mermaid debe terminar de renderizar antes de imprimir.
html = html.replace(
    "</body>",
    "<script>" + js + "</script>\n"
    "<script>\n"
    "  window.__MERMAID_DONE = false;\n"
    "  mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });\n"
    "  mermaid.run({ querySelector: 'pre.mermaid' })\n"
    "    .then(() => { window.__MERMAID_DONE = true; })\n"
    "    .catch((e) => { window.__MERMAID_DONE = true; console.error(e); });\n"
    "</script>\n"
    "</body>",
)

pathlib.Path(html_path).write_text(html, encoding="utf8")
PY

# Chromium imprime a PDF. Se prefiere el binario local (el mismo que usa la
# extensión markdown-pdf de VS Code) y se cae a la imagen de Podman si no está.
CHROME="${CHROME:-$HOME/.local/opt/chrome-headless-shell/chrome-headless-shell-linux64/chrome-headless-shell}"
CHROME_FLAGS=(
  --headless
  --no-sandbox
  --disable-gpu
  --disable-dev-shm-usage
  --run-all-compositor-stages-before-draw
  --no-pdf-header-footer
  --print-to-pdf-no-header
)

# Cada SVG renderizado por Mermaid lleva esta firma en su pie, así que sirve
# para comprobar que los diagramas se imprimieron y no quedó código suelto.
EXPECTED="$(grep -c '```mermaid' "$PLAN")"
ATTEMPTS=3

for attempt in $(seq 1 "$ATTEMPTS"); do
  rm -f "$WORK/result.pdf"

  if [[ -x "$CHROME" ]]; then
    "$CHROME" "${CHROME_FLAGS[@]}" \
      --virtual-time-budget=$((10000 * attempt)) \
      --print-to-pdf="$WORK/result.pdf" \
      "file://$WORK/plan.html" >/dev/null 2>&1
  else
    podman run --rm \
      --entrypoint chromium-browser \
      --volume "$WORK:/work:Z" \
      "$IMAGE" \
      "${CHROME_FLAGS[@]}" \
      --virtual-time-budget=$((10000 * attempt)) \
      "file:///work/plan.html" \
      --print-to-pdf="/work/result.pdf" >/dev/null 2>&1
  fi

  if [[ ! -s "$WORK/result.pdf" ]]; then
    echo "Intento $attempt: Chromium no generó el PDF, reintentando..." >&2
    continue
  fi

  # pdftotext no siempre está disponible; sin él se acepta el primer resultado.
  if command -v pdftotext >/dev/null; then
    RENDERED="$(pdftotext "$WORK/result.pdf" - | grep -c "mermaid version" || true)"
    if [[ "$RENDERED" -ne "$EXPECTED" ]]; then
      echo "Intento $attempt: $RENDERED/$EXPECTED diagramas renderizados, reintentando..." >&2
      continue
    fi
  fi

  break
done

if [[ ! -s "$WORK/result.pdf" ]]; then
  echo "Error: no se pudo generar el PDF (ni con Chromium local ni con Podman)" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
cp "$WORK/result.pdf" "$OUT"
PAGES="$(pdfinfo "$OUT" 2>/dev/null | awk '/^Pages/{print $2}' || echo "?")"
echo "PDF generado: $OUT ($PAGES páginas, $EXPECTED diagramas)"
