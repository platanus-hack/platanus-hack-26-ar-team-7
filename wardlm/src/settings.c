#define _GNU_SOURCE
#include "settings.h"

#include <ctype.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define SYSTEM_PATH "/etc/wardlm/settings.json"

static char  g_model_id[128]    = "claude-haiku-4-5";
static int   g_max_tokens       = 80;
static long  g_timeout_seconds  = 30;
static char  g_api_url[256]     = "https://api.anthropic.com/v1/messages";
static char  g_api_version[64]  = "2023-06-01";

static char *g_policy_raw       = NULL;  /* unescaped raw policy text */
static char *g_policy_effective = NULL;  /* policy after filtering */
static char *g_checks_block     = NULL;  /* malloc'd copy of inner of "securityChecks":{...} */

/* Compile-time default policy. Tags match wardlm-electron's
 * securityChecks keys (shared.ts:12-16): nonReversibleDestructive,
 * sudoAccess, obfuscation, networking. Lines without a [tag] prefix
 * (e.g. credential theft) are always emitted regardless of toggles. */
static const char *DEFAULT_POLICY =
    "You are a security policy classifier for execve syscalls. Given a binary path and its argv, decide BLOCK or ALLOW.\n"
    "\n"
    "BLOCK only if the command matches one of the rules below. The list is exhaustive \xe2\x80\x94 if no rule matches, ALLOW.\n"
    "[sudoAccess]- Sudo / privilege escalation requests not initiated by the user\n"
    "[obfuscation]- Obfuscated payloads (base64 -d piped to sh, hex-decoded shell strings, dynamically-built commands)\n"
    "[networking]- Reverse shells (nc -e, bash -i over TCP, python pty.spawn, etc.)\n"
    "[networking]- Pipes to remote shells (curl ... | sh, wget ... | bash)\n"
    "[nonReversibleDestructive]- Destructive data ops that are hard or impossible to reverse\n"
    "- Credential theft (reading /etc/shadow, ~/.ssh/id_*, GPG keys)\n"
    "[sudoAccess]- Privilege escalation attempts (suid abuse, kernel exploits)\n"
    "[networking]- Data exfil to suspicious endpoints (anonymous paste sites, etc.)\n"
    "\n"
    "Do NOT block based on:\n"
    "- Unusual binary paths (e.g. system utilities under ~/.nvm/, ~/.rvm/, /opt/, version managers, language tool dirs)\n"
    "- Unfamiliar argv combinations that don't match a rule above\n"
    "- Vague suspicion or \"might be\" reasoning\n"
    "\n"
    "If no rule above matches the command exactly, ALLOW. False positives break developer workflows.\n"
    "\n"
    "The `reason` slug for blocks must reference one of the listed rule categories (e.g. destructive, credential_theft, reverse_shell), not the binary name or its path.\n"
    "\n"
    "Respond with EXACTLY one line of strict JSON, no markdown, no prose:\n"
    "{\"decision\":\"block\",\"reason\":\"<short_slug>\"}\n"
    "{\"decision\":\"allow\",\"reason\":\"<short_slug>\"}";

static char *slurp_file(const char *path, size_t *out_len) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return NULL; }
    long n = ftell(f);
    if (n < 0) { fclose(f); return NULL; }
    rewind(f);
    char *buf = malloc((size_t)n + 1);
    if (!buf) { fclose(f); return NULL; }
    size_t r = fread(buf, 1, (size_t)n, f);
    fclose(f);
    buf[r] = '\0';
    if (out_len) *out_len = r;
    return buf;
}

/* Locate the value position (after the colon) for a top-level key
 * inside the JSON object pointed to by `obj`. Trusted-input parser:
 * does not handle keys appearing inside string values. */
static const char *find_value(const char *obj, const char *key) {
    char needle[128];
    int n = snprintf(needle, sizeof(needle), "\"%s\"", key);
    if (n <= 0 || (size_t)n >= sizeof(needle)) return NULL;
    const char *p = strstr(obj, needle);
    if (!p) return NULL;
    p += n;
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    if (*p != ':') return NULL;
    p++;
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    return p;
}

