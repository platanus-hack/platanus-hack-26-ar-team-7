#ifndef EXEC_GUARD_FILTER_H
#define EXEC_GUARD_FILTER_H

/* Sets PR_SET_NO_NEW_PRIVS and installs a seccomp BPF filter that traps
 * execve and execveat with SECCOMP_RET_USER_NOTIF. Returns the user
 * notification listener fd, or -1 on failure (errno set). Must be called
 * in the process that will go on to exec the supervised binary. */
int install_seccomp_filter(void);

#endif
