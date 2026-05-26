#ifndef MBZ_PATHS_SHIM_H
#define MBZ_PATHS_SHIM_H

#include <stddef.h>

enum rarch_path_type {
    RARCH_PATH_CONTENT,
    RARCH_PATH_BASENAME,
    RARCH_PATH_CORE,
    RARCH_PATH_CONFIG,
    RARCH_PATH_NONE
};

static inline const char *path_get(enum rarch_path_type type) {
    (void)type;
    return "";
}

static inline bool path_is_empty(enum rarch_path_type type) {
    (void)type;
    return true;
}

#endif
