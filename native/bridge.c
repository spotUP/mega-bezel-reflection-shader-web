#include <emscripten.h>
#include <stdlib.h>
#include <string.h>
#include "gfx/video_shader_parse.h"

static struct video_shader *g_shader = NULL;

EMSCRIPTEN_KEEPALIVE
int mbz_init(void) {
    if (g_shader)
        free(g_shader);
    g_shader = calloc(1, sizeof(struct video_shader));
    return g_shader != NULL;
}

EMSCRIPTEN_KEEPALIVE
int mbz_version(void) {
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int mbz_load_preset(const char *path) {
    if (!g_shader)
        return 0;
    memset(g_shader, 0, sizeof(*g_shader));
    return video_shader_load_preset_into_shader(path, g_shader) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_pass_count(void) {
    return g_shader ? (int)g_shader->passes : 0;
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_lut_count(void) {
    return g_shader ? (int)g_shader->luts : 0;
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_parameter_count(void) {
    return g_shader ? (int)g_shader->num_parameters : 0;
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_pass_source_path(int index) {
    if (!g_shader || index < 0 || index >= (int)g_shader->passes)
        return "";
    return g_shader->pass[index].source.path;
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_lut_id(int index) {
    if (!g_shader || index < 0 || index >= (int)g_shader->luts)
        return "";
    return g_shader->lut[index].id;
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_lut_path(int index) {
    if (!g_shader || index < 0 || index >= (int)g_shader->luts)
        return "";
    return g_shader->lut[index].path;
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_parameter_id(int index) {
    if (!g_shader || index < 0 || index >= (int)g_shader->num_parameters)
        return "";
    return g_shader->parameters[index].id;
}

EMSCRIPTEN_KEEPALIVE
float mbz_get_parameter_value(int index) {
    if (!g_shader || index < 0 || index >= (int)g_shader->num_parameters)
        return 0.0f;
    return g_shader->parameters[index].current;
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_feedback_pass(void) {
    return g_shader ? g_shader->feedback_pass : -1;
}

EMSCRIPTEN_KEEPALIVE
void mbz_destroy(void) {
    if (g_shader) {
        free(g_shader);
        g_shader = NULL;
    }
}
