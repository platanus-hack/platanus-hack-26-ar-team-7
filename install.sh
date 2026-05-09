#!/usr/bin/env bash
# wardlm installer.
#
#   curl -fsSL https://raw.githubusercontent.com/platanus-hack/platanus-hack-26-ar-team-7/main/install.sh | bash
#
# Builds and installs:
#   - wardlm (CLI exec-guard)         -> /opt/wardlm/bin, /opt/wardlm/shim
#   - wardlm-electron (audit viewer)  -> .deb installed via dpkg
#   - per-user config + secrets       -> ~/.wardlm/{settings.json,env}
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
    x86_64|aarch64) ;;
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
command -v sudo    >/dev/null || fail "sudo required"

# ---------- Phase 2: build deps ----------
log "installing build dependencies (apt)"
# Electron deps (fakeroot/dpkg-dev/nodejs/npm) only needed when building the
# .deb; skip them with --skip-electron. Also skip nodejs/npm if already in
# PATH (NodeSource installs bundle npm with nodejs and conflict with
# Debian's npm package).
apt_pkgs=(build-essential libcurl4-openssl-dev git)
if [ "$skip_electron" -eq 0 ]; then
    apt_pkgs+=(fakeroot dpkg-dev)
    command -v node >/dev/null 2>&1 || apt_pkgs+=(nodejs)
    command -v npm  >/dev/null 2>&1 || apt_pkgs+=(npm)
fi
sudo apt-get update -qq
sudo apt-get install -y "${apt_pkgs[@]}"

# ---------- Phase 3: source code ----------
# If invoked from a checkout (./install.sh), use $PWD. Otherwise clone.
if [ -f "$PWD/install.sh" ] && [ -d "$PWD/wardlm" ] && [ -d "$PWD/wardlm-electron" ]; then
    REPO="$PWD"
    log "using local checkout: $REPO"
else
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

# ---------- Phase 5: build + install wardlm-electron .deb ----------
if [ "$skip_electron" -eq 0 ]; then
    log "building wardlm-electron .deb"
    (
        cd "$REPO/wardlm-electron"
        npm ci --no-audit --no-fund
        npx --yes electron-forge make --targets=@electron-forge/maker-deb
    )

    deb="$(ls -t "$REPO/wardlm-electron/out/make/deb/"*"/wardlm"_*.deb 2>/dev/null | head -1 || true)"
    [ -n "$deb" ] || fail "no .deb produced under wardlm-electron/out/make/deb/"

    log "installing $(basename "$deb") (sudo)"
    sudo dpkg -i "$deb" || sudo apt-get install -f -y
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
log "per-user setup in ~/.wardlm/"
mkdir -p "$HOME/.wardlm"
chmod 0700 "$HOME/.wardlm"

if [ -f "$HOME/.wardlm/settings.json" ]; then
    log "preserving existing ~/.wardlm/settings.json"
else
    cp "$REPO/wardlm/config/settings.json" "$HOME/.wardlm/settings.json"
    chmod 0644 "$HOME/.wardlm/settings.json"
    log "wrote ~/.wardlm/settings.json"
fi

# API key: env var wins, else prompt.
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    key="$ANTHROPIC_API_KEY"
    log "using ANTHROPIC_API_KEY from environment"
else
    if [ ! -t 0 ]; then
        # Reopen stdin from the controlling tty when piped (curl | bash).
        if [ -e /dev/tty ]; then
            exec </dev/tty
        else
            warn "no tty available to prompt for API key; skipping (set up ~/.wardlm/env manually)"
            key=""
        fi
    fi
    if [ -z "${key:-}" ]; then
        # `read -rs` is bash's password-style silent input; avoids the
        # stty -echo / restore dance which can leave terminals stuck in
        # emulated VMs.
        printf 'Anthropic API key (sk-ant-...): '
        read -rs key
        echo
    fi
fi

if [ -n "$key" ]; then
    [[ "$key" =~ ^sk-ant- ]] || fail "key must start with sk-ant-"
    umask 077
    printf 'export ANTHROPIC_API_KEY=%q\n' "$key" > "$HOME/.wardlm/env"
    chmod 0600 "$HOME/.wardlm/env"
    log "wrote ~/.wardlm/env"
fi

# ---------- Phase 8: summary ----------
cat <<'EOF'

  wardlm installed.

  CLI binary:    /opt/wardlm/bin/wardlm
  Shims:         /opt/wardlm/shim/   (25 agents)
  Audit log:     /var/log/wardlm/wardlm.log
  PATH config:   /etc/profile.d/wardlm.sh
  User config:   ~/.wardlm/settings.json
  User secrets:  ~/.wardlm/env       (mode 0600)

  Activate now in this shell:
    source /etc/profile.d/wardlm.sh
    . ~/.wardlm/env

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
