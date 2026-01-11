# Mega Bezel Reflection Shader (Web)

Reusable WebGL2 Mega Bezel reflection shader pipeline with a Vite demo.

## Demo
```bash
npm install
npm run dev
```

## Library Build
```bash
npm run build:lib
```

## Usage (Package)
```ts
import { WebGL2DWithShaders } from "@retroranks/mega-bezel-reflection-shader";

const renderer = new WebGL2DWithShaders(canvas, {
  enabled: true,
  presetPath: "/shaders/mega-bezel/build-full-reflection.slangp",
});
```

## Shader Assets
- Demo assets live in `public/shaders/`.
- Distributable assets are in `assets/shaders/` for copying into your app’s public folder.

## Layout
- `src/shaders/`: Shader compilation and preset loading
- `src/utils/`: WebGL2D helpers
- `src/lib/`: Package entrypoint
- `assets/shaders/`: Packaged shader assets

## Asset Copy Helper
Copy packaged shader assets into a consuming project’s `public/shaders`:
```bash
npm run copy-assets
```

