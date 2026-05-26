#ifndef MBZ_CONFIGURATION_SHIM_H
#define MBZ_CONFIGURATION_SHIM_H

#include <stdbool.h>
#include <stdint.h>

typedef struct settings {
    struct {
        char video_driver[64];
    } arrays;
    struct {
        bool video_allow_rotate;
        bool video_shader_watch_files;
    } bools;
    struct {
        unsigned video_rotation;
        unsigned screen_orientation;
    } uints;
} settings_t;

settings_t *config_get_ptr(void);

static inline void configuration_set_bool(settings_t *settings, bool target, bool val) {
    (void)settings;
    (void)target;
    (void)val;
}

#endif
