# mega-bezel-wasm Design Spec

A reusable JS library that applies RetroArch's mega-bezel shader pipeline to arbitrary web content via WASM.

## Motivation

The previous approach -- hand-translating RetroArch's multi-pass slang shader pipeline to WebGL2 in JavaScript -- proved infeasible after weeks of debugging. The mega-bezel preset chain (20+ passes, feedback textures, LUT-based bezels, CRT simulation) is too complex to reimplement correctly outside RetroArch's pipeline.

The correct approach: extract RetroArch's shader subsystem into standalone C/C++, compile it to WASM with Emscripten, and wrap it in a TypeScript API. This gives us the real pipeline with pixel-accurate output, in a minimal bundle.

## Architecture

Three layers:

```
+---------------------------------------------+
|  JS API  (MegaBezel.ts)                     |
|  - create(canvas, preset, options)          |
|  - feedFrame(source)                        |
|  - setParam(name, value)                    |
|  - destroy()                                |
+---------------------------------------------+
|  C Bridge  (bridge.c)                       |
|  - Exported WASM functions (mbz_*)          |
|  - Adapter replacing RA's video_driver_t    |
|  - Owns GL context lifecycle                |
+---------------------------------------------+
|  Extracted RA Shader Pipeline  (C/C++)      |
|  - video_shader_parse.c (preset parser)     |
|  - slang_process.cpp (slang -> SPIR-V)      |
|  - slang_reflection.cpp (SPIR-V -> sem.)    |
|  - shader_gl3.cpp (multi-pass FBO chain)    |
|  - glslang + spirv-cross (vendored deps)    |
+---------------------------------------------+
```

JS fetches all assets (presets, shader sources, LUT textures) and passes them as bytes to the WASM module. The C bridge uploads input frames as GL textures, then the extracted shader pipeline renders the full multi-pass chain to the output canvas.

## Extracted C/C++ Pipeline

### Files extracted from RetroArch

Source: `/Users/spot/Code/emulatorjs-retroarch/`

| File | Purpose | Modifications |
|---|---|---|
| `gfx/video_shader_parse.c/.h` | Preset parser, core data structures | Replace RA config/path system with simple callbacks |
| `gfx/drivers_shader/slang_process.cpp/.h` | Slang preprocessing, `#pragma parameter` extraction | Minimal -- already self-contained |
| `gfx/drivers_shader/slang_reflection.cpp/.h` | SPIR-V reflection, semantic mapping | Minimal |
| `gfx/drivers_shader/glslang_util.c/.h` | glslang compiler integration | Strip RA logging, use error callback |
| `gfx/drivers_shader/glslang.cpp` | Shader file reading, `#include` resolution | Replace RA VFS with buffer-based reads |
| `gfx/drivers_shader/shader_gl3.cpp/.h` | Multi-pass FBO chain, LUT loading, feedback textures | Heaviest surgery -- decouple from `video_driver_t` |

### Vendored dependencies (from RetroArch deps/)

- `glslang` -- compiles slang to SPIR-V
- `spirv-cross` -- compiles SPIR-V to GLSL for WebGL2
- `SPIRV-Tools` -- SPIR-V validation/optimization
- `libretro-common` -- config_file parser, string utilities

### Shims replacing RetroArch globals

- `configuration.h` globals -> `mbz_config` struct passed at init
- `file/config_file.h` -> kept as-is (libretro-common, already standalone)
- `paths.h` wildcard expansion -> stripped entirely (no `$CONTENT-DIR$` etc.)
- `retroarch.h` global state -> eliminated, everything passed explicitly
- Logging -> single callback function pointer

### Key extraction challenge

`shader_gl3.cpp` is the hardest file to extract. The `gl3_filter_chain` class calls into RetroArch for viewport size, frame count, rotation, and other per-frame state. The bridge layer replaces all of these with explicit parameters passed to `mbz_render()`.

Key data structures to preserve from `video_shader_parse.h`:

- `struct video_shader` -- top-level preset (passes, LUTs, parameters)
- `struct video_shader_pass` -- individual pass (source, FBO scale, filter, alias)
- `struct video_shader_parameter` -- user-tweakable float parameter
- `struct video_shader_lut` -- LUT texture definition
- `struct gfx_fbo_scale` -- per-pass scaling rules (input/viewport/absolute)

## C Bridge API

Exported WASM functions:

