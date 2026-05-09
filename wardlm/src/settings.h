#ifndef WARDLM_SETTINGS_H
#define WARDLM_SETTINGS_H

#include <stddef.h>

/* Loads settings from a JSON file. If `path` is NULL, falls back to
 * the WARDLM_SETTINGS env var, then to /etc/wardlm/settings.json.
 * Returns 0 on success, -1 on error (file missing, malformed, etc.). */
int settings_load(const char *path);

const char *settings_model_id(void);
int         settings_max_tokens(void);
long        settings_timeout_seconds(void);
const char *settings_api_url(void);
const char *settings_api_version(void);

/* Returns the effective system prompt: the raw `policy` from settings,
 * with any line tagged `[check_name]...` stripped if checks[check_name]
 * is false. Lines without a tag are kept as-is. The returned pointer
 * stays valid until the next settings_load(). */
const char *settings_effective_policy(void);

#endif
