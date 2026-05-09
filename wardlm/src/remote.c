#define _GNU_SOURCE
#include "remote.h"
#include "common.h"

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <sys/uio.h>

#ifndef AT_EMPTY_PATH
#define AT_EMPTY_PATH 0x1000
#endif

static ssize_t read_remote(pid_t pid, uint64_t addr, void *dst, size_t len) {
    struct iovec local  = { .iov_base = dst, .iov_len = len };
    struct iovec remote = { .iov_base = (void *)(uintptr_t)addr, .iov_len = len };
    return process_vm_readv(pid, &local, 1, &remote, 1, 0);
}

int read_remote_cstr(pid_t pid, uint64_t addr, char *out, size_t out_len) {
    size_t i = 0;
    while (i + 1 < out_len) {
        size_t chunk = 256;
        if (i + chunk >= out_len) chunk = out_len - 1 - i;
        ssize_t got = read_remote(pid, addr + i, out + i, chunk);
        if (got <= 0) return -1;
        for (ssize_t j = 0; j < got; j++) {
            if (out[i + (size_t)j] == '\0') return 0;
        }
        i += (size_t)got;
    }
    out[out_len - 1] = '\0';
    return 0;
}

int read_remote_argv(pid_t pid, uint64_t argv_addr,
                     char **argv_out, int max_argv) {
    int argc = 0;
    while (argc < max_argv) {
        uint64_t ptr;
        if (read_remote(pid, argv_addr + (uint64_t)argc * sizeof(uint64_t),
                        &ptr, sizeof(ptr)) != (ssize_t)sizeof(ptr))
            break;
        if (ptr == 0) break;
        char *buf = malloc(MAX_ARG_LEN);
        if (!buf) break;
        if (read_remote_cstr(pid, ptr, buf, MAX_ARG_LEN) < 0) {
            free(buf);
            break;
        }
        argv_out[argc++] = buf;
    }
    argv_out[argc] = NULL;
    return argc;
}

void free_argv(char **argv, int argc) {
    for (int i = 0; i < argc; i++) free(argv[i]);
}

void resolve_exec_path(pid_t pid, int is_execveat, int dirfd,
                       const char *raw, int flags,
                       char *out, size_t out_len) {
    if (!is_execveat || raw[0] == '/') {
        snprintf(out, out_len, "%s", raw);
        return;
    }

    char link[64];
    char buf[MAX_PATH];

    if (raw[0] == '\0' && (flags & AT_EMPTY_PATH)) {
        snprintf(link, sizeof(link), "/proc/%d/fd/%d", pid, dirfd);
        ssize_t n = readlink(link, out, out_len - 1);
        if (n < 0) { snprintf(out, out_len, "<unreadable>"); return; }
        out[n] = '\0';
        return;
    }

    if (dirfd == AT_FDCWD)
        snprintf(link, sizeof(link), "/proc/%d/cwd", pid);
    else
        snprintf(link, sizeof(link), "/proc/%d/fd/%d", pid, dirfd);

    ssize_t n = readlink(link, buf, sizeof(buf) - 1);
    if (n < 0) { snprintf(out, out_len, "%s", raw); return; }
    buf[n] = '\0';
    snprintf(out, out_len, "%s/%s", buf, raw);
}
