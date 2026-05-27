---
date: 2026-05-27
topic: WASM render pipeline - full mega-bezel working
tags: [wasm, debugging, render, handoff, milestone]
status: final
---

# Handoff: Full Mega Bezel Rendering in WebGL2/WASM

## Branch: `wasm-pivot`

## Status: FULL 36-PASS MEGA BEZEL RENDERING WORKING

The complete Mega Bezel Reflection Shader pipeline runs in a browser via WASM + WebGL2.

## What Works
- 36-pass filter chain: drez, cache-info, FXAA, intro, afterglow, color correction, sharpen, linearize, bezel generation, height maps, tube layers, gaussian blur, bloom, CRT guest advanced, deconvergence, reflection prep (blur/diffuse/glow), bezel reflection, final composite
- 28 LUT textures loaded (PNG decoded in JS, written as raw to MEMFS)
- Full include chain resolution (recursive #include from MEMFS)
- Real WebGL2 UBOs (not flattened -- supports mixed float/uint types)
- GLES 300 polyfills for packUnorm4x8/unpackUnorm4x8
- Upstream mega-bezel shaders (replaced local "WEBGL FIX" hacked copies)
- Feedback textures for temporal effects
- FrameCount reaches shaders correctly through real UBOs
- React app integration (ShaderTest.tsx uses MegaBezel WASM class)
- PresetLoader with recursive #include resolution
- Cached WASM heap allocation for frame uploads (no per-frame malloc/free)
- Progress bar overlay during load
- Continuous rAF render loop
- Debug logging gated behind MBZ_DEBUG flag (clean console in production)

## Bugs Fixed This Session
1. **Black output** -- `glGenerateMipmap` after input texture upload (filter chain always uses mipmap min filters)
2. **UBO flattening crash** -- switched from flatten=true to flatten=false for real WebGL2 UBOs
3. **Bare uniform compilation** -- replaced local "WEBGL FIX" hacked shaders with upstream versions that use proper push_constant blocks
4. **Duplicate parameter fatal error** -- made non-fatal under MBZ_STANDALONE
5. **Missing compat_macros.inc** -- fetched real file from libretro/slang-shaders repo
6. **Missing globals** -- replaced local truncated globals.inc and 30+ other include files with upstream versions
7. **packUnorm4x8 not in GLES 300** -- added polyfills injected after SPIRV-Cross compilation
8. **HSM_SHOW_PASS_INDEX = 2** -- was showing TUBE debug pass, changed to 0 for full composite
9. **Cache-info pass** -- switched from custom cache-info-simple to upstream cache-info-all-params

## Key Architecture
- Shaders: fetched from HTTP server -> written to Emscripten MEMFS
- Textures: PNG decoded via canvas 2D -> raw format (uint32 w,h + RGBA) -> MEMFS
- Include resolution: JS-side recursive parser pre-loads all #include files to MEMFS
- Compilation: slang -> glslang (SPIRV) -> SPIRV-Cross (GLES 300) -> WebGL2
- UBOs: real uniform buffer objects, not flattened to arrays
- Parameters: via push_constant blocks, reflected through slang_process
- React: MegaBezel.ts -> WasmBridge.ts -> Emscripten cwrap -> C bridge -> gl3_filter_chain

## Build/Test
```bash
cd build && emmake make -j4
python3 -m http.server 8095
# Demo: http://localhost:8095/demo/render-test.html
# React app: npm run dev -> ShaderTest page
```

## Known Limitations
- Performance: 36 passes at 800x600 is GPU-heavy, needs profiling on various hardware
- No parameter UI: hundreds of mega-bezel params exist but no controls yet
- Single preset tested: only MBZ__3__STD__GDV-local.slangp verified end-to-end
- No real game content: test pattern only, no emulator frame source integration
- Intro animation disabled: works but takes ~300 frames at default speed, disabled for fast startup
