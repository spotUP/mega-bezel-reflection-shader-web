#include "configuration.h"
#include <string.h>

static settings_t g_settings;
static bool g_settings_init = false;

settings_t *config_get_ptr(void) {
    if (!g_settings_init) {
        memset(&g_settings, 0, sizeof(g_settings));
        g_settings_init = true;
    }
    return &g_settings;
}
