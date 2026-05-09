#define _GNU_SOURCE
#include "fd_passing.h"
#include "filter.h"
#include "log.h"
#include "notif_loop.h"
#include "settings.h"

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <sys/socket.h>
#include <sys/wait.h>

static volatile sig_atomic_t g_child_exited = 0;
static volatile sig_atomic_t g_child_status = 0;
static pid_t g_child_pid = 0;

static void on_sigchld(int signo) {
    (void)signo;
    int saved = errno;
    int status;
    pid_t r = waitpid(g_child_pid, &status, WNOHANG);
    if (r == g_child_pid) {
        g_child_exited = 1;
        g_child_status = status;
    }
    errno = saved;
}

static void usage(const char *prog) {
    fprintf(stderr,
            "usage: %s [--log <path>] [--agent <name>] [--config <path>] "
            "-- <program> [args...]\n",
            prog);
    exit(2);
}

static int run_child(int sock_to_parent, char **child_argv) {
    int listener_fd = install_seccomp_filter();
    if (listener_fd < 0) {
        perror("[wardlm] install_seccomp_filter");
        return 127;
    }
    if (send_fd(sock_to_parent, listener_fd) < 0) {
        perror("[wardlm] send_fd");
        return 127;
    }
    char ack;
    if (read(sock_to_parent, &ack, 1) != 1) {
        perror("[wardlm] ack read");
        return 127;
    }
    close(sock_to_parent);
    close(listener_fd);
    execvp(child_argv[0], child_argv);
    fprintf(stderr, "[wardlm] execvp(%s) failed: %s\n",
            child_argv[0], strerror(errno));
    return 127;
}

static int run_parent(int sock_to_child, pid_t child_pid) {
    g_child_pid = child_pid;

    struct sigaction sa = {0};
    sa.sa_handler = on_sigchld;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGCHLD, &sa, NULL);

    int listener_fd = recv_fd(sock_to_child);
    if (listener_fd < 0) {
        fprintf(stderr, "[wardlm] failed to receive listener fd\n");
        kill(child_pid, SIGKILL);
        waitpid(child_pid, NULL, 0);
        return 1;
    }
    char ack = 'A';
    if (write(sock_to_child, &ack, 1) != 1) {
        perror("[wardlm] ack write");
        kill(child_pid, SIGKILL);
        waitpid(child_pid, NULL, 0);
        return 1;
    }
    close(sock_to_child);

    notif_loop(listener_fd, &g_child_exited);
    close(listener_fd);

    if (!g_child_exited) {
        int status;
        if (waitpid(child_pid, &status, 0) == child_pid) {
            g_child_status = status;
            g_child_exited = 1;
        }
    }

    if (WIFEXITED(g_child_status)) return WEXITSTATUS(g_child_status);
    if (WIFSIGNALED(g_child_status)) return 128 + WTERMSIG(g_child_status);
    return 1;
}

int main(int argc, char **argv) {
    const char *log_path = NULL;
    const char *agent = NULL;
    const char *config_path = NULL;
    int i = 1;
    while (i < argc) {
        if (strcmp(argv[i], "--log") == 0 && i + 1 < argc) {
            log_path = argv[i + 1];
            i += 2;
        } else if (strcmp(argv[i], "--agent") == 0 && i + 1 < argc) {
            agent = argv[i + 1];
            i += 2;
        } else if (strcmp(argv[i], "--config") == 0 && i + 1 < argc) {
            config_path = argv[i + 1];
            i += 2;
        } else if (strcmp(argv[i], "--") == 0) {
            i++;
            break;
        } else {
            usage(argv[0]);
        }
    }
    if (i >= argc) usage(argv[0]);
    char **child_argv = &argv[i];

    if (settings_load(config_path) < 0) {
        fprintf(stderr, "[wardlm] failed to load settings (%s)\n",
                config_path ? config_path : "default path");
        return 1;
    }

    log_set_path(log_path);
    log_set_agent(agent);

    int sv[2];
    if (socketpair(AF_UNIX, SOCK_STREAM, 0, sv) < 0) {
        perror("socketpair");
        return 1;
    }

    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        close(sv[0]);
        int rc = run_child(sv[1], child_argv);
        _exit(rc);
    }

    close(sv[1]);
    return run_parent(sv[0], pid);
}
