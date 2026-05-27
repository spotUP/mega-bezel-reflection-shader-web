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
static EMSCRIPTEN_WEBGL_CONTEXT_HANDLE g_gl_context = 0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int mbz_renderer_init_gl(const char *canvas_selector) {
    EmscriptenWebGLContextAttributes attrs;
    emscripten_webgl_init_context_attributes(&attrs);
    attrs.majorVersion = 2;
    attrs.minorVersion = 0;
    attrs.alpha = 0;
    attrs.antialias = 0;
    attrs.premultipliedAlpha = 0;
    attrs.preserveDrawingBuffer = 0;

    g_gl_context = emscripten_webgl_create_context(canvas_selector, &attrs);
    if (g_gl_context <= 0) {
        fprintf(stderr, "[MBZ] Failed to create WebGL2 context on %s (err=%d)\n",
                canvas_selector, (int)g_gl_context);
        return 0;
    }
    emscripten_webgl_make_context_current(g_gl_context);

    GLuint vao;
    glGenVertexArrays(1, &vao);
    glBindVertexArray(vao);

    return 1;
}

EMSCRIPTEN_KEEPALIVE
int mbz_renderer_create(const char *preset_path) {
    emscripten_webgl_make_context_current(g_gl_context);
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
    emscripten_webgl_make_context_current(g_gl_context);

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
         2.0f,  0.0f, 0.0f, 0.0f,
         0.0f,  2.0f, 0.0f, 0.0f,
         0.0f,  0.0f, 2.0f, 0.0f,
        -1.0f, -1.0f, 0.0f, 1.0f,
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
uint32_t mbz_renderer_read_pixel(int x, int y) {
    uint8_t pixel[4] = {0};
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glReadPixels(x, y, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, pixel);
    return pixel[0] | (pixel[1] << 8) | (pixel[2] << 16) | (pixel[3] << 24);
}

EMSCRIPTEN_KEEPALIVE
void mbz_renderer_test_draw(void) {
    const char *vs_src =
        "#version 300 es\n"
        "layout(location=0) in vec2 pos;\n"
        "layout(location=1) in vec2 uv;\n"
        "out vec2 vUV;\n"
        "void main() { gl_Position = vec4(pos*2.0-1.0, 0.0, 1.0); vUV = uv; }\n";
    const char *fs_src =
        "#version 300 es\n"
        "precision mediump float;\n"
        "uniform sampler2D tex;\n"
        "in vec2 vUV;\n"
        "out vec4 color;\n"
        "void main() { color = texture(tex, vUV); }\n";

    GLuint vs = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vs, 1, &vs_src, NULL);
    glCompileShader(vs);
    GLuint fs = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fs, 1, &fs_src, NULL);
    glCompileShader(fs);
    GLuint prog = glCreateProgram();
    glAttachShader(prog, vs);
    glAttachShader(prog, fs);
    glLinkProgram(prog);
    glDeleteShader(vs);
    glDeleteShader(fs);

    float verts[] = {
        0,0, 0,0,
        1,0, 1,0,
        0,1, 0,1,
        1,1, 1,1,
    };
    GLuint vbo;
    glGenBuffers(1, &vbo);
    glBindBuffer(GL_ARRAY_BUFFER, vbo);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts), verts, GL_STATIC_DRAW);

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glViewport(0, 0, 640, 480);
    glClearColor(0.2f, 0.0f, 0.2f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);

    glUseProgram(prog);
    glUniform1i(glGetUniformLocation(prog, "tex"), 0);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, g_input_texture);

    glEnableVertexAttribArray(0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 16, (void*)0);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 16, (void*)8);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

    glDisableVertexAttribArray(0);
    glDisableVertexAttribArray(1);
    glDeleteBuffers(1, &vbo);
    glDeleteProgram(prog);
    glUseProgram(0);
}

EMSCRIPTEN_KEEPALIVE
uint32_t mbz_renderer_read_input_pixel(int x, int y) {
    if (!g_input_texture) return 0;
    GLuint fbo;
    glGenFramebuffers(1, &fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, g_input_texture, 0);
    uint8_t pixel[4] = {0};
    glReadPixels(x, y, 1, 1, GL_RGBA, GL_UNSIGNED_BYTE, pixel);
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glDeleteFramebuffers(1, &fbo);
    return pixel[0] | (pixel[1] << 8) | (pixel[2] << 16) | (pixel[3] << 24);
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
