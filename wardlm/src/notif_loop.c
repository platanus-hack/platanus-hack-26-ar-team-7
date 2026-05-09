#define _GNU_SOURCE
#include "notif_loop.h"
#include "common.h"
#include "log.h"
#include "policy.h"
#include "remote.h"

#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <sys/ioctl.h>
#include <sys/syscall.h>

#include <linux/seccomp.h>

/* Best-effort write of a deny message to the victim process's stderr.
 * The victim is paused in seccomp until NOTIF_SEND, so /proc/<pid>/fd/2
 * still points at whatever the victim opened (typically the agent's
 * captured stderr pipe). On any error (closed/redirected fd, fast pid
 * reuse, EBADF) we silently give up — visibility is a courtesy, the
 * deny itself still happens. */
static void notify_victim_stderr(pid_t pid, const char *path,
                                 const char *reason) {
    char fd_path[64];
    snprintf(fd_path, sizeof(fd_path), "/proc/%d/fd/2", (int)pid);
    int fd = open(fd_path, O_WRONLY | O_NONBLOCK | O_NOCTTY | O_CLOEXEC);
    if (fd < 0) return;

    char msg[512];
    int n = snprintf(msg, sizeof(msg),
                     "[wardlm] DENY: %s — %s\n",
                     (reason && *reason) ? reason : "policy_block",
                     path ? path : "<unknown>");
    if (n > 0) {
        ssize_t r = write(fd, msg, (size_t)n);
        (void)r;
    }
    close(fd);
}

void notif_loop(int listener_fd, volatile sig_atomic_t *stop_flag) {
    struct seccomp_notif_sizes sizes;
    if (syscall(__NR_seccomp, SECCOMP_GET_NOTIF_SIZES, 0, &sizes) < 0) {
        perror("[wardlm] SECCOMP_GET_NOTIF_SIZES");
        return;
    }
    struct seccomp_notif *req = calloc(1, sizes.seccomp_notif);
    struct seccomp_notif_resp *resp = calloc(1, sizes.seccomp_notif_resp);
    if (!req || !resp) {
        perror("[wardlm] calloc");
        free(req); free(resp);
        return;
    }

    for (;;) {
        if (*stop_flag) break;

        memset(req, 0, sizes.seccomp_notif);
        if (ioctl(listener_fd, SECCOMP_IOCTL_NOTIF_RECV, req) < 0) {
            if (errno == EINTR) {
                if (*stop_flag) break;
                continue;
            }
            if (errno == ENOENT) continue;
            perror("[wardlm] NOTIF_RECV");
            break;
        }

        int is_execveat = (req->data.nr == __NR_execveat);
        uint64_t path_ptr = is_execveat ? req->data.args[1] : req->data.args[0];
        uint64_t argv_ptr = is_execveat ? req->data.args[2] : req->data.args[1];
        int dirfd = is_execveat ? (int)req->data.args[0] : 0;
        int execveat_flags = is_execveat ? (int)req->data.args[4] : 0;

        char raw[MAX_PATH];
        char path[MAX_PATH];
        char *argv[MAX_ARGV + 1] = {0};
        int argc = 0;

        if (read_remote_cstr(req->pid, path_ptr, raw, sizeof(raw)) < 0)
            snprintf(path, sizeof(path), "<unreadable>");
        else
            resolve_exec_path(req->pid, is_execveat, dirfd, raw,
                              execveat_flags, path, sizeof(path));
        argc = read_remote_argv(req->pid, argv_ptr, argv, MAX_ARGV);

        __u64 id = req->id;
        if (ioctl(listener_fd, SECCOMP_IOCTL_NOTIF_ID_VALID, &id) < 0) {
            free_argv(argv, argc);
            continue;
        }

        const char *reason = NULL;
        int block = policy_should_block(path, argv, argc, &reason);

        memset(resp, 0, sizes.seccomp_notif_resp);
        resp->id = req->id;
        if (block) {
            resp->error = -EACCES;
            resp->val = 0;
            resp->flags = 0;
            notify_victim_stderr((pid_t)req->pid, path, reason);
            log_jsonl("deny", reason, (pid_t)req->pid, path, argv, argc);
        } else {
            resp->error = 0;
            resp->val = 0;
            resp->flags = SECCOMP_USER_NOTIF_FLAG_CONTINUE;
            log_jsonl("allow", reason, (pid_t)req->pid, path, argv, argc);
        }

        if (ioctl(listener_fd, SECCOMP_IOCTL_NOTIF_SEND, resp) < 0
            && errno != ENOENT) {
            perror("[wardlm] NOTIF_SEND");
        }

        free_argv(argv, argc);
    }

    free(req);
    free(resp);
}
