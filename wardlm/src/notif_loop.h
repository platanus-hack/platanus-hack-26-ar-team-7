#ifndef EXEC_GUARD_NOTIF_LOOP_H
#define EXEC_GUARD_NOTIF_LOOP_H

#include <signal.h>

/* Runs the seccomp user-notification dispatch loop on `listener_fd`.
 * For each intercepted execve/execveat: reads path and argv from the
 * caller process, asks policy_should_block(), and responds CONTINUE
 * or -EACCES. Loops until *stop_flag becomes non-zero (typically set
 * by a SIGCHLD handler when the supervised process dies). */
void notif_loop(int listener_fd, volatile sig_atomic_t *stop_flag);

#endif
