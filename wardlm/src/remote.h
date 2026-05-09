#ifndef EXEC_GUARD_REMOTE_H
#define EXEC_GUARD_REMOTE_H

#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

/* Reads a NUL-terminated C string from address `addr` in process `pid`.
 * Writes up to out_len-1 bytes plus a NUL into `out`. Returns 0 on
 * success, -1 on error (target memory unreadable, process gone, etc). */
int read_remote_cstr(pid_t pid, uint64_t addr, char *out, size_t out_len);

/* Reads a NULL-terminated argv array starting at `argv_addr` in process
 * `pid`. Each non-NULL slot is malloc'd and copied into argv_out. The
 * caller owns the strings and must release them with free_argv(). The
 * argv_out buffer must hold at least max_argv + 1 entries. Returns the
 * number of strings read (excluding the trailing NULL). */
int read_remote_argv(pid_t pid, uint64_t argv_addr,
                     char **argv_out, int max_argv);

void free_argv(char **argv, int argc);

/* Resolves the path argument of an execve/execveat call into a string
 * suitable for policy decisions. For execveat:
 *   - absolute path: used as-is
 *   - empty path + AT_EMPTY_PATH: readlink /proc/<pid>/fd/<dirfd>
 *   - relative path + AT_FDCWD: readlink /proc/<pid>/cwd, prefix
 *   - relative path + dirfd:    readlink /proc/<pid>/fd/<dirfd>, prefix
 * For plain execve, `raw` is copied through unchanged. */
void resolve_exec_path(pid_t pid, int is_execveat, int dirfd,
                       const char *raw, int flags,
                       char *out, size_t out_len);

#endif
