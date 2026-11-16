# Olympus Coder CLI — Standalone Zero-Dependency Installer (macOS & Linux)
# Installs directly from GitHub tarball without requiring git or npm.

set -eu

REPO_SLUG="${OLYMPUS_REPO:-martianacademy/olympus-coder-cli}"
GIT_REF="${OLYMPUS_REF:-main}"
OLYMPUS_HOME="${OLYMPUS_HOME:-$HOME/.olympus}"
INSTALL_DIR="${OLYMPUS_INSTALL_DIR:-$OLYMPUS_HOME/agents/olympus-cli}"
AGENTS_BIN="$OLYMPUS_HOME/bin"
LOCAL_BIN="${OLYMPUS_BIN_DIR:-$HOME/.local/bin}"
NODE_RUNTIME_DIR="$OLYMPUS_HOME/runtimes/node"
NODE_LTS_VERSION="${OLYMPUS_NODE_VERSION:-22.15.0}"

printf "\n🌋 Installing Olympus Coder CLI (%s@%s)...\n\n" "$REPO_SLUG" "$GIT_REF"

if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
  printf "✗ Error: curl and tar are required.\n" >&2
  exit 1
fi

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  CAND="$(command -v node)"
  if "$CAND" -e 'const [m]=process.versions.node.split(".").map(Number);process.exit(m>=22?0:1)' >/dev/null 2>&1; then
    NODE_BIN="$CAND"
  fi
fi

if [ -z "$NODE_BIN" ] && [ -x "$NODE_RUNTIME_DIR/bin/node" ]; then
  if "$NODE_RUNTIME_DIR/bin/node" -e 'const [m]=process.versions.node.split(".").map(Number);process.exit(m>=22?0:1)' >/dev/null 2>&1; then
    NODE_BIN="$NODE_RUNTIME_DIR/bin/node"
  fi
fi

if [ -z "$NODE_BIN" ]; then
  OS_NAME="$(uname -s)"
  ARCH_NAME="$(uname -m)"
  case "$OS_NAME" in
    Darwin) PLAT_OS="darwin" ;;
    Linux)  PLAT_OS="linux" ;;
    *) printf "✗ Unsupported OS: %s\n" "$OS_NAME" >&2; exit 1 ;;
  esac
  case "$ARCH_NAME" in
    arm64|aarch64) PLAT_ARCH="arm64" ;;
    x86_64|amd64)  PLAT_ARCH="x64" ;;
    *) printf "✗ Unsupported CPU: %s\n" "$ARCH_NAME" >&2; exit 1 ;;
  esac
  EXT_TGZ="tar.gz"
  NODE_URL="https://nodejs.org/dist/v${NODE_LTS_VERSION}/node-v${NODE_LTS_VERSION}-${PLAT_OS}-${PLAT_ARCH}.${EXT_TGZ}"
  printf "⚡ Bootstrapping standalone Node.js v%s runtime...\n" "$NODE_LTS_VERSION"
  TMP_NODE="$(mktemp -d)"
  curl -fsSL "$NODE_URL" -o "$TMP_NODE/node-archive"
  rm -rf "$NODE_RUNTIME_DIR"
  mkdir -p "$NODE_RUNTIME_DIR"
  tar -xzf "$TMP_NODE/node-archive" -C "$NODE_RUNTIME_DIR" --strip-components=1
  rm -rf "$TMP_NODE"
  NODE_BIN="$NODE_RUNTIME_DIR/bin/node"
fi

TMP_STAGE="$(mktemp -d)"
trap 'rm -rf "$TMP_STAGE"' EXIT

EXT_TGZ="tar.gz"
ARCHIVE_URL="https://github.com/${REPO_SLUG}/archive/refs/heads/${GIT_REF}.${EXT_TGZ}"
curl -fsSL "$ARCHIVE_URL" -o "$TMP_STAGE/repo-archive"
mkdir -p "$TMP_STAGE/pkg"
tar -xzf "$TMP_STAGE/repo-archive" -C "$TMP_STAGE/pkg" --strip-components=1

mkdir -p "$(dirname "$INSTALL_DIR")" "$AGENTS_BIN" "$LOCAL_BIN" "$OLYMPUS_HOME/cli"
# Migrate legacy ~/.agents/olympus-cli settings & sessions once if present
if [ -d "$HOME/.agents/olympus-cli" ] && [ ! -f "$OLYMPUS_HOME/cli/settings.json" ]; then
  cp -R "$HOME/.agents/olympus-cli/." "$OLYMPUS_HOME/cli/" 2>/dev/null || true
fi
rm -rf "$INSTALL_DIR"
mv "$TMP_STAGE/pkg" "$INSTALL_DIR"

ENTRY_NAME="olympus.js"
write_shim() {
  TARGET_SHIM="$1"
  {
    printf '#!%s\n' "$(command -v sh)"
    printf 'set -e\n'
    printf 'if [ -x "%s" ]; then\n' "$NODE_BIN"
    printf '  exec "%s" "%s/bin/%s" "$@"\n' "$NODE_BIN" "$INSTALL_DIR" "$ENTRY_NAME"
    printf 'fi\n'
    printf 'exec node "%s/bin/%s" "$@"\n' "$INSTALL_DIR" "$ENTRY_NAME"
  } > "$TARGET_SHIM"
  chmod +x "$TARGET_SHIM"
}

write_shim "$AGENTS_BIN/oly"
write_shim "$AGENTS_BIN/olympus"
if [ "$LOCAL_BIN" != "$AGENTS_BIN" ]; then
  write_shim "$LOCAL_BIN/oly"
  write_shim "$LOCAL_BIN/olympus"
fi

case ":$PATH:" in
  *":$AGENTS_BIN:"*) ;;
  *)
    for rc_name in ".zshrc" ".bashrc" ".bash_profile"; do
      if [ -f "$HOME/$rc_name" ] && ! grep -Fq '.olympus/bin' "$HOME/$rc_name"; then
        printf '\n# Olympus Coder CLI\nexport PATH="$HOME/.local/bin:$HOME/.olympus/bin:$PATH"\n' >> "$HOME/$rc_name"
        printf "✓ Added ~/.local/bin and ~/.olympus/bin to ~/%s\n" "$rc_name"
      fi
    done
    ;;
esac

VER_OUT="$("$AGENTS_BIN/oly" --version)"
printf "\n✓ Installed %s to %s\n" "$VER_OUT" "$INSTALL_DIR"
printf "✓ Commands linked: oly (and alias olympus)\n"
printf "✓ If opening a current shell, run:  export PATH=\"\$HOME/.local/bin:\$HOME/.olympus/bin:\$PATH\"\n"
printf "✓ Configure your API key:          oly login\n"
printf "✓ Start coding session:            oly\n\n"
