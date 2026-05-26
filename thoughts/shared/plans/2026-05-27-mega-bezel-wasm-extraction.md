---
date: 2026-05-27
topic: mega-bezel-wasm extraction implementation plan
tags: [wasm, emscripten, shader-pipeline, retroarch]
status: draft
---

# Implementation Plan: mega-bezel-wasm

Design spec: `docs/superpowers/specs/2026-05-27-mega-bezel-wasm-design.md`

RetroArch source: `/Users/spot/Code/emulatorjs-retroarch/`

## Phase 1: Repo Restructure and Scaffold

**Goal:** Clean slate with the new directory structure, build system compiling a trivial WASM module.

1. Create a `wasm-pivot` branch from current main
2. Create new directory structure:
   - `native/` (empty, for extracted C/C++)
   - `native/shims/`
   - `native/deps/`
   - `build/`
   - `src/` (keep dir, gut contents)
   - `demo/`
   - `presets/` (git submodule -> upstream hsm mega-bezel repo)
3. Write `build/Makefile` with Emscripten flags from the spec, targeting a trivial `bridge.c` that exports `mbz_init` returning 1
4. Verify: `emmake make` produces a `.wasm` + `.js` glue file
5. Write minimal `demo/index.html` that loads the WASM module and calls `mbz_init`
6. Verify: demo page loads in browser, console shows init success

**Automated verification:** `emmake make` succeeds, `wasm-opt --print-size` shows output, demo page loads without errors.

**Do not delete old code yet.** Keep it on main for reference. The new branch starts clean.

## Phase 2: Extract Preset Parser

**Goal:** `video_shader_parse.c` compiles standalone and parses a `.slangp` file correctly.

1. Copy from RetroArch into `native/`:
   - `gfx/video_shader_parse.c` + `gfx/video_shader_parse.h`
   - `libretro-common/file/config_file.c` + headers -> `native/deps/libretro-common/`
   - `libretro-common/string/stdstring.c` + other string utils it needs
   - `libretro-common/compat/` (compat_strl etc.)
2. Create `native/shims/config_shim.c` -- replace `configuration.h` globals with a static struct
3. Create `native/shims/path_shim.c` -- stub out `video_shader_replace_wildcards()` (return path unchanged)
4. Create `native/shims/logging_shim.c` -- `RARCH_LOG/WARN/ERR` -> `printf` or callback
5. Iteratively fix compilation errors -- the goal is `video_shader_parse.c` compiling with minimal RA headers
6. Write a host-side test: parse `MBZ__3__STD.slangp`, assert pass count, parameter count, LUT count

**Automated verification:** Host-side test binary runs and passes. Emscripten build still succeeds.

**This is the most tedious phase** -- expect many missing headers/symbols to stub out. The config_file parser from libretro-common is the cleanest dependency; the problem is video_shader_parse.c pulling in RA's path system, verbosity settings, etc.

## Phase 3: Extract Shader Compiler (slang -> SPIR-V -> GLSL)

**Goal:** Compile a `.slang` file to GLSL suitable for WebGL2.

1. Copy into `native/`:
   - `gfx/drivers_shader/glslang_util.c/.h`
   - `gfx/drivers_shader/glslang.cpp`
   - `gfx/drivers_shader/slang_process.cpp/.h`
   - `gfx/drivers_shader/slang_reflection.cpp/.h`
2. Copy vendored deps into `native/deps/`:
   - `deps/glslang/` (the full glslang library)
   - `deps/spirv-cross/` (SPIR-V to GLSL cross-compiler)
   - `deps/SPIRV-Tools/` (validation)
3. Replace file I/O in `glslang.cpp` -- instead of reading `.slang` files from disk, accept buffers passed from the bridge (shader source already fetched by JS)
4. Create a buffer-based `#include` resolver -- JS pre-fetches all `#include`d files and passes them as a name->content map
5. Fix compilation -- slang_process.cpp has moderate RA coupling (logging, some config)
6. Write host-side test: compile a simple `.slang` file to SPIR-V, cross-compile to GLSL, verify output is valid GLSL

**Automated verification:** Host test compiles and runs. GLSL output is syntactically valid (can be checked with a simple regex or by feeding to a GL context).

**Risk:** glslang is large (~2MB source). It compiles to WASM fine (RetroArch already does this), but build times will increase significantly. Consider precompiling glslang to a static .a once and linking it.

## Phase 4: Extract GL3 Multi-Pass FBO Chain

**Goal:** `shader_gl3.cpp` compiles standalone and can render a multi-pass chain.

1. Copy into `native/`:
   - `gfx/drivers_shader/shader_gl3.cpp/.h`
2. This file has the heaviest RA coupling. Key decoupling work:
   - Replace `video_driver_t` callbacks with direct parameters to bridge functions
   - Replace `video_info_t` / viewport queries with values passed from `mbz_set_viewport()`
   - Replace frame count / direction queries with values passed from `mbz_set_frame_count()`
   - Replace texture loading (LUTs) with `mbz_load_lut()` path (pixels already in WASM heap)
   - Strip menu integration, recording, overlay, font rendering hooks
