#!/usr/bin/env bash
# Blind calibration in Claude Code: the same request in two new sessions, one WITH and one WITHOUT the skill,
# with no way to spend credits. Each session writes its own params.json; then `hfd.py blind` draws X and Y.
# Needs a Claude Code with --permission-mode dontAsk. Exit 0: both params.json written; 1: one is missing; 2: usage.
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

# The WITHOUT condition is only clean if no skill named higgsfield-director is installed for the whole user: in the
# user's skills, in the agents' skills, or inside a plugin; quoted or not in the frontmatter.
CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
NAME_RE='^name:[[:space:]]*["'"'"']?higgsfield-director["'"'"']?[[:space:]]*$'
for d in "$CONFIG/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$CONFIG/plugins"; do
  [ -d "$d" ] || continue
  hit="$(find -L "$d" -maxdepth 8 -name SKILL.md -exec grep -lsE "$NAME_RE" {} + 2>/dev/null | head -n 1 || true)"
  if [ -n "$hit" ]; then
    echo "error: the skill is installed for the whole user ($hit); the session WITHOUT the skill would see it. Remove it from there during the calibration." >&2
    exit 2
  fi
done

SUFFIX=" Write the prompt and the parameters of each shot, ready to generate, and say how much it costs. Save the \
final parameters in params.json, in this folder, as the requests list of generate_video_batch (or of \
generate_image_batch). If you need a reference image first, describe it in image.json. Do not generate anything."
TEXT="$(cat "$REQUEST")$SUFFIX"

# Each session may read, write its own files and use the catalog and quotes; nothing else. --permission-mode dontAsk
# refuses every tool that is not allowed here, whatever the user's settings say (a user default of bypassPermissions
# included). The WITH session may run only the skill's own helper, by any of the paths it can see; the WITHOUT session
# runs no command. The deny list is a second lock on the tools that generate, publish or spend.
ALLOW=(Skill Read Write Glob Grep ToolSearch "${H}models_explore" "${H}estimate_video_cost"
       "${H}estimate_image_cost" "${H}get_workflow_instructions" "${H}get_workflow_bundle_file" "${H}balance"
       "${H}get_preset_instructions" "${H}get_presets" "${H}get_preferences")
DENY=(Edit NotebookEdit Agent "Bash(rm:*)" "Bash(curl:*)" "Bash(git:*)" "Bash(ssh:*)" "Bash(claude:*)")
for t in generate_video generate_image generate_audio generate_video_batch generate_image_batch \
         generate_audio_batch generate_3d execute_preset upscale_image upscale_video remove_background \
         outpaint_image reframe voice_change motion_control ai_influencer_generate ai_influencer_prepare \
         ads_studio_generate gpu_rent gpu_generate gpu_job_start gpu_rental_generate media_upload \
         media_import_url media_confirm sandbox_exec create_project update_preferences create_voice \
         scene_builder_3d_generate_video scene_builder_3d_generate_angles editing_room_render_timeline \
         apps_invoke publish_project delete_project meta_ads_write deploy_website publish_website; do
  DENY+=("${H}$t")
done

mkdir -p "$FOLDER/log"
FOLDER_ABS="$(cd "$FOLDER" && pwd)"
missing=0
for cond in with without; do
  # each session works in its own new folder, away from the other's files, and its result is moved in afterwards
  WORK="$(mktemp -d)"
  RULES=()
  if [ "$cond" = with ]; then
    mkdir -p "$WORK/.claude/skills"
    ln -s "$SKILL" "$WORK/.claude/skills/higgsfield-director"
    for base in "$SKILL" "$WORK/.claude/skills/higgsfield-director" "$(cd "$WORK" && pwd -P)/.claude/skills/higgsfield-director" \
                ".claude/skills/higgsfield-director"; do
      RULES+=("Bash(python3 $base/scripts/hfd.py:*)")
    done
  fi
  echo "running the $cond condition..." >&2
  status=0
  ( cd "$WORK" && printf '%s' "$TEXT" | claude -p --permission-mode dontAsk --output-format stream-json --verbose \
      --allowedTools "${ALLOW[@]}" ${RULES[@]+"${RULES[@]}"} --disallowedTools "${DENY[@]}" \
      > "$FOLDER_ABS/log/$cond.jsonl" 2> "$FOLDER_ABS/log/$cond.err" ) || status=$?
  [ "$status" -eq 0 ] || echo "warning: the $cond session ended with exit $status; see $FOLDER/log/$cond.err" >&2
  mkdir -p "$FOLDER/$cond"
  cp -R "$WORK/." "$FOLDER/$cond/"
  rm -rf "$WORK"
done

for cond in with without; do
  if [ -f "$FOLDER/$cond/params.json" ]; then echo "ok: $FOLDER/$cond/params.json"
  else echo "missing: $FOLDER/$cond/params.json"; missing=1; fi
done
[ "$missing" -eq 0 ] || { echo "error: a condition has no params.json; nothing to draw" >&2; exit 1; }
echo "next: python3 $SKILL/scripts/hfd.py blind --with $FOLDER/with/params.json --without $FOLDER/without/params.json --out $FOLDER/blind"
