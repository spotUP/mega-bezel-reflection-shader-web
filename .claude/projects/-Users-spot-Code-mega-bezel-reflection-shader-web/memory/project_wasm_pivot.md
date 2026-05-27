---
name: project-wasm-pivot
description: Project pivoted from JS WebGL2 shader reimplementation to extracting RetroArch shader subsystem into standalone WASM library
metadata:
  type: project
---

Project is pivoting from hand-translating mega-bezel shaders to WebGL2 in JS (proved infeasible after weeks) to extracting RetroArch's shader pipeline into standalone C/C++ compiled to WASM via Emscripten.

**Why:** The mega-bezel preset chain (20+ passes, feedback textures, LUT bezels, CRT sim) is too complex to reimplement. User has proven WASM approach works via PUAE build in LVLLVL-Amiga project.

**How to apply:** All new work should follow the 7-phase plan in `thoughts/shared/plans/2026-05-27-mega-bezel-wasm-extraction.md`. Design spec is at `docs/superpowers/specs/2026-05-27-mega-bezel-wasm-design.md`. RetroArch source to extract from is at `/Users/spot/Code/emulatorjs-retroarch/`. The old JS WebGL2 code on main is dead -- don't build on it.
