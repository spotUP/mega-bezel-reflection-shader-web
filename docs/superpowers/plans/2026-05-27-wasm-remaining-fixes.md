# WASM Mega-Bezel Remaining Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all remaining issues in the WASM mega-bezel render pipeline so it's production-ready: frozen intro animation, React app integration, debug noise removal, and cleanup.

**Architecture:** The pipeline compiles 36 slang shaders via glslang/SPIRV-Cross to GLES 300, renders through RetroArch's gl3_filter_chain in WASM, and presents to a WebGL2 canvas. The React app wraps this via MegaBezel.ts → WasmBridge.ts → Emscripten MEMFS. The PresetLoader.ts handles asset fetching, include resolution, and texture decoding.

**Tech Stack:** Emscripten/WASM, WebGL2, SPIRV-Cross, React/TypeScript, Vite

---

### Task 1: Fix FrameCount Not Reaching Shaders (Intro Animation Frozen)

The intro animation reads `global.FrameCount` from the UBO but it never changes. The C bridge increments `g_frame_count` and calls `gl3_filter_chain_set_frame_count`, but the value doesn't reach the shader. Root cause: with `flatten=false`, the UBO uses real `glBindBufferBase` and the frame count is written to the uniform buffer at the offset from SPIR-V reflection. The `build_semantic_uint` function has two paths — one writes via `glUniform1ui` (flat path) and one writes to the buffer (real UBO path). We need to verify the correct path is taken and the offset is correct.

**Files:**
- Modify: `native/gfx/drivers_shader/shader_gl3.cpp` (lines 1339-1370 `build_semantic_uint`, lines 1735-1770 UBO upload)

- [ ] **Step 1: Add diagnostic logging for FrameCount semantic**

After the `build_semantic_uint` call for `SLANG_SEMANTIC_FRAME_COUNT` (around line 1631), add a one-time log that prints the offset, the value written, and which write path was used. This tells us exactly where the frame count lands in the buffer.

```cpp
// In Pass::build_semantics, after line 1634:
#ifdef MBZ_STANDALONE
   {
      static bool logged_fc = false;
      if (!logged_fc) {
         auto &sem = reflection.semantics[SLANG_SEMANTIC_FRAME_COUNT];
         fprintf(stderr, "[MBZ DBG] FrameCount: ubo_offset=%u uniform=%d push=%d value=%u\n",
            (unsigned)sem.ubo_offset,
            (int)sem.uniform,
            (int)sem.push_constant,
            frame_count_period ? uint32_t(frame_count % frame_count_period) : uint32_t(frame_count));
         logged_fc = true;
      }
   }
#endif
```

- [ ] **Step 2: Rebuild, load demo, check console for the diagnostic**

```bash
cd build && emmake make -j4
```

Open `http://localhost:8095/demo/render-test.html`, check browser console for `[MBZ DBG] FrameCount:`. The output tells us:
- If `ubo_offset` is 0 and `uniform=0`, the semantic wasn't reflected (shader doesn't use it directly)
- If `ubo_offset` is reasonable (e.g. 132-180), it's in the buffer but might be at wrong offset
- If `push_constant=1`, it's in push constants not UBO

- [ ] **Step 3: Fix based on diagnostic**

**If `uniform=0` and `ubo_offset=0`:** The FrameCount semantic wasn't reflected because the intro shader accesses it through `global.FrameCount` which SPIRV-Cross may have optimized differently. The fix: check that `reflect_parameter("FrameCount", ...)` at line 1157 is finding the member in the compiled SPIR-V. The issue may be that with real UBOs (non-flattened), the member lookup key differs.

**If the offset looks correct but the value doesn't change on screen:** The UBO buffer might not be re-uploaded each frame. Check that the UBO ring path (lines 1753-1770) runs for the intro pass — add a one-time log inside that block to confirm it executes.

**If the intro pass uses the flat uniform path instead of the UBO path:** Then `glUniform1ui` is called but the uniform location might be -1 (not found). Log `locations.flat_ubo_vertex` and `locations.flat_ubo_fragment` for the intro pass.

- [ ] **Step 4: Verify intro animation fades out**

After the fix, reload the demo with `HSM_INTRO_WHEN_TO_SHOW = 1` (re-enable intro in the preset). The intro should animate: power-on scanline effect → logo fade in → logo hold → fade out → game visible. This takes ~300 frames at default speed.

