---
date: 2026-05-27
topic: WASM pivot design and planning complete
tags: [wasm, pivot, design, handoff]
status: final
---

# Handoff: WASM Pivot Design Complete

## Task

Redesign mega-bezel-reflection-shader-web from a JS WebGL2 shader reimplementation to a WASM-based approach that extracts RetroArch's actual shader pipeline into a standalone library.

## Critical References

- **Design spec:** `docs/superpowers/specs/2026-05-27-mega-bezel-wasm-design.md`
- **Implementation plan:** `thoughts/shared/plans/2026-05-27-mega-bezel-wasm-extraction.md`
- **RetroArch source:** `/Users/spot/Code/emulatorjs-retroarch/` (the EmulatorJS fork)
- **Existing PUAE WASM build:** `/Users/spot/Code/LVLLVL-Amiga/web/maker/` (working reference)
- **PUAE swap plan (reference):** `/Users/spot/Code/LVLLVL-Amiga/thoughts/shared/plans/2026-05-05-puae-wasm-swap.md`

### Key RetroArch files to extract

| File | LOC | Purpose |
|---|---|---|
| `gfx/video_shader_parse.c/.h` | 3,176 | Preset parser, core data structures |
| `gfx/drivers_shader/shader_gl3.cpp/.h` | 2,894 | Multi-pass FBO chain (hardest extraction) |
| `gfx/drivers_shader/slang_process.cpp/.h` | 620 | Slang preprocessing |
| `gfx/drivers_shader/slang_reflection.cpp/.h` | 855 | SPIR-V reflection |
| `gfx/drivers_shader/glslang_util.c/.h` | 380 | glslang integration |
| `gfx/drivers_shader/glslang.cpp` | ~500 | Shader file reading, #include |

Vendored deps needed: `deps/glslang/`, `deps/spirv-cross/`, `deps/SPIRV-Tools/`, libretro-common config_file parser.

## Recent Changes

- Committed design spec to `docs/superpowers/specs/2026-05-27-mega-bezel-wasm-design.md`
- Wrote 7-phase implementation plan to `thoughts/shared/plans/`
- No code changes to the repo -- old JS WebGL2 code is untouched on main

## Learnings

- User spent weeks debugging the JS WebGL2 reimplementation approach. It was infeasible -- mega-bezel's 20+ pass chain with feedback textures, LUT bezels, and CRT simulation is too complex to reimplement.
- User has a custom Emscripten build of RetroArch PUAE working in `/Users/spot/Code/LVLLVL-Amiga/` with full shader pipeline running. This proves the WASM approach works.
- The EmulatorJS build pipeline (3 repos: emulatorjs-build, emulatorjs-retroarch, libretro-uae) is documented in the PUAE swap plan.
- `shader_gl3.cpp` is the hardest extraction target -- it calls into RetroArch's video_driver_t for viewport, frame count, rotation, config. All of these need to be replaced with explicit parameters.
- User chose Approach A (extract shader subsystem) over Approach B (stripped RetroArch + passthrough core) because bundle size must be minimal. If Phase 4 proves too hard, Approach B is the fallback.

## Artifacts

- Design spec: committed as `5f42d99`
- Plan: not yet committed (commit in next session)

## Next Steps

1. **Commit the plan** to git
2. **Start Phase 1** -- create `wasm-pivot` branch, scaffold directory structure, get a trivial WASM module building with Emscripten
3. **Phase 2** -- extract preset parser, get it compiling standalone
4. See plan for full phase sequence

## Other Notes

- The existing shader files in `public/shaders/mega-bezel/shaders/` are mostly untouched from upstream (only 2 files have WebGL2-specific mods). For the WASM approach, use fresh upstream copies via git submodule.
- Emscripten and WASM tooling are already installed on this machine.
- The user wants this to be a reusable library for applying mega-bezel to any web content (images, video, canvas, emulator output) -- not just an emulator frontend.
