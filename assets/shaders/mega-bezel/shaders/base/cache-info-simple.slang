#version 450

/*
    Simplified Mega Bezel Cache Info for WebGL2
    Provides essential screen geometry values without the full complexity

    Stores values in an 8x8 grid texture matching the original cache format
*/

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OriginalSize;
    vec4 OutputSize;
    vec4 FinalViewportSize;
    vec4 DerezedPassSize;
} params;

layout(std140, set = 0, binding = 0) uniform UBO {
    mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main() {
    gl_Position = global.MVP * Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 2) uniform sampler2D Source;

// Default screen height (matches Mega Bezel default)
const float DEFAULT_SCREEN_HEIGHT = 0.7955;

// Check if coordinate is in a specific cache cell
bool isInCacheCell(vec2 coord, int cellX, int cellY) {
    float cellSize = 1.0 / 8.0;
    vec2 cellMin = vec2(float(cellX - 1), float(cellY - 1)) * cellSize;
    vec2 cellMax = cellMin + vec2(cellSize);
    return coord.x >= cellMin.x && coord.x < cellMax.x &&
           coord.y >= cellMin.y && coord.y < cellMax.y;
}

void main() {
    vec2 coord = vTexCoord;
    FragColor = vec4(0.0);

    // Calculate basic screen geometry
    float outputAspect = params.FinalViewportSize.x / params.FinalViewportSize.y;
    vec2 sourceSize = params.DerezedPassSize.xy;
    float sourceAspect = sourceSize.x / sourceSize.y;

    // Screen aspect - use source aspect or 4:3 default
    float screenAspect = sourceAspect > 0.1 ? sourceAspect : 1.333;

    // Screen scale - fit screen to viewport with default height
    float screenHeight = DEFAULT_SCREEN_HEIGHT;
    vec2 screenScale = vec2(screenAspect / outputAspect, 1.0) * screenHeight;

    // Tube scale - slightly larger than screen for bezel
    float tubeThickness = 0.01; // Small black edge
    vec2 tubeScale = screenScale * (1.0 + tubeThickness);

    // Tube diffuse scale - area where tube diffuse texture is mapped
    vec2 tubeDiffuseScale = tubeScale * 1.02;

    // Position offset (centered)
    vec2 posOffset = vec2(0.0, 0.0);

    // Cropped size (same as source for now - no cropping)
    vec2 croppedSize = sourceSize;
    vec2 croppedSampleStart = vec2(0.0);

    // Sampling multiplier (1:1 for now)
    vec2 samplingMult = vec2(1.0, 1.0);

    // Average luminance (sample center of screen)
    vec4 centerSample = texture(Source, vec2(0.5, 0.5));
    float avgLuma = dot(centerSample.rgb, vec3(0.299, 0.587, 0.114));

    // ========== Store values in cache grid ==========
    // Format matches original Mega Bezel cache layout

    // Sample 1, 1 - sampling_dir_mult.rg, avgLuma.a
    if (isInCacheCell(coord, 1, 1)) {
        FragColor.rg = samplingMult;
        FragColor.a = avgLuma;
    }

    // Sample 2, 1 - screenAspect.r, screenScale.ba
    if (isInCacheCell(coord, 2, 1)) {
        FragColor.r = screenAspect;
        FragColor.ba = screenScale;
    }

    // Sample 3, 1 - tubeScale.rg, posOffset.ba
    if (isInCacheCell(coord, 3, 1)) {
        FragColor.rg = tubeScale;
        FragColor.ba = posOffset;
    }

    // Sample 4, 1 - croppedSizeWithResMult.rg, derezedSize.ba
    if (isInCacheCell(coord, 4, 1)) {
        FragColor.rg = croppedSize * samplingMult;
        FragColor.ba = sourceSize;
    }

    // Sample 1, 2 - croppedSize.rg, sampleAreaStart.ba
    if (isInCacheCell(coord, 1, 2)) {
        FragColor.rg = croppedSize;
        FragColor.ba = croppedSampleStart;
    }

    // Sample 2, 3 - coreSize.rg, rotatedCoreSize.ba
    if (isInCacheCell(coord, 2, 3)) {
        FragColor.rg = params.OriginalSize.xy;
        FragColor.ba = sourceSize;
    }

    // Sample 3, 3 - viewportZoom.rg, viewportPos.ba
    if (isInCacheCell(coord, 3, 3)) {
        FragColor.rg = vec2(1.0, 1.0); // No zoom
        FragColor.ba = vec2(0.0, 0.0); // Centered
    }

    // Sample 3, 4 - tubeDiffuseScale.rg
    if (isInCacheCell(coord, 3, 4)) {
        FragColor.rg = tubeDiffuseScale;
        FragColor.ba = tubeDiffuseScale; // Same for 2nd screen
    }

    // Sample 4, 4 - screenSize in pixels
    if (isInCacheCell(coord, 4, 4)) {
        vec2 screenSizePx = params.FinalViewportSize.xy * screenScale;
        FragColor.rg = screenSizePx;
        FragColor.ba = screenSizePx;
    }

    // Sample 2, 4 - negative crop multiplier, max negative crop, use_vert_scanlines
    if (isInCacheCell(coord, 2, 4)) {
        FragColor.r = 1.0; // No negative crop expansion
        FragColor.g = 0.0; // No max negative crop
        FragColor.b = 0.0; // Horizontal scanlines by default
    }

    // Sample 8, 8 - cache changed flag
    if (isInCacheCell(coord, 8, 8)) {
        FragColor.r = 1.0; // Always report changed for simplicity
    }
}
