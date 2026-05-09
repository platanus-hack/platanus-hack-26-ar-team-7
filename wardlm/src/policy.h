#ifndef EXEC_GUARD_POLICY_H
#define EXEC_GUARD_POLICY_H

/* Returns 1 if the exec of `path` with `argv` should be blocked, 0
 * otherwise. argv has `argc` entries (no trailing NULL counted). On
 * block, *reason is set to a short stable identifier suitable for
 * structured logging. */
int policy_should_block(const char *path,
                        char **argv, int argc,
                        const char **reason);

#endif
