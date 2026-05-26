#ifndef MBZ_LIST_SPECIAL_SHIM_H
#define MBZ_LIST_SPECIAL_SHIM_H

#include <lists/string_list.h>

enum string_list_type {
    STRING_LIST_NONE = 0,
    STRING_LIST_SHADER_PARAMETERS
};

static inline struct string_list *string_list_new_special(
    enum string_list_type type, void *data, unsigned *len, size_t *list_size) {
    (void)type; (void)data; (void)len; (void)list_size;
    return NULL;
}

#endif
