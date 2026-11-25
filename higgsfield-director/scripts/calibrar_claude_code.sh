#!/usr/bin/env bash
# Calibração às cegas no Claude Code: o mesmo pedido em duas sessões novas, uma COM e outra SEM a skill,
# sem poder gastar crédito. Cada sessão grava o seu params.json; depois, `hfd.py cego` sorteia X e Y.
#
# Uso: calibrar_claude_code.sh <pedido.txt> <pasta-nova> [prefixo-das-ferramentas-mcp]
#   prefixo padrão: mcp__claude_ai_Higgsfield__  (o conector do claude.ai; confira o seu com /mcp)
# Saída: <pasta>/com/params.json e <pasta>/sem/params.json, mais os registros das sessões em <pasta>/log/.
set -euo pipefail

PEDIDO="${1:?uso: calibrar_claude_code.sh <pedido.txt> <pasta-nova> [prefixo-mcp]}"
PASTA="${2:?uso: calibrar_claude_code.sh <pedido.txt> <pasta-nova> [prefixo-mcp]}"
H="${3:-mcp__claude_ai_Higgsfield__}"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"

command -v claude >/dev/null || { echo "erro: o comando 'claude' (Claude Code) não está no PATH" >&2; exit 2; }
[ -f "$PEDIDO" ] || { echo "erro: pedido não encontrado: $PEDIDO" >&2; exit 2; }
[ -e "$PASTA" ] && { echo "erro: $PASTA já existe; use uma pasta nova por rodada" >&2; exit 2; }

# A condição SEM só é limpa se a skill não estiver instalada para o usuário inteiro.
for d in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  if [ -d "$d" ] && grep -rqs -e '^name: higgsfield-director' "$d"/*/SKILL.md; then
    echo "erro: a skill está instalada em $d; a sessão SEM a skill a veria. Tire-a de lá durante a calibração." >&2
    exit 2
  fi
done

SUFIXO=" Escreva o prompt e os parâmetros de cada tomada, prontos para gerar, e diga quanto custa. Salve os \
parâmetros finais em params.json, nesta pasta, como a lista requests do generate_video_batch (ou do \
generate_image_batch). Se precisar de uma imagem de referência antes, descreva-a em imagem.json. Não gere nada."
TEXTO="$(cat "$PEDIDO")$SUFIXO"

LER=(Skill Read Write Glob Grep ToolSearch "Bash(python3:*)" "${H}models_explore" "${H}estimate_video_cost"
     "${H}estimate_image_cost" "${H}get_workflow_instructions" "${H}get_workflow_bundle_file" "${H}balance"
     "${H}get_preset_instructions" "${H}get_presets" "${H}get_preferences")
NEGAR=(Edit NotebookEdit Agent "Bash(rm:*)" "Bash(curl:*)" "Bash(git:*)" "Bash(ssh:*)")
for t in generate_video generate_image generate_audio generate_video_batch generate_image_batch \
         generate_audio_batch generate_3d execute_preset upscale_image upscale_video remove_background \
         outpaint_image reframe voice_change motion_control ai_influencer_generate ai_influencer_prepare \
         ads_studio_generate gpu_rent gpu_generate gpu_job_start gpu_rental_generate media_upload \
         media_import_url media_confirm sandbox_exec create_project update_preferences; do
  NEGAR+=("${H}$t")
done

mkdir -p "$PASTA/com/.claude/skills" "$PASTA/sem" "$PASTA/log"
ln -s "$SKILL" "$PASTA/com/.claude/skills/higgsfield-director"

for cond in com sem; do
  echo "rodando a condição $cond..." >&2
  ( cd "$PASTA/$cond" && claude -p "$TEXTO" --permission-mode default --output-format stream-json --verbose \
      --allowedTools "${LER[@]}" --disallowedTools "${NEGAR[@]}" > "../log/$cond.jsonl" 2> "../log/$cond.err" ) \
    || echo "aviso: a sessão $cond terminou com erro; veja $PASTA/log/$cond.err" >&2
done

for cond in com sem; do
  if [ -f "$PASTA/$cond/params.json" ]; then echo "ok: $PASTA/$cond/params.json"; else echo "falta: $PASTA/$cond/params.json"; fi
done
echo "próximo: python3 $SKILL/scripts/hfd.py cego --com $PASTA/com/params.json --sem $PASTA/sem/params.json --saida $PASTA/cego"
