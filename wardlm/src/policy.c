#define _GNU_SOURCE
#include "policy.h"
#include "anthropic.h"

#include <stdio.h>
#include <stdlib.h>

int policy_should_block(const char *path,
                        char **argv, int argc,
                        const char **reason) {
    static char reason_buf[256];
    int rc = anthropic_classify(path, argv, argc,
                                reason_buf, sizeof(reason_buf));
    if (rc == 1) {
        *reason = reason_buf[0] ? reason_buf : "anthropic_block";
        return 1;
    }
    if (rc == 0) {
        return 0;
    }

    /* API call failed. Default to fail-closed (deny) — opt out with
     * EXEC_GUARD_FAIL_OPEN=1 if the supervised tool must keep running
     * when the policy backend is unreachable. */
    if (getenv("EXEC_GUARD_FAIL_OPEN")) {
        return 0;
    }
    static char unavailable_buf[280];
    snprintf(unavailable_buf, sizeof(unavailable_buf),
             "policy_unavailable:%s", reason_buf);
    *reason = unavailable_buf;
    return 1;
}
