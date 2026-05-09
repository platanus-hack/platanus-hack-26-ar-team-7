#define _GNU_SOURCE
#include "log.h"
#include "json_util.h"

#include <fcntl.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>

static const char *g_log_path = NULL;

void log_set_path(const char *path) {
    g_log_path = path;
}

void log_jsonl(const char *decision, const char *reason,
               pid_t pid, const char *path,
               char **argv, int argc) {
    if (!g_log_path) return;
    int fd = open(g_log_path, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd < 0) return;
    FILE *f = fdopen(fd, "a");
    if (!f) { close(fd); return; }
    fprintf(f, "{\"ts\":%ld,\"decision\":\"%s\",\"reason\":\"",
            (long)time(NULL), decision);
    json_escape(f, reason ? reason : "");
    fprintf(f, "\",\"pid\":%d,\"path\":\"", pid);
    json_escape(f, path);
    fprintf(f, "\",\"argv\":[");
    for (int i = 0; i < argc; i++) {
        if (i) fputc(',', f);
        fputc('"', f);
        json_escape(f, argv[i]);
        fputc('"', f);
    }
    fprintf(f, "]}\n");
    fclose(f);
}