- [ ] **Step 5: Remove the diagnostic logging added in Step 1**

Remove the `logged_fc` block. Keep the fix.

- [ ] **Step 6: Rebuild and commit**

```bash
cd build && emmake make -j4
git add native/gfx/drivers_shader/shader_gl3.cpp
git commit -m "fix: FrameCount reaching shaders through real UBOs"
```

---

### Task 2: Gate Debug fprintf Behind MBZ_DEBUG Flag

9 verbose `[MBZ DBG]` fprintf calls in shader_gl3.cpp spam stderr on every shader compile and draw. Gate them behind a separate `MBZ_DEBUG` flag so `MBZ_STANDALONE` can remain defined without the noise.

**Files:**
- Modify: `native/gfx/drivers_shader/shader_gl3.cpp` (9 fprintf blocks)

- [ ] **Step 1: Replace all `#ifdef MBZ_STANDALONE` guards around fprintf debug lines with `#ifdef MBZ_DEBUG`**

The 9 locations are:
1. Lines ~287-289: Cross-compiled VS/FS print
2. Lines ~376: tex fixup print
3. Lines ~1533-1537: set_semantic_texture print
4. Lines ~1543-1544: BIND tex print
5. Lines ~1700-1703: build_commands pipeline/src_tex print
6. Lines ~1715-1717: UBO vertex MVP print
7. Lines ~1838-1851: GL error + draw state print

Change each from:
```cpp
#ifdef MBZ_STANDALONE
   fprintf(stderr, "[MBZ DBG] ...");
#endif
```
To:
```cpp
#ifdef MBZ_DEBUG
   fprintf(stderr, "[MBZ DBG] ...");
#endif
```

Leave the `[MBZ ERR]` messages (via `RARCH_ERR`) untouched — those are legitimate error reporting.

Also leave the `#ifdef MBZ_STANDALONE` guards that are NOT fprintf debug lines (like the `glUniformBlockBinding` calls at lines 361-364, the duplicate parameter tolerance in `glslang_util_cxx.cpp`).

- [ ] **Step 2: Rebuild without MBZ_DEBUG to verify clean console**

```bash
cd build && emmake make -j4
```

Reload demo — console should have no `[MBZ DBG]` lines. Only `[MBZ ERR]` on actual errors.

- [ ] **Step 3: Commit**

```bash
git add native/gfx/drivers_shader/shader_gl3.cpp
git commit -m "chore: gate shader debug logging behind MBZ_DEBUG flag"
```

---

### Task 3: Wire ShaderTest.tsx to WASM Renderer

Replace the old `PureWebGL2MultiPassRenderer` in ShaderTest.tsx with the `MegaBezel` WASM class. The `MegaBezel.ts`, `WasmBridge.ts`, and `PresetLoader.ts` are already complete — this task just connects them to the React page.

**Files:**
- Modify: `src/pages/ShaderTest.tsx`
- Modify: `src/lib/PresetLoader.ts` (add include resolution)
- Modify: `src/lib/MegaBezel.ts` (minor: remove unused `gl` field)

- [ ] **Step 1: Add recursive include resolution to PresetLoader.ts**

The current `PresetLoader.loadShaderFiles` fetches shader `.slang` files but doesn't resolve their `#include` directives. The demo's JS resolver does this — port the same logic. Add after the existing `loadShaderFiles`:

```typescript
private async resolveIncludes(shaderText: string, shaderDir: string, loaded: Set<string>) {
  const includeRe = /^\s*#include\s+"([^"]+)"/gm
  let match: RegExpExecArray | null
  while ((match = includeRe.exec(shaderText)) !== null) {
    const relPath = match[1]
    const parts = (shaderDir + '/' + relPath).split('/')
    const resolved: string[] = []
    for (const p of parts) {
      if (p === '..') { if (resolved.length) resolved.pop() }
      else if (p !== '.' && p !== '') resolved.push(p)
    }
    const includePath = resolved.join('/')
    if (loaded.has(includePath)) continue
    loaded.add(includePath)

    const url = this.resolveUrl(this.baseUrl, includePath)
    let text: string
    try { text = await this.fetchText(url) } catch { continue }

    const memfsPath = this.resolveMemfsPath('/preset', includePath)
    this.ensureDirForFile(memfsPath)
    this.bridge.fs.writeFile(memfsPath, text)

    const includeDir = includePath.substring(0, includePath.lastIndexOf('/'))
    await this.resolveIncludes(text, includeDir, loaded)
  }
}
```

