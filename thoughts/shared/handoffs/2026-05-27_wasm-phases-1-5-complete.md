---
date: 2026-05-27
topic: WASM pivot Phases 1-5 complete
tags: [wasm, pivot, handoff]
status: final
---

# Handoff: WASM Pivot Phases 1-5 Complete

## Branch: `wasm-pivot`

### Commits
| Hash | Phase | Description |
|------|-------|-------------|
| `d67b8bb` | 1 | Scaffold + Emscripten build system |
| `19b2150` | 2 | Preset parser (video_shader_parse.c) extracted |
| `bdd19a9` | 3 | Shader compiler (glslang + SPIRV-Cross) extracted |
| `8043d31` | 3b | Compiler bridge wired + verified in browser |
| `2ed36e1` | 4 | GL3 FBO renderer (shader_gl3.cpp) extracted |
| `0dd89e7` | 5 | Rendering bridge + TypeScript library wrapper |

### What Works
- .slangp preset parsing in browser (verified: POTATO preset, 10 passes, 7 LUTs)
- Slang -> SPIR-V -> GLSL ES 300 compilation in browser (verified: test.slang with push_constant)
- Full native pipeline compiles to 2.2MB WASM (glslang + SPIRV-Cross + shader_gl3 FBO chain)
- TypeScript library type-checks cleanly: MegaBezel, WasmBridge, PresetLoader, FrameFeeder

### What's NOT Yet Tested End-to-End
- Actually rendering a multi-pass shader chain in WebGL2 (the gl3_filter_chain rendering path)
- Loading real mega-bezel presets with all their .slang files and LUT textures
- The PresetLoader fetch + MEMFS write + renderer create pipeline

### Key Architecture
```
JS: MegaBezel.ts
  -> PresetLoader: fetch .slangp + .slang + LUTs -> write to MEMFS
  -> WasmBridge: cwrap bindings to all mbz_* functions
  -> FrameFeeder: extract RGBA from any source
  
WASM: bridge.c + bridge_compiler.cpp + bridge_renderer.cpp
  -> video_shader_parse.c: parse .slangp files (MBZ_STANDALONE guards)
  -> glslang_util_cxx.cpp: compile .slang -> SPIR-V
  -> spirv_cross: cross-compile SPIR-V -> GLSL ES 300
  -> shader_gl3.cpp: GL3 multi-pass FBO chain renderer
  
Dependencies:
  -> native/deps/libretro-common/ (config_file, file_path, strings, streams)
  -> native/deps/glslang/ (4.6MB, tests excluded)
  -> native/deps/SPIRV-Cross/ (2.3MB core only)
```

### Shim Summary
| Shim | Purpose |
|------|---------|
| `native/shims/configuration.c/.h` | Stub config_get_ptr() |
| `native/shims/verbosity.h` | RARCH_LOG/WARN/ERR -> printf/noop |
| `native/shims/paths.h` | Stub path_get(), path_is_empty() |
| `native/shims/retroarch.h` | Stub retroarch_get_rotation() |
| `native/shims/image_shim.c/.h` | Load raw RGBA from .raw files in MEMFS |
| `native/shims/gl3_helpers.cpp` | gl3_compile_shader, gl3_framebuffer_copy, gl3_get_cross_compiler_target_version |
| `MBZ_STANDALONE` guards in video_shader_parse.c | Exclude RA runtime (wildcards, file watching, shader toggle) |
| `MBZ_STANDALONE` guards in shader_gl3.cpp | Replace RA types (Size2D), GL compat defines |

### Next Steps (Phase 6: Testing)
1. Build a demo page that loads a real mega-bezel preset end-to-end
2. The biggest unknown: does the gl3_filter_chain actually render correctly in WebGL2?
3. Test with the POTATO preset first (simplest, 10 passes)
4. LUT texture loading needs the PresetLoader to decode PNGs and write `.raw` files to MEMFS
5. The Emscripten GL context binding (canvas <-> WASM) needs testing — MegaBezel.init() creates the context but the WASM module also needs it

### Known Issues / Risks
- GL_FRAMEBUFFER_SRGB is defined but may silently fail in WebGL2 (no sRGB framebuffer extension)
- GL_CLAMP_TO_BORDER mapped to GL_CLAMP_TO_EDGE (visual difference at borders)
- image_shim reads `.raw` files — PresetLoader must write `path.png.raw` format (width u32, height u32, RGBA pixels)
- The `#include` resolver in glslang reads files from MEMFS — all included shader files must be pre-fetched by PresetLoader
- WASM module Emscripten GL context creation may conflict with MegaBezel.init() creating its own context
