#!/usr/bin/env bash
# wardlm installer.
#
#   curl -fsSL https://wardlm.vercel.app/install.sh | bash
#
# Builds and installs:
#   - wardlm (CLI exec-guard)         -> /opt/wardlm/bin, /opt/wardlm/shim
#   - wardlm-electron (audit viewer)  -> .deb installed via dpkg
#   - per-user secrets                -> ~/.wardlm/env
#     (settings live at ~/.config/wardlm/settings.json, written by wardlm-electron)
#
# Flags:
#   --skip-electron    Install only the CLI (skip the Electron viewer).
#                      Useful on headless / emulated VMs where the
#                      electron-forge build is slow and the GUI isn't needed.
#   -h, --help         Show usage.
#
# Pass flags through curl|bash with `bash -s --`:
#   curl -fsSL .../install.sh | bash -s -- --skip-electron

set -euo pipefail

# ---------- Flag parsing ----------
skip_electron=0

usage() {
    cat <<EOF
usage: install.sh [--skip-electron]

Options:
  --skip-electron    Install only the wardlm CLI (skip the Electron viewer).
                     Avoids the npm + electron-forge build (slow on emulated VMs).
  -h, --help         Show this help.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-electron) skip_electron=1; shift ;;
        -h|--help)       usage; exit 0 ;;
        *)               printf 'unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
    esac
done

REPO_URL="https://github.com/platanus-hack/platanus-hack-26-ar-team-7.git"
REPO_BRANCH="main"
RELEASE_URL="https://github.com/platanus-hack/platanus-hack-26-ar-team-7/releases/latest/download"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() { [ -n "${TMPDIR_INSTALL:-}" ] && rm -rf "$TMPDIR_INSTALL"; }
trap cleanup EXIT

# ---------- Phase 1: preflight ----------
log "preflight checks"

[ "$(uname -s)" = "Linux" ] || fail "wardlm only supports Linux"
arch="$(uname -m)"
case "$arch" in
    x86_64)  deb_arch="amd64" ;;
    aarch64) deb_arch="arm64" ;;
    *) fail "unsupported arch: $arch (need x86_64 or aarch64)" ;;
esac

kver="$(uname -r)"
kmaj="$(echo "$kver" | cut -d. -f1)"
kmin="$(echo "$kver" | cut -d. -f2)"
if [ "$kmaj" -lt 5 ] || { [ "$kmaj" -eq 5 ] && [ "$kmin" -lt 8 ]; }; then
    fail "kernel >= 5.8 required (have $kver) for SECCOMP_FILTER_FLAG_NEW_LISTENER"
fi

command -v apt-get >/dev/null || fail "apt-get not found (Debian/Ubuntu only)"
command -v dpkg    >/dev/null || fail "dpkg not found (Debian/Ubuntu only)"
command -v curl    >/dev/null || fail "curl required to fetch the wardlm-electron .deb"
command -v sudo    >/dev/null || fail "sudo required"

