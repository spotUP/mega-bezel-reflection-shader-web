#ifndef MBZ_IMAGE_SHIM_H
#define MBZ_IMAGE_SHIM_H

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

struct texture_image {
    uint32_t *pixels;
    unsigned width;
    unsigned height;
    bool supports_rgba;
};

#ifdef __cplusplus
extern "C" {
#endif

bool image_texture_load(struct texture_image *img, const char *path);
void image_texture_free(struct texture_image *img);

#ifdef __cplusplus
}
#endif

#endif