Update `loadShaderFiles` to call it after fetching each shader:

```typescript
private async loadShaderFiles(info: PresetInfo, presetDir: string) {
  const seen = new Set<string>()
  const loadedIncludes = new Set<string>()

  for (const relPath of info.passPaths) {
    const absMemfs = this.resolveMemfsPath('/preset', relPath)
    if (seen.has(absMemfs)) continue
    seen.add(absMemfs)

    const url = this.resolveUrl(presetDir, relPath)
    const text = await this.fetchText(url)
    this.ensureDirForFile(absMemfs)
    this.bridge.fs.writeFile(absMemfs, text)

    const shaderDir = relPath.substring(0, relPath.lastIndexOf('/'))
    await this.resolveIncludes(text, shaderDir, loadedIncludes)
  }
}
```

Also ensure `compat_macros.inc` (which lives outside the shader tree at `/include/`) is written to the correct MEMFS path. In `resolveIncludes`, paths that escape above `shaders/` should map to the MEMFS root:

```typescript
const memfsPath = includePath.startsWith('shaders/')
  ? this.resolveMemfsPath('/preset', includePath)
  : '/' + includePath
```

- [ ] **Step 2: Remove unused `gl` field from MegaBezel.ts**

```typescript
// Remove these lines:
private gl: WebGL2RenderingContext | null = null
// And in destroy():
this.gl = null
```

- [ ] **Step 3: Rewrite ShaderTest.tsx to use MegaBezel**

Replace the entire component. Key changes:
- Import `MegaBezel` instead of `PureWebGL2MultiPassRenderer`
- Call `megaBezel.init()` → `megaBezel.loadPreset()` → render loop with `megaBezel.renderFrame()`
- The test pattern image stays the same but is passed as an `ImageData` `FrameSource`
- Remove the old `PureWebGL2MultiPassRenderer` usage entirely

```tsx
import React, { useEffect, useRef, useState } from 'react'
import { MegaBezel } from '../lib/MegaBezel'

export default function ShaderTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('Initializing...')
  const mbRef = useRef<MegaBezel | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let disposed = false

    ;(async () => {
      try {
        setStatus('Loading WASM module...')
        const mb = new MegaBezel({ canvas, wasmUrl: '/dist/wasm/mega-bezel.wasm' })
        mbRef.current = mb
        await mb.init()
        setStatus('Loading preset...')
        await mb.loadPreset('/shaders/mega-bezel/MBZ__3__STD__GDV-local.slangp', '/shaders/mega-bezel')
        setStatus('Rendering...')

        // Test pattern
        const patternCanvas = document.createElement('canvas')
        patternCanvas.width = 256; patternCanvas.height = 224
        const ctx = patternCanvas.getContext('2d')!
        const bars = ['#ffffff','#ffff00','#00ffff','#00ff00','#ff00ff','#ff0000','#0000ff']
        const bw = Math.floor(256 / bars.length)
        bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * bw, 0, bw, 112) })
        for (let y = 112; y < 224; y += 16)
          for (let x = 0; x < 256; x += 16) {
            ctx.fillStyle = ((x / 16 + y / 16) % 2) ? '#e6e6e6' : '#1a1a1a'
            ctx.fillRect(x, y, 16, 16)
          }
        const imageData = ctx.getImageData(0, 0, 256, 224)

        let frame = 0
        const loop = () => {
          if (disposed) return
          mb.renderFrame(imageData)
          frame++
          if (frame % 60 === 0) setStatus(`Rendering... frame ${frame}`)
          requestAnimationFrame(loop)
        }
        requestAnimationFrame(loop)
      } catch (e) {
        setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
      }
    })()

    return () => {
      disposed = true
      mbRef.current?.destroy()
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', fontFamily: 'monospace' }}>
      <h1>Mega Bezel 36-Pass Shader (WASM)</h1>
      <div style={{ marginBottom: 16, padding: 10, background: '#222', borderRadius: 5 }}>{status}</div>
      <canvas ref={canvasRef} width={800} height={600} style={{ width: 800, height: 600, border: '2px solid #444' }} />
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 5: Test in dev server**

```bash
npm run dev
```

Navigate to the ShaderTest page. Verify the WASM module loads, the preset compiles, and the mega-bezel renders with bezel frame and reflections.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ShaderTest.tsx src/lib/PresetLoader.ts src/lib/MegaBezel.ts
git commit -m "feat: wire ShaderTest page to WASM mega-bezel renderer"
```

