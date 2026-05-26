#ifndef MBZ_FILE_PATH_SPECIAL_SHIM_H
#define MBZ_FILE_PATH_SPECIAL_SHIM_H

#include <stddef.h>
#include <string.h>
#include <compat/strl.h>

enum file_path_enum {
    FILE_PATH_UNKNOWN = 0
};

static inline void fill_pathname_expand_special(char *out, const char *in, size_t size) {
    strlcpy(out, in, size);
}

static inline void fill_pathname_application_special(char *out, size_t size, enum file_path_enum type) {
    out[0] = '\0';
    (void)type;
}

#endif
