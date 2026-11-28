#!/usr/bin/env bash
# Higgsfield Director PRO: link the skill into Claude Code or Codex. Plain bash; nothing is installed or overwritten.
#
#   ./install.sh                     from a clone: detect the agent, pick the scope, link the skill
#   curl -fsSL https://raw.githubusercontent.com/rniedson/hfd/main/install.sh | bash
#                                    the same, cloning the repository first (into ~/hfd, or --dir)
#
# Options:
#   --agent claude|codex   the agent, when both are installed or to skip the detection
#   --scope project|user   Claude Code only: this project's .claude/skills/, or ~/.claude/skills/ for every session
#   --project DIR          the project for --scope project (default: the current folder)
#   --dir DIR              where to clone when the script does not run from a clone (default: $HFD_HOME or ~/hfd)
#   --yes                  ask nothing: take the defaults, and stop where a choice is needed
#   --dry-run              say what would be done, change nothing
#   -h, --help             this text
set -euo pipefail

REPO_URL="https://github.com/rniedson/hfd.git"
NAME="higgsfield-director"
AGENT="" SCOPE="" PROJECT="$PWD" CLONE_DIR="${HFD_HOME:-$HOME/hfd}" YES=0 DRY=0

die() { echo "install.sh: $*" >&2; exit 1; }
usage() { sed -n '2,15p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --agent) AGENT="${2:-}"; shift 2 ;;
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --project) PROJECT="${2:-}"; shift 2 ;;
    --dir) CLONE_DIR="${2:-}"; shift 2 ;;
    --yes) YES=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
done
case "$AGENT" in ""|claude|codex) ;; *) die "--agent is claude or codex, not '$AGENT'" ;; esac
case "$SCOPE" in ""|project|user) ;; *) die "--scope is project or user, not '$SCOPE'" ;; esac

# A question on the terminal (also under curl | bash, whose standard input is the script). Without a terminal, or
# with --yes, the answer is the default.
ask() {
  local question="$1" default="$2" answer=""
  if [ "$YES" = 0 ] && { : </dev/tty; } 2>/dev/null; then
    printf '%s ' "$question" >/dev/tty
    read -r answer </dev/tty || answer=""
  fi
  echo "${answer:-$default}"
}

# 1. The skill folder: next to this script in a clone, otherwise in a clone made now.
SRC=""
if [ -f "${BASH_SOURCE[0]:-}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  [ -f "$here/$NAME/SKILL.md" ] && SRC="$here/$NAME"
fi
CLONED=""
if [ -z "$SRC" ]; then
  if [ -f "$CLONE_DIR/$NAME/SKILL.md" ]; then
    CLONED="using the clone already in $CLONE_DIR"
  elif [ -e "$CLONE_DIR" ]; then
    die "$CLONE_DIR exists and is not a clone of $REPO_URL; choose another folder with --dir"
  elif [ "$DRY" = 1 ]; then
    CLONED="would clone $REPO_URL into $CLONE_DIR"
  else
    command -v git >/dev/null 2>&1 || die "git is needed to clone $REPO_URL"
    git clone --quiet --depth 1 "$REPO_URL" "$CLONE_DIR"
    CLONED="cloned $REPO_URL into $CLONE_DIR"
  fi
  SRC="$(cd "$(dirname "$CLONE_DIR")" 2>/dev/null && pwd -P)/$(basename "$CLONE_DIR")/$NAME"
fi

# 2. The agent.
if [ -z "$AGENT" ]; then
  has_claude=0 has_codex=0
  command -v claude >/dev/null 2>&1 && has_claude=1
  command -v codex >/dev/null 2>&1 && has_codex=1
  if [ "$has_claude" = 1 ] && [ "$has_codex" = 1 ]; then
    case "$(ask 'Claude Code and Codex are both installed. Link the skill for which? [claude/codex]' '')" in
      claude|c) AGENT=claude ;;
      codex|x) AGENT=codex ;;
      *) die "Claude Code and Codex are both installed: say which with --agent claude or --agent codex" ;;
    esac
  elif [ "$has_claude" = 1 ]; then AGENT=claude
  elif [ "$has_codex" = 1 ]; then AGENT=codex
  else die "neither claude nor codex is on the PATH: install one, or say which with --agent"
  fi
fi

# 3. The scope and the link's place.
if [ "$AGENT" = codex ]; then
  [ -z "$SCOPE" ] || [ "$SCOPE" = user ] || die "Codex reads skills from ~/.agents/skills/ only: --scope user"
  SCOPE=user
  DEST="$HOME/.agents/skills/$NAME"
  LABEL="Codex"
  CONNECT="codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp, then codex mcp login higgsfield"
else
  PROJECT="$(cd "$PROJECT" 2>/dev/null && pwd -P)" || die "no such project folder"
  if [ -z "$SCOPE" ]; then
    if [ -d "$PROJECT/.claude" ]; then default=project; else default=user; fi
    case "$(ask "Link the skill for this project only (p, $PROJECT) or for every Claude Code session (u)? [p/u, default ${default:0:1}]" "$default")" in
      p|project) SCOPE=project ;;
      u|user) SCOPE=user ;;
      *) die "answer p (this project) or u (every session), or use --scope" ;;
    esac
  fi
  if [ "$SCOPE" = project ]; then DEST="$PROJECT/.claude/skills/$NAME"; else DEST="$HOME/.claude/skills/$NAME"; fi
  LABEL="Claude Code"
  CONNECT="enable the Higgsfield connector on claude.ai, then open a new session"
fi

# 4. The link: never over something that is already there.
STATE="linked"
if [ -L "$DEST" ]; then
  [ "$(readlink "$DEST")" = "$SRC" ] || die "$DEST already exists and points to $(readlink "$DEST"); not overwritten (remove it first: rm \"$DEST\")"
  STATE="already linked"
elif [ -e "$DEST" ]; then
  die "$DEST already exists and is not a link; not overwritten"
elif [ "$DRY" = 1 ]; then
  STATE="would link"
else
  mkdir -p "$(dirname "$DEST")"
  ln -s "$SRC" "$DEST"
fi

# 5. What was done, and how to undo it.
if [ "$SCOPE" = project ]; then where="project ($PROJECT)"; else where="user (every session)"; fi
echo "Higgsfield Director PRO: install"
echo
[ -z "$CLONED" ] || echo "  Source:   $CLONED"
echo "  Agent:    $LABEL"
echo "  Scope:    $where"
echo "  Link:     $DEST -> $SRC ($STATE)"
echo
echo "  To remove:            rm \"$DEST\"   (no trailing slash: it deletes only the link)"
echo "  To connect Higgsfield: $CONNECT"
echo "  Sessions already open may need a restart to see the skill."