```c
// Lifecycle
int  mbz_init(int canvas_width, int canvas_height);
void mbz_destroy(void);

// Preset management -- data passed as bytes from JS (no filesystem)
int  mbz_load_preset(const char *preset_data, int len);
void mbz_unload_preset(void);

// Frame input -- JS copies pixel data into WASM heap,
// bridge creates/updates a GL texture
void mbz_set_input_size(int width, int height);
void mbz_upload_frame(const uint8_t *rgba, int stride);

// Render one frame through the shader chain to the canvas
void mbz_render(void);

// Parameters
int   mbz_get_param_count(void);
const char *mbz_get_param_name(int index);
float mbz_get_param_value(int index);
void  mbz_set_param_value(int index, float value);
float mbz_get_param_min(int index);
float mbz_get_param_max(int index);
float mbz_get_param_step(int index);

// LUT textures -- loaded by JS (fetch), uploaded as bytes
int  mbz_load_lut(const char *name, const uint8_t *rgba,
                  int width, int height);

// Per-frame state
void mbz_set_viewport(int x, int y, int width, int height);
void mbz_set_frame_count(int count);
void mbz_set_frame_direction(int direction);
```

### Design decisions

- **No filesystem in WASM.** All assets fetched by JS, passed as byte arrays. Avoids Emscripten VFS overhead.
- **Single GL context.** Created at `mbz_init`, targeting the canvas Emscripten is bound to.
- **Frame count managed by JS.** Caller controls animation speed (pause, slow-mo, reverse).
- **No threading.** Single-threaded -- JS calls `mbz_render()` from `requestAnimationFrame`.

## JS/TS Public API

```typescript
interface MegaBezelOptions {
  preset: string;          // URL or path to .slangp preset
  source: FrameSource;     // what to apply the shader to
  pixelFormat?: 'rgba';    // future: support other formats
  autoRender?: boolean;    // default true -- drives rAF loop
}

type FrameSource =
  | HTMLCanvasElement
  | HTMLVideoElement
  | HTMLImageElement
  | ImageBitmap
  | OffscreenCanvas;

interface ShaderParam {
  name: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

class MegaBezel {
  static async create(
    canvas: HTMLCanvasElement,
    options: MegaBezelOptions
  ): Promise<MegaBezel>;

  setSource(source: FrameSource): void;

  getParams(): ShaderParam[];
  setParam(name: string, value: number): void;
  resetParams(): void;

  async loadPreset(url: string): Promise<void>;

  pause(): void;
  resume(): void;
  renderOnce(): void;

  destroy(): void;
}
```

### Internal flow of `create()`

1. Fetch and instantiate the `.wasm` module
2. Call `mbz_init()` with canvas dimensions
3. Fetch the `.slangp` preset, parse it to discover shader file paths and LUT texture paths
4. Fetch all referenced `.slang` files and LUT images in parallel
5. Pass preset data to `mbz_load_preset()`
6. Upload each LUT texture via `mbz_load_lut()`
7. Start `requestAnimationFrame` loop if `autoRender` is true

### rAF loop

Each frame: extract pixels from `FrameSource` (via scratch canvas + `getImageData` or `createImageBitmap`), copy into WASM heap, call `mbz_upload_frame()`, increment frame count, call `mbz_render()`.

### Preset loading is JS-side

JS fetches the `.slangp`, resolves all `#reference` and relative paths, fetches every `.slang` file and LUT image, then hands the fully-resolved bundle to the C bridge. This keeps WASM filesystem-free and leverages browser caching.

## Build System

### Emscripten flags

```makefile
EMCC_FLAGS = \
  -O3 \
  -flto \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=MegaBezelModule \
  -s EXPORTED_FUNCTIONS=[_mbz_init,_mbz_destroy,...] \
  -s EXPORTED_RUNTIME_METHODS=[ccall,cwrap,HEAPU8] \
  -s MIN_WEBGL_VERSION=2 \
  -s MAX_WEBGL_VERSION=2 \
  -s NO_FILESYSTEM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=16MB \
  -s TOTAL_STACK=1MB \
  -s NO_EXIT_RUNTIME=1 \
  --no-entry
```

Key choices:
- `NO_FILESYSTEM=1` -- all I/O through JS
- `MODULARIZE=1` -- supports multiple instances, no global pollution
- `MIN/MAX_WEBGL_VERSION=2` -- mega-bezel FBO formats require WebGL2
- `--no-entry` -- library-only, no `main()`
- Post-build `wasm-opt -Oz` for minimum size

### Target WASM size

~300-600KB gzipped with glslang + spirv-cross included. Future optimization: precompile presets to SPIR-V at build time, dropping glslang from the bundle (~100-200KB). This sacrifices runtime preset loading and is out of scope for the initial build.