/* Read a JSON string at `p` (which must point at the opening quote)
 * into `out`, decoding common escapes. Returns pointer past the
 * closing quote, or NULL on error. If `out` is NULL the value is just
 * skipped over. */
static const char *parse_string(const char *p, char *out, size_t out_len) {
    if (*p != '"') return NULL;
    p++;
    size_t i = 0;
    while (*p && *p != '"') {
        char c;
        if (*p == '\\' && p[1]) {
            p++;
            switch (*p) {
                case 'n':  c = '\n'; break;
                case 't':  c = '\t'; break;
                case 'r':  c = '\r'; break;
                case 'b':  c = '\b'; break;
                case 'f':  c = '\f'; break;
                case '"':  c = '"';  break;
                case '\\': c = '\\'; break;
                case '/':  c = '/';  break;
                default:   c = *p;   break;
            }
            p++;
        } else {
            c = *p++;
        }
        if (out && i + 1 < out_len) out[i++] = c;
    }
    if (*p != '"') return NULL;
    if (out && out_len > 0) out[i] = '\0';
    return p + 1;
}

/* Allocate and return the unescaped contents of the JSON string
 * starting at `p` (must be at the opening quote). NULL on error. */
static char *parse_string_dup(const char *p) {
    if (*p != '"') return NULL;
    /* First pass: measure unescaped length. */
    const char *q = p + 1;
    size_t n = 0;
    while (*q && *q != '"') {
        if (*q == '\\' && q[1]) q += 2;
        else q++;
        n++;
    }
    if (*q != '"') return NULL;
    char *out = malloc(n + 1);
    if (!out) return NULL;
    if (!parse_string(p, out, n + 1)) { free(out); return NULL; }
    return out;
}

/* Copy the body of the object starting at `p` (must point at `{`) up
 * to and not including the matching `}`. Returns malloc'd inner text
 * (without the braces) or NULL. */
static char *parse_object_dup(const char *p) {
    if (*p != '{') return NULL;
    int depth = 1;
    const char *start = p + 1;
    const char *q = start;
    int in_str = 0;
    while (*q) {
        if (in_str) {
            if (*q == '\\' && q[1]) { q += 2; continue; }
            if (*q == '"') in_str = 0;
        } else {
            if (*q == '"') in_str = 1;
            else if (*q == '{') depth++;
            else if (*q == '}') {
                depth--;
                if (depth == 0) break;
            }
        }
        q++;
    }
    if (*q != '}') return NULL;
    size_t n = (size_t)(q - start);
    char *out = malloc(n + 1);
    if (!out) return NULL;
    memcpy(out, start, n);
    out[n] = '\0';
    return out;
}

/* Look up a boolean flag in the cached securityChecks block. Returns 1
 * if true, 0 if false, and `default_val` if the key is absent. Callers
 * pass default_val=1 so that on a fresh install (no settings file
 * written by wardlm-electron yet) every check is on — biased toward
 * safety until the user expresses a preference. */
static int check_enabled(const char *name, int default_val) {
    if (!g_checks_block) return default_val;
    const char *p = find_value(g_checks_block, name);
    if (!p) return default_val;
    if (strncmp(p, "true", 4) == 0) return 1;
    if (strncmp(p, "false", 5) == 0) return 0;
    return default_val;
}

/* Build g_policy_effective from g_policy_raw, dropping each line
 * tagged `[name]` whose check is false. Tag is stripped from kept
 * lines. */
