# Olympus Coder CLI Installer (macOS & Linux)
set -eu

AGENTS_HOME="${OLYMPUS_AGENTS_HOME:-$HOME/.agents}"
PREFIX_DIR="${OLYMPUS_INSTALL_PREFIX:-$AGENTS_HOME/agents/olympus-cli}"
AGENTS_BIN="$AGENTS_HOME/bin"
LOCAL_BIN="$HOME/.local/bin"

printf "\n🌋 Installing Olympus Coder CLI...\n\n"

if ! command -v npm >/dev/null 2>&1; then
  printf "✗ Error: npm (Node.js >= 22) is required. Install Node.js from https://nodejs.org first.\n" >&2
  exit 1
fi

mkdir -p "$PREFIX_DIR" "$AGENTS_BIN" "$LOCAL_BIN"
npm install -g --prefix "$PREFIX_DIR" "github:martianacademy/olympus-coder-cli" --no-audit --no-fund

ln -sf "$PREFIX_DIR/bin/olympus" "$AGENTS_BIN/olympus"
ln -sf "$PREFIX_DIR/bin/olympus" "$LOCAL_BIN/olympus"

case ":$PATH:" in
  *":$LOCAL_BIN:"*|*":$AGENTS_BIN:"*) ;;
  *)
    for rc_name in ".zshrc" ".bashrc" ".bash_profile"; do
      if [ -f "$HOME/$rc_name" ] && ! grep -Fq '.agents/bin' "$HOME/$rc_name"; then
        printf '\n# Olympus Coder CLI\nexport PATH="$HOME/.local/bin:$HOME/.agents/bin:$PATH"\n' >> "$HOME/$rc_name"
      fi
    done
    ;;
esac

printf "\n✓ Installed %s\n" "$("$AGENTS_BIN/olympus" --version)"
printf "✓ Run 'olympus login' to connect OpenRouter, Vercel AI Gateway, or Local Ollama.\n\n"
