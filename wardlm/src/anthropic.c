#define _GNU_SOURCE
#include "anthropic.h"
#include "json_util.h"
#include "settings.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <curl/curl.h>

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

    const char *prompt = settings_effective_policy();
    if (!prompt) prompt = "";

    fprintf(f, "{\"model\":\"%s\",\"max_tokens\":%d,\"system\":\"",
            settings_model_id(), settings_max_tokens());
    json_escape(f, prompt);
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
    char version_header[128];
    snprintf(version_header, sizeof(version_header),
             "anthropic-version: %s", settings_api_version());
    headers = curl_slist_append(headers, auth_header);
    headers = curl_slist_append(headers, version_header);
    headers = curl_slist_append(headers, "content-type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, settings_api_url());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, settings_timeout_seconds());
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
        fprintf(stderr, "[wardlm] anthropic http %ld: %.200s\n",
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
