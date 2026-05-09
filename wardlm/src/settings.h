#ifndef WARDLM_SETTINGS_H
#define WARDLM_SETTINGS_H

#include <stddef.h>

/* Loads settings from a JSON file. If `path` is NULL, falls back to
 * $WARDLM_SETTINGS, then $XDG_CONFIG_HOME/wardlm/settings.json (or
 * $HOME/.config/wardlm/settings.json), then /etc/wardlm/settings.json.
 * A missing file is non-fatal — embedded defaults take over. Returns
 * 0 on success, -1 only on allocation failure. */
int settings_load(const char *path);

const char *settings_model_id(void);
int         settings_max_tokens(void);
long        settings_timeout_seconds(void);
const char *settings_api_url(void);
const char *settings_api_version(void);

/* Returns the effective system prompt: the embedded default policy
 * (or a `policy` override from the file, if present), with any line
 * tagged `[check_name]...` stripped if securityChecks[check_name] is
 * false. Lines without a tag are kept as-is. The returned pointer
 * stays valid until the next settings_load(). */
const char *settings_effective_policy(void);

#endif
