#ifndef EXEC_GUARD_LOG_H
#define EXEC_GUARD_LOG_H

#include <sys/types.h>

/* Sets the log file path. If path is NULL, log_jsonl() becomes a no-op.
 * The pointer is stored as-is (not copied) — caller keeps ownership and
 * must keep it alive for the process lifetime. */
void log_set_path(const char *path);

/* Appends a single JSONL line to the configured log file. Argv is an
 * array of `argc` strings. Strings are JSON-escaped. */
void log_jsonl(const char *decision, const char *reason,
               pid_t pid, const char *path,
               char **argv, int argc);

#endif