---

### Task 4: Fix MegaBezel.ts renderFrame to Not Re-upload Every Frame

Currently `MegaBezel.renderFrame()` calls `bridge.rendererUploadFrame()` which does `_malloc`, `HEAPU8.set`, the C-side `glTexImage2D`/`glTexSubImage2D` + `glGenerateMipmap`, then `_free` — every single frame. For a static test pattern this wastes time. For video/emulator sources the upload is needed, but the malloc/free per frame is wasteful. The heap pointer should be kept alive and reused.

**Files:**
- Modify: `src/lib/WasmBridge.ts` (rendererUploadFrame)

- [ ] **Step 1: Cache the heap allocation in WasmBridge**

```typescript
private uploadPtr = 0
private uploadSize = 0

rendererUploadFrame(rgba: Uint8Array, width: number, height: number): boolean {
  const size = rgba.byteLength
  if (size > this.uploadSize) {
    if (this.uploadPtr) this.mod._free(this.uploadPtr)
    this.uploadPtr = this.mod._malloc(size)
    this.uploadSize = size
  }
  this.mod.HEAPU8.set(rgba, this.uploadPtr)
  return this.call('mbz_renderer_upload_frame', this.uploadPtr, width, height) === 1
}
```

Update `destroy()` to free the cached pointer:

```typescript
destroy() {
  if (this.uploadPtr) {
    this.mod._free(this.uploadPtr)
    this.uploadPtr = 0
    this.uploadSize = 0
  }
  this.call('mbz_destroy')
}
```

- [ ] **Step 2: Rebuild, verify no memory growth in continuous rendering**

Open browser dev tools Memory tab. Confirm heap stays stable during continuous rendering.

- [ ] **Step 3: Commit**

```bash
git add src/lib/WasmBridge.ts
git commit -m "perf: cache WASM heap allocation for frame uploads"
```

---

### Task 5: Clean Up Preset Configuration

The local preset `MBZ__3__STD__GDV-local.slangp` has leftover debug settings. Fix them for correct default rendering.

**Files:**
- Modify: `public/shaders/mega-bezel/MBZ__3__STD__GDV-local.slangp`

- [ ] **Step 1: Fix preset parameters**

Set these at the end of the file:
```ini
# Disable intro for fast startup (set to 1 to re-enable)
HSM_INTRO_WHEN_TO_SHOW = 0

# Show full composite (0=END, 1=REFLECTION, 2=TUBE, 3=CRT...)
HSM_SHOW_PASS_INDEX = 0

# Normal processing
HSM_NON_USER_INFO_POST_CRT_PROCESS = 0
```

Remove the commented-out lines:
```
# HSM_ASPECT_RATIO_MODE = 6
# HSM_CURVATURE_MODE = 0
```

- [ ] **Step 2: Commit**

```bash
git add public/shaders/mega-bezel/MBZ__3__STD__GDV-local.slangp
git commit -m "fix: clean up preset debug parameters"
```

---

### Task 6: Update Handoff Document

**Files:**
- Modify: `thoughts/shared/handoffs/2026-05-27_wasm-render-debugging.md`

- [ ] **Step 1: Update handoff with final session state**

Update the "Next Steps" section to reflect what was completed vs what remains. Add a "Known Limitations" section covering:
- Performance: 36 passes at 800x600 is GPU-heavy, needs profiling
- No parameter UI: hundreds of mega-bezel params exist but no controls yet
- Single preset: only MBZ__3__STD__GDV-local tested end-to-end
- No real game content integration yet (emulator frame source)

- [ ] **Step 2: Commit**

```bash
git add thoughts/shared/handoffs/2026-05-27_wasm-render-debugging.md
git commit -m "docs: update handoff with final session state"
```
