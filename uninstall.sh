#!/usr/bin/env bash
# wardlm uninstaller. Reverses install.sh.
#
#   curl -fsSL https://raw.githubusercontent.com/platanus-hack/platanus-hack-26-ar-team-7/main/uninstall.sh | bash
#
# Removes:
#   - the wardlm-electron .deb (via dpkg/apt)
#   - /opt/wardlm/                    (CLI binary, shims, electron app)
#   - /etc/profile.d/wardlm.sh        (PATH wiring)
#   - /var/log/wardlm/                (audit log; asks for confirmation)
#   - ~/.wardlm/                      (API key; asks for confirmation)
#   - ~/.config/wardlm/               (settings written by wardlm-electron; asks for confirmation)

set -euo pipefail

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
fail() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# Reopen stdin from tty when piped (curl | bash) so prompts work.
if [ ! -t 0 ] && [ -e /dev/tty ]; then
    exec </dev/tty
fi

confirm() {
    local prompt="$1" reply
    if [ -t 0 ]; then
        printf '%s [y/N] ' "$prompt"
        read -r reply
        case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
    fi
    return 1   # non-interactive: default to "no" for destructive prompts
}

[ "$(uname -s)" = "Linux" ] || fail "wardlm only supports Linux"
command -v sudo >/dev/null || fail "sudo required"

# ---------- 1. wardlm-electron .deb ----------
if dpkg -s wardlm >/dev/null 2>&1; then
    log "removing wardlm-electron .deb"
    sudo apt-get purge -y wardlm 2>/dev/null || sudo dpkg -r wardlm
else
    log "wardlm .deb not installed (skipping)"
fi

# ---------- 2. /opt/wardlm ----------
if [ -d /opt/wardlm ]; then
    log "removing /opt/wardlm"
    sudo rm -rf /opt/wardlm
fi

# ---------- 3. PATH wiring ----------
if [ -e /etc/profile.d/wardlm.sh ]; then
    log "removing /etc/profile.d/wardlm.sh"
    sudo rm -f /etc/profile.d/wardlm.sh
fi

# ---------- 4. audit log ----------
if [ -d /var/log/wardlm ]; then
    if confirm "Remove /var/log/wardlm/ ? (audit history will be lost)"; then
        sudo rm -rf /var/log/wardlm
        log "removed /var/log/wardlm"
    else
        warn "kept /var/log/wardlm (remove manually with: sudo rm -rf /var/log/wardlm)"
    fi
fi

# ---------- 5. user secrets ----------
if [ -d "$HOME/.wardlm" ]; then
    if confirm "Remove ~/.wardlm/ ? (API key will be lost)"; then
        rm -rf "$HOME/.wardlm"
        log "removed $HOME/.wardlm"
    else
        warn "kept ~/.wardlm (remove manually with: rm -rf ~/.wardlm)"
    fi
fi

# ---------- 6. user settings (written by wardlm-electron) ----------
if [ -d "$HOME/.config/wardlm" ]; then
    if confirm "Remove ~/.config/wardlm/ ? (security-check toggles will be lost)"; then
        rm -rf "$HOME/.config/wardlm"
        log "removed $HOME/.config/wardlm"
    else
        warn "kept ~/.config/wardlm (remove manually with: rm -rf ~/.config/wardlm)"
    fi
fi

cat <<'EOF'

  wardlm uninstalled.

  Note: PATH changes from /etc/profile.d/wardlm.sh remain active in
  current shells until you open a new one.
EOF
