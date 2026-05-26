#include "image_shim.h"
#include <stdio.h>
#include <string.h>

bool image_texture_load(struct texture_image *img, const char *path) {
    if (!img || !path)
        return false;

    char raw_path[512];
    snprintf(raw_path, sizeof(raw_path), "%s.raw", path);

    FILE *f = fopen(raw_path, "rb");
    if (!f) {
        fprintf(stderr, "[MBZ] image_texture_load: cannot open %s\n", raw_path);
        return false;
    }

    uint32_t header[2];
    if (fread(header, sizeof(uint32_t), 2, f) != 2) {
        fclose(f);
        return false;
    }

    img->width = header[0];
    img->height = header[1];
    size_t pixel_count = (size_t)img->width * img->height;
    img->pixels = (uint32_t *)malloc(pixel_count * 4);
    if (!img->pixels) {
        fclose(f);
        return false;
    }

    if (fread(img->pixels, 4, pixel_count, f) != pixel_count) {
        free(img->pixels);
        img->pixels = NULL;
        fclose(f);
        return false;
    }

    fclose(f);
    return true;
}

void image_texture_free(struct texture_image *img) {
    if (img && img->pixels) {
        free(img->pixels);
        img->pixels = NULL;
    }
}