3. The `gl3_filter_chain` class is ~2900 lines. Key functions to preserve:
   - `gl3_filter_chain_create_from_preset()` -- builds the chain from parsed preset
   - `gl3_filter_chain_build_offscreen_passes()` -- renders intermediate FBOs
   - `gl3_filter_chain_build_viewport_pass()` -- final output to screen
   - `gl3_filter_chain_init_history()` -- frame history textures
   - `gl3_filter_chain_init_feedback()` -- feedback pass textures
   - `gl3_filter_chain_set_input_texture()` -- sets the input frame
4. Write the full `bridge.c` connecting all pieces:
   - `mbz_init` -> create GL context, initialize state
   - `mbz_load_preset` -> parse preset, compile shaders, build filter chain
   - `mbz_upload_frame` -> upload RGBA to input texture
   - `mbz_render` -> set uniforms, run offscreen passes, run viewport pass
5. Verify with Emscripten build: load POTATO preset (simplest), render a solid color input, read pixels back

**Automated verification:** Playwright test loads demo, renders one frame, reads pixels, verifies output != black and output != input.

**This is the hardest phase.** Budget extra time for iterating on `shader_gl3.cpp` decoupling. Work function-by-function, not all at once.

## Phase 5: JS/TS Library Wrapper

**Goal:** The `MegaBezel` TypeScript class works end-to-end.

1. Write `src/WasmBridge.ts` -- typed cwrap bindings for all `mbz_*` functions
2. Write `src/PresetLoader.ts`:
   - Fetch `.slangp` file
   - Parse it (port just enough of the preset format to extract shader paths and LUT paths)
   - Resolve relative paths
   - Fetch all `.slang` files and LUT images in parallel
   - Bundle into a format the bridge accepts
3. Write `src/FrameFeeder.ts`:
   - Accept `FrameSource` (canvas, video, image, ImageBitmap)
   - Extract RGBA pixels (scratch canvas + getImageData, or texImage2D path)
   - Copy into WASM heap for `mbz_upload_frame`
4. Write `src/MegaBezel.ts` -- the public API class per the spec
5. Write `src/types.ts` -- exported types
6. Update `demo/demo.ts` to use the library API with a test image + preset selector

**Automated verification:** Demo page renders a test image through the STD preset. Parameters are adjustable. Preset switching works.

## Phase 6: Testing and Polish

**Goal:** CI-ready test suite, documentation, npm package config.

1. Native unit tests (CMake or simple Makefile test target):
   - Preset parser tests (3+ presets of varying complexity)
   - Shader compilation tests (compile mega-bezel's actual .slang files)
2. Playwright integration tests:
   - Full lifecycle test (create -> render -> destroy)
   - Parameter mutation test
   - Preset switching test
   - Error handling tests (bad preset URL, missing shader, invalid WebGL)
3. Visual regression tests:
   - Golden images for POTATO, STD, ADV presets with a known input
   - Run in CI with SwiftShader for determinism
4. Configure `package.json` for npm publishing:
   - Entry points: `dist/index.js` (ESM), `dist/index.d.ts` (types)
   - Include `dist/mega-bezel.wasm` in package files
   - Peer dependency: none (self-contained)
5. Write README with usage example from the spec

**Automated verification:** All tests pass. `npm pack` produces a valid tarball. Demo page works.

## Phase 7: Cleanup

**Goal:** Remove the old JS WebGL2 code, merge to main.

1. Delete from the branch:
   - `src/shaders/` (old JS shader reimplementation)
   - `src/pages/`, old `src/App.tsx`, `src/main.tsx` (old React app)
   - `scripts/` (old shader compilation checks)
   - `public/shaders/` (old WebGL2-adapted shader copies)
   - `mega-bezel/` directory (replaced by git submodule in `presets/`)
   - `tools/shader/` test scripts
   - Old config files: `check-console.js`, `start-demo.sh`, `GEMINI_HANDOFF.md`
2. Update `.gitignore` for new structure
3. Final verification: clean build from scratch, all tests pass, demo works
4. PR to main

**Manual verification:** Load demo in Chrome, Firefox, Safari. Apply each of the 3 test presets. Tweak parameters. Verify no visual artifacts.

## Dependency Graph

```
Phase 1 (scaffold)
  |
  v
Phase 2 (preset parser) --> Phase 3 (shader compiler)
                                |
                                v
                           Phase 4 (GL3 FBO chain)
                                |
                                v
                           Phase 5 (JS wrapper)
                                |
                                v
                           Phase 6 (testing)
                                |
                                v
                           Phase 7 (cleanup + merge)
```

Phases 2 and 3 can overlap -- the preset parser and shader compiler are independent until Phase 4 ties them together.

## Estimated Effort

- Phase 1: 1 session
- Phase 2: 2-3 sessions (tedious header/symbol stubbing)
- Phase 3: 2-3 sessions (glslang vendoring is the bulk)
- Phase 4: 3-5 sessions (shader_gl3.cpp decoupling is the crux)
- Phase 5: 1-2 sessions
- Phase 6: 1-2 sessions
- Phase 7: 1 session

Total: ~11-17 sessions. Phase 4 is the risk -- if shader_gl3.cpp proves too entangled, we may need to fall back to Approach B (stripped RetroArch with passthrough core).
