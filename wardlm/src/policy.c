#define _GNU_SOURCE
#include "policy.h"
#include "anthropic.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* LRU cache of allowed (path, argv) tuples. Avoids re-classifying the
 * same exec on every invocation. Block decisions are NOT cached so the
 * user can flip securityChecks and have the change take effect on the
 * next attempt without restarting the supervised process. */
#define WARDLM_CACHE_CAP 200

typedef struct CacheEntry {
    uint64_t hash;
    char    *key;
    size_t   key_len;
    struct CacheEntry *prev, *next;
} CacheEntry;

static CacheEntry *g_head = NULL;  /* most recently used */
static CacheEntry *g_tail = NULL;  /* least recently used */
static int         g_size = 0;

static uint64_t fnv1a(const char *data, size_t len) {
    uint64_t h = 1469598103934665603ULL;
    for (size_t i = 0; i < len; i++) {
        h ^= (unsigned char)data[i];
        h *= 1099511628211ULL;
    }
    return h;
}

/* Build "path\0argv[0]\0argv[1]\0...\0argv[argc-1]\0" — NUL-separated
 * so distinct argv splits can't alias. Caller frees. */
static char *build_key(const char *path, char **argv, int argc,
                       size_t *out_len) {
    size_t plen = strlen(path);
    size_t total = plen + 1;
    for (int i = 0; i < argc; i++) total += strlen(argv[i]) + 1;
    char *buf = malloc(total);
    if (!buf) return NULL;
    char *p = buf;
    memcpy(p, path, plen); p += plen; *p++ = '\0';
    for (int i = 0; i < argc; i++) {
        size_t l = strlen(argv[i]);
        memcpy(p, argv[i], l); p += l; *p++ = '\0';
    }
    *out_len = total;
    return buf;
}

static void list_unlink(CacheEntry *e) {
    if (e->prev) e->prev->next = e->next; else g_head = e->next;
    if (e->next) e->next->prev = e->prev; else g_tail = e->prev;
}

static void list_push_front(CacheEntry *e) {
    e->prev = NULL;
    e->next = g_head;
    if (g_head) g_head->prev = e;
    g_head = e;
    if (!g_tail) g_tail = e;
}

static int cache_lookup(const char *key, size_t key_len, uint64_t hash) {
    for (CacheEntry *e = g_head; e; e = e->next) {
        if (e->hash == hash && e->key_len == key_len &&
            memcmp(e->key, key, key_len) == 0) {
            if (e != g_head) {
                list_unlink(e);
                list_push_front(e);
            }
            return 1;
        }
    }
    return 0;
}

/* Takes ownership of `key` on success; frees it on allocation failure. */
static void cache_insert(char *key, size_t key_len, uint64_t hash) {
    if (g_size >= WARDLM_CACHE_CAP) {
        CacheEntry *evict = g_tail;
        list_unlink(evict);
        free(evict->key);
        free(evict);
        g_size--;
    }
    CacheEntry *e = malloc(sizeof(*e));
    if (!e) { free(key); return; }
    e->hash = hash;
    e->key = key;
    e->key_len = key_len;
    list_push_front(e);
    g_size++;
}

int policy_should_block(const char *path,
                        char **argv, int argc,
                        const char **reason) {
    size_t   key_len = 0;
    uint64_t hash    = 0;
    char    *key     = build_key(path, argv, argc, &key_len);
    if (key) {
        hash = fnv1a(key, key_len);
        if (cache_lookup(key, key_len, hash)) {
            free(key);
            return 0;
        }
    }

    static char reason_buf[256];
    int rc = anthropic_classify(path, argv, argc,
                                reason_buf, sizeof(reason_buf));
    if (rc == 1) {
        free(key);
        *reason = reason_buf[0] ? reason_buf : "anthropic_block";
        return 1;
    }
    if (rc == 0) {
        if (key) cache_insert(key, key_len, hash);
        return 0;
    }

    free(key);

    /* API call failed. Default to fail-closed (deny) — opt out with
     * WARDLM_FAIL_OPEN=1 if the supervised tool must keep running
     * when the policy backend is unreachable. */
    if (getenv("WARDLM_FAIL_OPEN")) {
        return 0;
    }
    static char unavailable_buf[280];
    snprintf(unavailable_buf, sizeof(unavailable_buf),
             "policy_unavailable:%s", reason_buf);
    *reason = unavailable_buf;
    return 1;
}