## Repo Structure

```
mega-bezel-reflection-shader-web/
+-- native/                        # Extracted C/C++ code
|   +-- bridge.c                   # WASM-exported API
|   +-- video_shader_parse.c/.h    # Preset parser (from RA)
|   +-- shader_gl3.cpp/.h          # Multi-pass FBO chain (from RA)
|   +-- slang_process.cpp/.h       # Slang compiler (from RA)
|   +-- slang_reflection.cpp/.h    # SPIR-V reflection (from RA)
|   +-- glslang_util.c/.h          # glslang integration (from RA)
|   +-- glslang.cpp                # Shader file reading (from RA)
|   +-- shims/                     # Thin replacements for RA globals
|   |   +-- config_shim.c
|   |   +-- logging_shim.c
|   |   +-- path_shim.c
|   +-- deps/                      # Vendored (from RA deps/)
|       +-- glslang/
|       +-- spirv-cross/
|       +-- SPIRV-Tools/
|       +-- libretro-common/
+-- src/                           # JS/TS library
|   +-- MegaBezel.ts               # Public API class
|   +-- WasmBridge.ts              # cwrap bindings to mbz_* functions
|   +-- PresetLoader.ts            # Fetches & resolves .slangp + deps
|   +-- FrameFeeder.ts             # Extracts pixels from FrameSource
|   +-- types.ts                   # Public type definitions
+-- presets/                       # Upstream mega-bezel (git submodule)
+-- demo/                          # Demo page
|   +-- index.html
|   +-- demo.ts
+-- build/                         # Build scripts
|   +-- Makefile                   # Emscripten build for native/
|   +-- post-build.sh             # wasm-opt, copy to dist/
+-- dist/                          # Built artifacts (gitignored)
|   +-- mega-bezel.wasm
|   +-- mega-bezel.js
|   +-- mega-bezel.d.ts
|   +-- index.js
+-- package.json
+-- tsconfig.json
+-- vite.config.ts
```

### What gets deleted

- `src/shaders/` -- JS WebGL2 reimplementation
- `src/pages/`, `src/App.tsx`, `src/main.tsx` -- React app
- `scripts/` -- shader compilation check scripts
- `public/shaders/` -- WebGL2-adapted shader copies
- `mega-bezel/` directory -- replaced by git submodule to upstream

## Error Handling

### Browser requirements

- WebGL2 required. `MegaBezel.create()` checks and throws a clear error if unavailable. No WebGL1 fallback.
- WASM required. Same pattern.

### GL resource limits

- `MAX_TEXTURE_SIZE` queried at init, FBO sizes capped accordingly.
- LUT textures checked against limit, warning if exceeded.
- 20+ passes with 1 color attachment each is well within WebGL2 guarantees.

### Frame source edge cases

- `HTMLVideoElement` before metadata: defer until `loadeddata`
- Cross-origin sources: detect and surface clear error about CORS
- Zero-size source: skip rendering, don't crash

### Memory

- WASM heap grows as needed. FBO textures live in GL memory (not WASM heap), so heap usage stays modest.
- `destroy()` frees all GL resources and the WASM instance. All methods throw after `destroy()`.

### Preset loading failures

- Missing `.slang` file: promise rejects with which file failed
- Shader compilation error: surfaces glslang error message
- Missing LUT texture: renders with black texture, logs warning
- No silent failures anywhere.

## Testing

### 1. Native C/C++ unit tests (host machine, no Emscripten)

- Preset parser: feed `.slangp` files, verify pass count, parameters, LUT paths
- Slang compilation: compile `.slang` to SPIR-V, verify no errors
- SPIR-V reflection: verify semantic mappings
- Fast iteration, catches extraction regressions

### 2. WASM integration tests (headless browser via Playwright)

- Full lifecycle: `mbz_init` -> `mbz_load_preset` -> `mbz_upload_frame` -> `mbz_render` -> read pixels
- Verify output is not black, not identical to input
- Verify parameter changes produce different output
- Verify `destroy()` cleans up without WebGL errors

### 3. Visual regression tests

- Golden image comparison against reference screenshots
- Tolerance threshold for GPU driver floating-point differences
- Deterministic CI via SwiftShader (software GL in headless Chromium)
- Three representative presets: POTATO (simple), STD (mid), ADV (full)

### Demo page as manual test

- Load image, apply preset, tweak parameters
- Visual confirmation of bezel, CRT curvature, reflections, scanlines
