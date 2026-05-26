#include <emscripten.h>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

#include "gfx/drivers_shader/glslang_util.h"
#include "gfx/drivers_shader/glslang_util_cxx.h"
#include "gfx/drivers_shader/glslang.hpp"

#include <spirv_glsl.hpp>

static std::string g_last_vertex_glsl;
static std::string g_last_fragment_glsl;
static std::string g_last_error;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int mbz_compile_shader(const char *shader_path, int glsl_version) {
    g_last_vertex_glsl.clear();
    g_last_fragment_glsl.clear();
    g_last_error.clear();

    glslang_output output;
    if (!glslang_compile_shader(shader_path, &output)) {
        g_last_error = "Failed to compile shader to SPIR-V";
        return 0;
    }

    if (output.vertex.empty() || output.fragment.empty()) {
        g_last_error = "Empty SPIR-V output";
        return 0;
    }

    spirv_cross::CompilerGLSL vs_compiler(output.vertex);
    spirv_cross::CompilerGLSL ps_compiler(output.fragment);

    spirv_cross::CompilerGLSL::Options options;
    options.version = glsl_version > 0 ? glsl_version : 300;
    options.es = (glsl_version <= 320);
    vs_compiler.set_common_options(options);
    ps_compiler.set_common_options(options);

    g_last_vertex_glsl = vs_compiler.compile();
    g_last_fragment_glsl = ps_compiler.compile();

    return 1;
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_compiled_vertex(void) {
    return g_last_vertex_glsl.c_str();
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_compiled_fragment(void) {
    return g_last_fragment_glsl.c_str();
}

EMSCRIPTEN_KEEPALIVE
const char *mbz_get_compile_error(void) {
    return g_last_error.c_str();
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_compiled_vertex_len(void) {
    return (int)g_last_vertex_glsl.size();
}

EMSCRIPTEN_KEEPALIVE
int mbz_get_compiled_fragment_len(void) {
    return (int)g_last_fragment_glsl.size();
}

}
