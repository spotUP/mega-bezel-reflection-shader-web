#include <emscripten.h>
#include <emscripten/html5.h>
#include <GLES3/gl3.h>
#include <cstdlib>
#include <cstring>
#include <cstdio>

#include "gfx/drivers_shader/shader_gl3.h"

static gl3_filter_chain_t *g_chain = NULL;
static GLuint g_input_texture = 0;
static unsigned g_input_width = 0;
static unsigned g_input_height = 0;
static uint64_t g_frame_count = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int mbz_renderer_create(const char *preset_path) {
    if (g_chain) {
        gl3_filter_chain_free(g_chain);
        g_chain = NULL;
    }

    g_chain = gl3_filter_chain_create_from_preset(
        preset_path, GLSLANG_FILTER_CHAIN_LINEAR);

    if (!g_chain) {
        fprintf(stderr, "[MBZ] Failed to create filter chain from preset: %s\n", preset_path);
        return 0;
    }

    g_frame_count = 0;
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int mbz_renderer_upload_frame(const uint8_t *rgba, int width, int height) {
    if (!g_chain)
        return 0;

    if (g_input_texture == 0)
        glGenTextures(1, &g_input_texture);

    if ((unsigned)width != g_input_width || (unsigned)height != g_input_height) {
        glBindTexture(GL_TEXTURE_2D, g_input_texture);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, width, height, 0,
                     GL_RGBA, GL_UNSIGNED_BYTE, rgba);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        g_input_width = width;
        g_input_height = height;
    } else {
        glBindTexture(GL_TEXTURE_2D, g_input_texture);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, width, height,
                        GL_RGBA, GL_UNSIGNED_BYTE, rgba);
    }
    glBindTexture(GL_TEXTURE_2D, 0);

    return 1;
}

EMSCRIPTEN_KEEPALIVE
void mbz_renderer_render(int viewport_width, int viewport_height) {
    if (!g_chain || g_input_texture == 0)
        return;

    struct gl3_filter_chain_texture input;
    input.image = g_input_texture;
    input.width = g_input_width;
    input.height = g_input_height;
    input.padded_width = g_input_width;
    input.padded_height = g_input_height;
    input.format = GL_RGBA8;

    gl3_filter_chain_set_input_texture(g_chain, &input);
    gl3_filter_chain_set_frame_count(g_chain, g_frame_count);
    gl3_filter_chain_set_frame_direction(g_chain, 1);
    gl3_filter_chain_set_rotation(g_chain, 0);

    struct gl3_viewport vp;
    vp.x = 0;
    vp.y = 0;
    vp.width = viewport_width;
    vp.height = viewport_height;

    gl3_filter_chain_build_offscreen_passes(g_chain, &vp);

    static const float identity_mvp[16] = {
        1.0f, 0.0f, 0.0f, 0.0f,
        0.0f, 1.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 1.0f,
    };
    gl3_filter_chain_build_viewport_pass(g_chain, &vp, identity_mvp);
    gl3_filter_chain_end_frame(g_chain);

    g_frame_count++;
}

EMSCRIPTEN_KEEPALIVE
void mbz_renderer_set_frame_count(uint32_t count) {
    g_frame_count = count;
}

EMSCRIPTEN_KEEPALIVE
void mbz_renderer_destroy(void) {
    if (g_chain) {
        gl3_filter_chain_free(g_chain);
        g_chain = NULL;
    }
    if (g_input_texture) {
        glDeleteTextures(1, &g_input_texture);
        g_input_texture = 0;
    }
    g_input_width = 0;
    g_input_height = 0;
    g_frame_count = 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t mbz_renderer_get_heap_ptr(int size) {
    return (uint32_t)(uintptr_t)malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void mbz_renderer_free_ptr(uint32_t ptr) {
    free((void *)(uintptr_t)ptr);
}

}
