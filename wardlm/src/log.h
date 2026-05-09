#ifndef WARDLM_LOG_H
#define WARDLM_LOG_H

#include <sys/types.h>

/* Sets the log file path. If path is NULL, log_jsonl() becomes a no-op.
 * The pointer is stored as-is (not copied) — caller keeps ownership and
 * must keep it alive for the process lifetime. */
void log_set_path(const char *path);

/* Sets the agent name emitted in each log line. Stored as-is (not
 * copied). NULL is treated as the empty string. */
void log_set_agent(const char *agent);

/* Appends a single JSONL line to the configured log file. Argv is an
 * array of `argc` strings. Strings are JSON-escaped. */
void log_jsonl(const char *decision, const char *reason,
               pid_t pid, const char *path,
               char **argv, int argc);

#endif
