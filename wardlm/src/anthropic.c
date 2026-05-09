#define _GNU_SOURCE
#include "anthropic.h"
#include "json_util.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <curl/curl.h>

#define ANTHROPIC_URL     "https://api.anthropic.com/v1/messages"
#define ANTHROPIC_VERSION "2023-06-01"
#define MODEL_ID          "claude-haiku-4-5"
#define MAX_TOKENS        200
#define HTTP_TIMEOUT_SECS 5L

static const char SYSTEM_PROMPT[] =
    "You are a security policy classifier for execve syscalls. "
    "Given a binary path and its argv, decide whether to BLOCK or ALLOW.\n\n"
    "BLOCK clearly malicious or destructive commands:\n"
    "- Reverse shells (nc -e, bash -i over TCP, python pty.spawn, etc.)\n"
    "- Pipes to remote shells (curl ... | sh, wget ... | bash)\n"
    "- Destructive ops on system paths (rm -rf /, dd of=/dev/sdX, mkfs)\n"
    "- Credential theft (reading /etc/shadow, ~/.ssh/id_*, GPG keys)\n"
    "- Privilege escalation attempts (suid abuse, kernel exploits)\n"
    "- Data exfil to suspicious endpoints (anonymous paste sites, etc.)\n\n"
    "ALLOW legitimate development commands: editors, compilers, package "
    "managers, build tools, version control, language runtimes, normal "
    "shell utilities, file ops within $HOME or project dirs.\n\n"
    "When uncertain, ALLOW. False positives break developer workflows.\n\n"
    "Respond with EXACTLY one line of strict JSON, no markdown, no prose:\n"
    "{\"decision\":\"block\",\"reason\":\"<short_slug>\"}\n"
    "{\"decision\":\"allow\",\"reason\":\"<short_slug>\"}";

struct response_buf {
    char *data;
    size_t len;
};

static size_t write_cb(char *data, size_t size, size_t nmemb, void *userp) {
    struct response_buf *buf = userp;
    size_t total = size * nmemb;
    char *new_data = realloc(buf->data, buf->len + total + 1);
    if (!new_data) return 0;
    buf->data = new_data;
    memcpy(buf->data + buf->len, data, total);
    buf->len += total;
    buf->data[buf->len] = '\0';
    return total;
}

static char *build_user_content(const char *path, char **argv, int argc) {
    char *out;
    size_t out_len;
    FILE *f = open_memstream(&out, &out_len);
    if (!f) return NULL;
    fputs("{\"path\":\"", f);
    json_escape(f, path);
    fputs("\",\"argv\":[", f);
    for (int i = 0; i < argc; i++) {
        if (i) fputc(',', f);
        fputc('"', f);
        if (argv[i]) json_escape(f, argv[i]);
        fputc('"', f);
    }
    fputs("]}", f);
    fclose(f);
    return out;
}

static char *build_request_body(const char *path, char **argv, int argc) {
    char *user_content = build_user_content(path, argv, argc);
    if (!user_content) return NULL;

    char *body;
    size_t body_len;
    FILE *f = open_memstream(&body, &body_len);
    if (!f) { free(user_content); return NULL; }

    fprintf(f, "{\"model\":\"%s\",\"max_tokens\":%d,\"system\":\"",
            MODEL_ID, MAX_TOKENS);
    json_escape(f, SYSTEM_PROMPT);
    fputs("\",\"messages\":[{\"role\":\"user\",\"content\":\"", f);
    json_escape(f, user_content);
    fputs("\"}]}", f);
    fclose(f);

    free(user_content);
    return body;
}

