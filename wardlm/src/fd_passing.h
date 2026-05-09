#ifndef EXEC_GUARD_FD_PASSING_H
#define EXEC_GUARD_FD_PASSING_H

/* Send/receive a single file descriptor over a connected unix-domain
 * socket using SCM_RIGHTS ancillary data. Both ends transfer one byte
 * of payload as a carrier for the cmsg. Return 0/fd on success, -1 on
 * error. */
int send_fd(int sock, int fd);
int recv_fd(int sock);

#endif