# Validate ANTHROPIC_API_KEY format up front so a typo doesn't survive
# all the way past apt-get + the C build + the .deb install.
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    [[ "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]] \
        || fail "ANTHROPIC_API_KEY in env must start with sk-ant-"
fi

# Decide now whether we'll clone so we can skip installing git when
# the user invoked us from a local checkout.
need_clone=0
if [ -f "$PWD/install.sh" ] && [ -f "$PWD/wardlm/Makefile" ] && [ -d "$PWD/wardlm-electron" ]; then
    REPO="$PWD"
    log "using local checkout: $REPO"
else
    need_clone=1
fi

# ---------- Phase 2: build deps ----------
log "installing build dependencies (apt)"
sudo apt-get update -qq
deps=(build-essential libcurl4-openssl-dev)
[ "$need_clone" -eq 1 ] && deps+=(git)
sudo apt-get install -y "${deps[@]}"

# ---------- Phase 3: source code ----------
if [ "$need_clone" -eq 1 ]; then
    TMPDIR_INSTALL="$(mktemp -d)"
    REPO="$TMPDIR_INSTALL/repo"
    log "cloning $REPO_URL -> $REPO"
    git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$REPO"
fi

# ---------- Phase 4: build + install wardlm CLI ----------
log "building wardlm CLI"
make -C "$REPO/wardlm"

log "installing CLI to /opt/wardlm/{bin,shim} (sudo)"
sudo install -d -m 0755 /opt/wardlm/bin /opt/wardlm/shim
sudo install -d -m 1777 /var/log/wardlm
sudo install -m 0755 "$REPO/wardlm/wardlm" /opt/wardlm/bin/wardlm
sudo install -m 0755 "$REPO/wardlm"/shim/* /opt/wardlm/shim/

# ---------- Phase 5: download + install wardlm-electron .deb (GitHub release) ----------
if [ "$skip_electron" -eq 0 ]; then
    pkg_json="$REPO/wardlm-electron/package.json"
    if command -v jq >/dev/null 2>&1; then
        version="$(jq -r '.version' "$pkg_json")"
    elif command -v python3 >/dev/null 2>&1; then
        version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$pkg_json")"
    else
        version="$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$pkg_json" | head -1)"
    fi
    [ -n "$version" ] && [ "$version" != "null" ] \
        || fail "could not read version from $pkg_json"

    deb_name="wardlm_${version}_${deb_arch}.deb"
    deb_url="$RELEASE_URL/$deb_name"
    : "${TMPDIR_INSTALL:=$(mktemp -d)}"
    deb="$TMPDIR_INSTALL/$deb_name"

    log "downloading $deb_name from latest GitHub release"
    curl -fsSL --retry 3 -o "$deb" "$deb_url" \
        || fail "failed to download $deb_url"

    log "installing $deb_name (sudo)"
    if ! sudo dpkg -i "$deb"; then
        sudo apt-get install -f -y
    fi
    # apt-get install -f can "succeed" by removing the broken package,
    # leaving us with no electron viewer but a green script. Verify.
    dpkg -s wardlm >/dev/null 2>&1 \
        || fail "wardlm-electron .deb did not install cleanly (dpkg -s wardlm reports not installed)"
else
    log "skipping wardlm-electron (--skip-electron)"
fi

# ---------- Phase 6: PATH wiring ----------
log "wiring PATH via /etc/profile.d/wardlm.sh"
sudo tee /etc/profile.d/wardlm.sh >/dev/null <<'EOF'
export PATH="/opt/wardlm/shim:$PATH"
EOF
sudo chmod 0644 /etc/profile.d/wardlm.sh

# ---------- Phase 7: per-user setup ----------
log "per-user setup"

# Seed ~/.config/wardlm/settings.json with the repo defaults if missing.
# wardlm-electron writes this file on first launch; we replicate the same
# behaviour so --skip-electron installs still get a populated config and
# the wardlm CLI starts with consistent securityChecks (in particular,
# obfuscation=false to avoid false-positives on agents using base64+eval).
xdg_config="${XDG_CONFIG_HOME:-}"
[[ "$xdg_config" = /* ]] || xdg_config="$HOME/.config"
config_dir="$xdg_config/wardlm"
settings_file="$config_dir/settings.json"
mkdir -p "$config_dir"
if [ ! -f "$settings_file" ]; then
    cp "$REPO/wardlm/config/settings.json" "$settings_file"
    chmod 0644 "$settings_file"
    log "wrote $settings_file (defaults from repo)"
else
    log "preserving existing $settings_file"
fi

mkdir -p "$HOME/.wardlm"
chmod 0700 "$HOME/.wardlm"

# API key: env var wins, else prompt.
key=""
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    key="$ANTHROPIC_API_KEY"
    log "using ANTHROPIC_API_KEY from environment"
elif [ ! -e /dev/tty ]; then
    warn "no tty available to prompt for API key; skipping (set up ~/.wardlm/env manually)"
else
    # Read straight from /dev/tty (works under curl|bash without
    # touching the global stdin). `read -rs` does silent input, no stty
    # juggling.
    for attempt in 1 2 3; do
        printf 'Anthropic API key (sk-ant-...): ' >/dev/tty
        read -rs key </dev/tty
        printf '\n' >/dev/tty
        [ -z "$key" ] && break
        [[ "$key" =~ ^sk-ant- ]] && break
        warn "key must start with sk-ant- (attempt $attempt/3)"
        key=""
    done
fi

if [ -n "$key" ]; then
    (umask 077 && printf 'export ANTHROPIC_API_KEY=%q\n' "$key" > "$HOME/.wardlm/env")
    log "wrote ~/.wardlm/env"
fi

# /etc/profile.d only fires for login shells. Append the same PATH
# prepend to user rc files so interactive non-login shells (where
# ~/.local/bin etc. would otherwise shadow the shim) get it too.
# Bracketed markers let the uninstaller strip the block cleanly.
append_path_block() {
    local rc="$1"
    [ -f "$rc" ] || return 0
    grep -qF "# wardlm-path-begin" "$rc" && return 0
    {
        printf '\n# wardlm-path-begin\n'
        # $PATH expands when the rc file is sourced, not now.
        # shellcheck disable=SC2016
        printf 'export PATH="/opt/wardlm/shim:$PATH"\n'
        printf '# wardlm-path-end\n'
    } >> "$rc"
    log "appended PATH prepend to $rc"
}
append_path_block "$HOME/.bashrc"
append_path_block "$HOME/.zshrc"

# ---------- Phase 8: summary ----------
cat <<'EOF'

  wardlm installed.

  CLI binary:    /opt/wardlm/bin/wardlm
  Shims:         /opt/wardlm/shim/   (12 agents)
  Audit log:     /var/log/wardlm/wardlm.log
  PATH config:   /etc/profile.d/wardlm.sh
  User config:   ~/.config/wardlm/settings.json   (managed by wardlm-electron)
  User secrets:  ~/.wardlm/env                    (mode 0600)

  Activate now in this shell:
    source /etc/profile.d/wardlm.sh
EOF

if [ -f "$HOME/.wardlm/env" ]; then
    printf '    . ~/.wardlm/env\n'
else
    printf '    (~/.wardlm/env not yet created — set ANTHROPIC_API_KEY there)\n'
fi

cat <<'EOF'

  Or open a new terminal — login shells pick it up automatically.

  Watch the unified audit log:
    tail -f /var/log/wardlm/wardlm.log
EOF

if [ "$skip_electron" -eq 0 ]; then
    cat <<'EOF'

  Open the Electron viewer:
    wardlm
EOF
fi
