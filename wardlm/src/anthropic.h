#ifndef WARDLM_ANTHROPIC_H
#define WARDLM_ANTHROPIC_H

#include <stddef.h>

/* Asks Claude (via the Anthropic Messages API) whether the exec of
 * `path` with `argv` should be blocked. Reads ANTHROPIC_API_KEY from
 * the environment.
 *
 * Returns:
 *    1  block
 *    0  allow
 *   -1  error (no API key, network failure, parse error, etc.)
 *
 * If the call succeeds, `reason_out` is filled with the model's short
 * reason slug (truncated to fit). On error, `reason_out` is set to a
 * short error description. `reason_out_len` must be > 0. */
int anthropic_classify(const char *path, char **argv, int argc,
                       char *reason_out, size_t reason_out_len);

#endif
