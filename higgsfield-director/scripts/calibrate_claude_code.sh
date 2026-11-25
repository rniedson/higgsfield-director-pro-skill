#!/usr/bin/env bash
# Blind calibration in Claude Code: the same request in two new sessions, one WITH and one WITHOUT the skill,
# with no way to spend credits. Each session writes its own params.json; then `hfd.py blind` draws X and Y.
#
# Usage: calibrate_claude_code.sh <request.txt> <new-folder> [mcp-tool-prefix]
#   default prefix: mcp__claude_ai_Higgsfield__  (the claude.ai connector; check yours with /mcp)
# Output: <folder>/with/params.json and <folder>/without/params.json, plus the session logs in <folder>/log/.
set -euo pipefail

REQUEST="${1:?usage: calibrate_claude_code.sh <request.txt> <new-folder> [mcp-prefix]}"
FOLDER="${2:?usage: calibrate_claude_code.sh <request.txt> <new-folder> [mcp-prefix]}"
H="${3:-mcp__claude_ai_Higgsfield__}"
SKILL="$(cd "$(dirname "$0")/.." && pwd)"

command -v claude >/dev/null || { echo "error: the 'claude' command (Claude Code) is not on the PATH" >&2; exit 2; }
[ -f "$REQUEST" ] || { echo "error: request not found: $REQUEST" >&2; exit 2; }
[ -e "$FOLDER" ] && { echo "error: $FOLDER already exists; use a new folder for each round" >&2; exit 2; }

# The WITHOUT condition is only clean if the skill is not installed for the whole user.
for d in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  if [ -d "$d" ] && grep -rqs -e '^name: higgsfield-director' "$d"/*/SKILL.md; then
    echo "error: the skill is installed in $d; the session WITHOUT the skill would see it. Remove it from there during the calibration." >&2
    exit 2
  fi
done

SUFFIX=" Write the prompt and the parameters of each shot, ready to generate, and say how much it costs. Save the \
final parameters in params.json, in this folder, as the requests list of generate_video_batch (or of \
generate_image_batch). If you need a reference image first, describe it in image.json. Do not generate anything."
TEXT="$(cat "$REQUEST")$SUFFIX"

ALLOW=(Skill Read Write Glob Grep ToolSearch "Bash(python3:*)" "${H}models_explore" "${H}estimate_video_cost"
       "${H}estimate_image_cost" "${H}get_workflow_instructions" "${H}get_workflow_bundle_file" "${H}balance"
       "${H}get_preset_instructions" "${H}get_presets" "${H}get_preferences")
DENY=(Edit NotebookEdit Agent "Bash(rm:*)" "Bash(curl:*)" "Bash(git:*)" "Bash(ssh:*)")
for t in generate_video generate_image generate_audio generate_video_batch generate_image_batch \
         generate_audio_batch generate_3d execute_preset upscale_image upscale_video remove_background \
         outpaint_image reframe voice_change motion_control ai_influencer_generate ai_influencer_prepare \
         ads_studio_generate gpu_rent gpu_generate gpu_job_start gpu_rental_generate media_upload \
         media_import_url media_confirm sandbox_exec create_project update_preferences; do
  DENY+=("${H}$t")
done

mkdir -p "$FOLDER/with/.claude/skills" "$FOLDER/without" "$FOLDER/log"
ln -s "$SKILL" "$FOLDER/with/.claude/skills/higgsfield-director"

for cond in with without; do
  echo "running the $cond condition..." >&2
  ( cd "$FOLDER/$cond" && claude -p "$TEXT" --permission-mode default --output-format stream-json --verbose \
      --allowedTools "${ALLOW[@]}" --disallowedTools "${DENY[@]}" > "../log/$cond.jsonl" 2> "../log/$cond.err" ) \
    || echo "warning: the $cond session ended with an error; see $FOLDER/log/$cond.err" >&2
done

for cond in with without; do
  if [ -f "$FOLDER/$cond/params.json" ]; then echo "ok: $FOLDER/$cond/params.json"; else echo "missing: $FOLDER/$cond/params.json"; fi
done
echo "next: python3 $SKILL/scripts/hfd.py blind --with $FOLDER/with/params.json --without $FOLDER/without/params.json --out $FOLDER/blind"
