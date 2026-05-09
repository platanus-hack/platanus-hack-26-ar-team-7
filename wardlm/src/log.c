#define _GNU_SOURCE
#include "log.h"
#include "json_util.h"

#include <fcntl.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>

/* Default log destination. Overridden by --log on the command line. */
static const char *g_log_path = "/var/log/wardlm/wardlm.log";
static const char *g_agent = "";

void log_set_path(const char *path) {
    if (path) g_log_path = path;
}

void log_set_agent(const char *agent) {
    g_agent = agent ? agent : "";
}

void log_jsonl(const char *decision, const char *reason,
               pid_t pid, const char *path,
               char **argv, int argc) {
    if (!g_log_path) return;
    int fd = open(g_log_path, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd < 0) return;
    FILE *f = fdopen(fd, "a");
    if (!f) { close(fd); return; }
    fprintf(f, "{\"ts\":%ld,\"agent\":\"", (long)time(NULL));
    json_escape(f, g_agent);
    fprintf(f, "\",\"decision\":\"%s\",\"reason\":\"", decision);
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