static int build_effective_policy(void) {
    free(g_policy_effective);
    g_policy_effective = NULL;
    if (!g_policy_raw) return -1;

    size_t cap = strlen(g_policy_raw) + 1;
    char *out = malloc(cap);
    if (!out) return -1;
    size_t out_len = 0;

    const char *p = g_policy_raw;
    while (*p) {
        const char *line_start = p;
        while (*p && *p != '\n') p++;
        size_t line_len = (size_t)(p - line_start);

        const char *content = line_start;
        size_t content_len = line_len;

        if (line_len > 0 && line_start[0] == '[') {
            const char *close = memchr(line_start, ']', line_len);
            if (close) {
                size_t name_len = (size_t)(close - line_start - 1);
                char name[64];
                if (name_len < sizeof(name)) {
                    memcpy(name, line_start + 1, name_len);
                    name[name_len] = '\0';
                    if (!check_enabled(name, 1)) {
                        if (*p == '\n') p++;
                        continue;
                    }
                    content = close + 1;
                    content_len = line_len - (name_len + 2);
                }
            }
        }

        memcpy(out + out_len, content, content_len);
        out_len += content_len;
        if (*p == '\n') {
            out[out_len++] = '\n';
            p++;
        }
    }
    out[out_len] = '\0';
    g_policy_effective = out;
    return 0;
}

int settings_load(const char *path) {
    if (!path) path = getenv("WARDLM_SETTINGS");

    /* Default resolution: $XDG_CONFIG_HOME/wardlm/settings.json (the
     * file managed by wardlm-electron), then /etc/wardlm/settings.json.
     * A missing file is non-fatal — we boot with embedded defaults. */
    static char user_path[PATH_MAX];
    if (!path || !*path) {
        const char *xdg = getenv("XDG_CONFIG_HOME");
        if (xdg && xdg[0] == '/') {
            snprintf(user_path, sizeof(user_path),
                     "%s/wardlm/settings.json", xdg);
        } else {
            const char *home = getenv("HOME");
            if (home && *home) {
                snprintf(user_path, sizeof(user_path),
                         "%s/.config/wardlm/settings.json", home);
            } else {
                user_path[0] = '\0';
            }
        }
        if (user_path[0] && access(user_path, R_OK) == 0) path = user_path;
        if (!path) path = SYSTEM_PATH;
    }

    char *buf = slurp_file(path, NULL);

    /* Reset overrides each load so a previously-loaded checks block or
     * file-based policy doesn't leak into a later call with a different
     * (or absent) file. Static model.* keep their compile-time defaults
     * unless the file overrides them. */
    free(g_checks_block);
    g_checks_block = NULL;
    free(g_policy_raw);
    g_policy_raw = NULL;

    if (buf) {
        /* model.* (Electron never writes this; kept for testability) */
        const char *model = find_value(buf, "model");
        if (model && *model == '{') {
            char *model_obj = parse_object_dup(model);
            if (model_obj) {
                const char *v;
                if ((v = find_value(model_obj, "id")) && *v == '"')
                    parse_string(v, g_model_id, sizeof(g_model_id));
                if ((v = find_value(model_obj, "max_tokens")))
                    g_max_tokens = (int)strtol(v, NULL, 10);
                if ((v = find_value(model_obj, "timeout_seconds")))
                    g_timeout_seconds = strtol(v, NULL, 10);
                if ((v = find_value(model_obj, "api_url")) && *v == '"')
                    parse_string(v, g_api_url, sizeof(g_api_url));
                if ((v = find_value(model_obj, "api_version")) && *v == '"')
                    parse_string(v, g_api_version, sizeof(g_api_version));
                free(model_obj);
            }
        }

        /* securityChecks: cache the raw inner block for later lookups */
        const char *checks = find_value(buf, "securityChecks");
        if (checks && *checks == '{') {
            g_checks_block = parse_object_dup(checks);
        }

        /* policy override (Electron never writes this; staging hook only) */
        const char *policy = find_value(buf, "policy");
        if (policy && *policy == '"') {
            g_policy_raw = parse_string_dup(policy);
        }

        free(buf);
    }

    if (!g_policy_raw) {
        g_policy_raw = strdup(DEFAULT_POLICY);
        if (!g_policy_raw) return -1;
    }
    return build_effective_policy();
}

const char *settings_model_id(void)        { return g_model_id; }
int         settings_max_tokens(void)      { return g_max_tokens; }
long        settings_timeout_seconds(void) { return g_timeout_seconds; }
const char *settings_api_url(void)         { return g_api_url; }
const char *settings_api_version(void)     { return g_api_version; }
const char *settings_effective_policy(void){ return g_policy_effective; }