static int decode_text_field(const char *body, char *out, size_t out_len) {
    const char *p = strstr(body, "\"text\":\"");
    if (!p) return -1;
    p += 8;

    size_t i = 0;
    while (*p && i + 1 < out_len) {
        if (*p == '\\') {
            p++;
            if (!*p) return -1;
            switch (*p) {
                case '"':  out[i++] = '"';  break;
                case '\\': out[i++] = '\\'; break;
                case '/':  out[i++] = '/';  break;
                case 'n':  out[i++] = '\n'; break;
                case 't':  out[i++] = '\t'; break;
                case 'r':  out[i++] = '\r'; break;
                case 'b':  out[i++] = '\b'; break;
                case 'f':  out[i++] = '\f'; break;
                case 'u':
                    if (!p[1] || !p[2] || !p[3] || !p[4]) return -1;
                    out[i++] = '?';
                    p += 4;
                    break;
                default:   out[i++] = *p;
            }
            p++;
        } else if (*p == '"') {
            out[i] = '\0';
            return 0;
        } else {
            out[i++] = *p++;
        }
    }
    return -1;
}

static int parse_field(const char *text, const char *field,
                       char *out, size_t out_len) {
    char needle[64];
    snprintf(needle, sizeof(needle), "\"%s\"", field);
    const char *p = strstr(text, needle);
    if (!p) return -1;
    p = strchr(p, ':');
    if (!p) return -1;
    p++;
    while (*p == ' ' || *p == '\t') p++;
    if (*p != '"') return -1;
    p++;
    size_t i = 0;
    while (*p && *p != '"' && i + 1 < out_len) {
        if (*p == '\\' && p[1]) p++;
        out[i++] = *p++;
    }
    out[i] = '\0';
    return *p == '"' ? 0 : -1;
}

int anthropic_classify(const char *path, char **argv, int argc,
                       char *reason_out, size_t reason_out_len) {
    if (reason_out_len > 0) reason_out[0] = '\0';

    const char *api_key = getenv("ANTHROPIC_API_KEY");
    if (!api_key || !*api_key) {
        snprintf(reason_out, reason_out_len, "no_api_key");
        return -1;
    }

    char *body = build_request_body(path, argv, argc);
    if (!body) {
        snprintf(reason_out, reason_out_len, "oom");
        return -1;
    }

    CURL *curl = curl_easy_init();
    if (!curl) {
        free(body);
        snprintf(reason_out, reason_out_len, "curl_init");
        return -1;
    }

    struct response_buf resp = {0};
    struct curl_slist *headers = NULL;

    char auth_header[256];
    snprintf(auth_header, sizeof(auth_header), "x-api-key: %s", api_key);
    headers = curl_slist_append(headers, auth_header);
    headers = curl_slist_append(headers, "anthropic-version: " ANTHROPIC_VERSION);
    headers = curl_slist_append(headers, "content-type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, ANTHROPIC_URL);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, HTTP_TIMEOUT_SECS);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

    CURLcode code = curl_easy_perform(curl);
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(body);

    if (code != CURLE_OK) {
        snprintf(reason_out, reason_out_len, "http_%s",
                 curl_easy_strerror(code));
        free(resp.data);
        return -1;
    }
    if (http_code != 200) {
        snprintf(reason_out, reason_out_len, "http_%ld", http_code);
        fprintf(stderr, "[exec-guard] anthropic http %ld: %.200s\n",
                http_code, resp.data ? resp.data : "");
        free(resp.data);
        return -1;
    }
    if (!resp.data) {
        snprintf(reason_out, reason_out_len, "empty_response");
        return -1;
    }

    char text[1024];
    if (decode_text_field(resp.data, text, sizeof(text)) < 0) {
        snprintf(reason_out, reason_out_len, "no_text_field");
        free(resp.data);
        return -1;
    }
    free(resp.data);

    char decision[16];
    if (parse_field(text, "decision", decision, sizeof(decision)) < 0) {
        snprintf(reason_out, reason_out_len, "no_decision");
        return -1;
    }

    char reason[128];
    if (parse_field(text, "reason", reason, sizeof(reason)) == 0) {
        snprintf(reason_out, reason_out_len, "%s", reason);
    } else {
        snprintf(reason_out, reason_out_len, "unspecified");
    }

    if (strcmp(decision, "block") == 0) return 1;
    if (strcmp(decision, "allow") == 0) return 0;
    snprintf(reason_out, reason_out_len, "bad_decision:%s", decision);
    return -1;
}
