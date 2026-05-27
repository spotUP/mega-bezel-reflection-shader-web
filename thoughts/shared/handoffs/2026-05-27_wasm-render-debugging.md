---
date: 2026-05-27
topic: WASM render pipeline debugging - black output
tags: [wasm, debugging, render, handoff]
status: draft
---

# Handoff: WASM Render Pipeline - Black Output Debug

## Branch: `wasm-pivot` (commit `ac6f339`)

## What Works
- Full pipeline runs end-to-end with ZERO GL errors
- WebGL2 context created via `emscripten_webgl_create_context("#output")`
- Preset parsing, slang compilation, filter chain creation all succeed
- Input RGBA texture uploaded via `glTexImage2D`
- `build_offscreen_passes` + `build_viewport_pass` execute without errors
- Pixel readback shows A=255 (shader IS writing output)

## The Bug
- RGB channels are all 0 despite input being a red/green gradient
- The `Source` sampler in the shader reads black
- The shader outputs `vec4(texture(Source, vTexCoord).rgb, 1.0)` so A=255 confirms the shader runs

## Most Likely Cause
The `gl3_filter_chain::set_input_texture()` sets the chain's input texture struct, but the texture might not get bound to the correct sampler location during the render pass. In RetroArch, the filter chain binds textures at specific active texture units. The binding flow:

1. `set_input_texture()` stores the texture info in `input_texture` member
2. `build_viewport_pass()` calls the pass's `build_commands()` 
3. `build_commands()` should bind `input_texture.image` to the `Source` sampler

**Specific things to check:**
- In `shader_gl3.cpp`, look at `Pass::build_commands()` around line ~1540
- Check if `common->input_texture` is being used correctly
- The `Source` sampler binding location (set=0, binding=2 in the shader)
- Whether `glActiveTexture(GL_TEXTURE2)` + `glBindTexture` happens for the input
- The `original_texture` vs `source_texture` distinction in the filter chain
- For a single-pass preset, the viewport pass IS the only pass — check `build_viewport_pass` not `build_offscreen_passes`

## Key Files
- `native/bridge_renderer.cpp:90-123` — the render function
- `native/gfx/drivers_shader/shader_gl3.cpp:1540-1600` — Pass::build_commands
- `native/gfx/drivers_shader/shader_gl3.cpp:1920-1960` — build_viewport_pass impl
- `demo/render-test.html` — the test page (loads a 1-pass stock passthrough preset)

## Build/Test
```bash
cd build && emmake make -j4
# Serve from project root
python3 -m http.server 8095
# Open http://localhost:8095/demo/render-test.html
```

## Fixes Applied This Session
- `HAVE_OPENGLES` defined (not just `HAVE_OPENGLES3`) to suppress GL_FRAMEBUFFER_SRGB calls
- MVP matrix changed from identity to RetroArch's default ortho (scale 2, translate -1,-1)
- `mbz_renderer_init_gl()` creates the WebGL2 context from C side
- `mbz_renderer_read_pixel()` for C-side framebuffer readback
- `HEAPU8` added to EXPORTED_RUNTIME_METHODS
- Heap allocation via bridge functions instead of Module._malloc
