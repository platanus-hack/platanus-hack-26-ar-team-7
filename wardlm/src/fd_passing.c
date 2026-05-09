#define _GNU_SOURCE
#include "fd_passing.h"

#include <string.h>

#include <sys/socket.h>
#include <sys/uio.h>

int send_fd(int sock, int fd) {
    char dummy = 'F';
    struct iovec iov = { .iov_base = &dummy, .iov_len = 1 };
    union {
        struct cmsghdr cmsg;
        char buf[CMSG_SPACE(sizeof(int))];
    } u;
    memset(&u, 0, sizeof(u));
    struct msghdr msg = {
        .msg_iov = &iov, .msg_iovlen = 1,
        .msg_control = u.buf, .msg_controllen = sizeof(u.buf),
    };
    struct cmsghdr *cmsg = CMSG_FIRSTHDR(&msg);
    cmsg->cmsg_level = SOL_SOCKET;
    cmsg->cmsg_type = SCM_RIGHTS;
    cmsg->cmsg_len = CMSG_LEN(sizeof(int));
    memcpy(CMSG_DATA(cmsg), &fd, sizeof(int));
    return sendmsg(sock, &msg, 0) < 0 ? -1 : 0;
}

int recv_fd(int sock) {
    char dummy;
    struct iovec iov = { .iov_base = &dummy, .iov_len = 1 };
    union {
        struct cmsghdr cmsg;
        char buf[CMSG_SPACE(sizeof(int))];
    } u;
    memset(&u, 0, sizeof(u));
    struct msghdr msg = {
        .msg_iov = &iov, .msg_iovlen = 1,
        .msg_control = u.buf, .msg_controllen = sizeof(u.buf),
    };
    if (recvmsg(sock, &msg, 0) < 0) return -1;
    struct cmsghdr *cmsg = CMSG_FIRSTHDR(&msg);
    if (!cmsg || cmsg->cmsg_level != SOL_SOCKET || cmsg->cmsg_type != SCM_RIGHTS)
        return -1;
    int fd;
    memcpy(&fd, CMSG_DATA(cmsg), sizeof(int));
    return fd;
}
