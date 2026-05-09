#ifndef WARDLM_JSON_UTIL_H
#define WARDLM_JSON_UTIL_H

#include <stdio.h>

/* Writes `s` to `f` with JSON string escaping (quotes, backslashes,
 * control chars). Does NOT emit surrounding quotes — caller decides. */
void json_escape(FILE *f, const char *s);

#endif
