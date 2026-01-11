#version 450

/*
   Mega Bezel Style Bezel + Frame Composite for WebGL2

   Pipeline understanding:
   - CRTPass: Contains game content with CRT effects, FULLSCREEN (fills 0-1 UV)
   - This pass: Composites CRTPass into centered screen area with bezel around it

   Coordinate remapping:
   - Screen area is centered at 85% of viewport
   - For screen pixels: sample CRTPass at remapped coords
   - For bezel pixels: show carbon fiber + reflection
*/

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
} params;

layout(std140, set = 0, binding = 0) uniform UBO {
    mat4 MVP;
    vec4 SourceSize;
    vec4 OriginalSize;
    vec4 OutputSize;
    uint FrameCount;
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
layout(set = 0, binding = 3) uniform sampler2D CRTPass;
layout(set = 0, binding = 4) uniform sampler2D BackgroundImage;
layout(set = 0, binding = 5) uniform sampler2D FrameTextureImage;
layout(set = 0, binding = 6) uniform sampler2D InfoCachePass;

// Screen configuration - game takes up 85% of viewport height
const float SCREEN_SCALE = 0.85;
const float BEZEL_WIDTH = 0.035;
const float FRAME_WIDTH = 0.012;
const float CORNER_RADIUS = 0.018;

// Appearance
const float BEZEL_BRIGHTNESS = 0.35;  // Carbon fiber visibility
const float REFLECTION_AMOUNT = 0.12;
const float INNER_SHADOW = 0.4;

// Rounded rectangle SDF
float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
    vec2 uv = vTexCoord;
    vec2 centered = uv - 0.5;
    float aspect = global.OutputSize.x / global.OutputSize.y;

    // Apply aspect ratio correction - game is square (1:1)
    vec2 aspectCorrected = centered * vec2(aspect, 1.0);

    // Screen area - square, 85% of viewport height
    float screenHalf = SCREEN_SCALE * 0.5;
    vec2 screenSize = vec2(screenHalf, screenHalf);  // Square
    float screenDist = roundedBoxSDF(aspectCorrected, screenSize, CORNER_RADIUS);
    float screenMask = 1.0 - smoothstep(-0.003, 0.003, screenDist);

    // Bezel area - around the screen
    vec2 bezelSize = screenSize + vec2(BEZEL_WIDTH, BEZEL_WIDTH);
    float bezelDist = roundedBoxSDF(aspectCorrected, bezelSize, CORNER_RADIUS * 1.2);
    float bezelMask = (1.0 - smoothstep(-0.003, 0.003, bezelDist)) * (1.0 - screenMask);

    // Frame area - around the bezel
    vec2 frameSize = bezelSize + vec2(FRAME_WIDTH, FRAME_WIDTH);
    float frameDist = roundedBoxSDF(aspectCorrected, frameSize, CORNER_RADIUS * 1.4);
    float outerMask = 1.0 - smoothstep(-0.003, 0.003, frameDist);
    float frameMask = outerMask * (1.0 - screenMask) * (1.0 - bezelMask);

    //==========================================================================
    // SAMPLE CRT CONTENT - Remap coordinates for screen area
    //==========================================================================

    // Map viewport coords to CRT texture coords
    // Screen area maps to full CRT texture (0-1)
    vec2 crtUV = (aspectCorrected / screenHalf) * 0.5 + 0.5;

    // Sample CRT with bounds check
    vec4 crtColor = vec4(0.0);
    if (crtUV.x >= 0.0 && crtUV.x <= 1.0 && crtUV.y >= 0.0 && crtUV.y <= 1.0) {
        crtColor = texture(CRTPass, crtUV);
    }

    //==========================================================================
    // BEZEL - Carbon fiber with inner shadow and reflection
    //==========================================================================

    // Sample carbon fiber background (tiled)
    vec2 bgUV = uv * 5.0;
    vec4 bgColor = texture(BackgroundImage, bgUV);

    // Inner shadow - darker near screen edge
    float shadowDist = max(0.0, -screenDist);  // Distance into bezel from screen
    float shadowFade = 1.0 - exp(-shadowDist * 25.0) * INNER_SHADOW;

    // Bezel base color with shadow
    vec3 bezelColor = bgColor.rgb * BEZEL_BRIGHTNESS * shadowFade;

    // Reflection - sample edge of CRT and add to bezel
    if (bezelMask > 0.0) {
        // Clamp to edge of screen for reflection source
        vec2 reflectUV = clamp(crtUV, 0.02, 0.98);
        vec3 reflectColor = texture(CRTPass, reflectUV).rgb;

        // Fade reflection with distance from screen
        float reflectFade = exp(-max(0.0, screenDist) * 20.0);
        bezelColor += reflectColor * REFLECTION_AMOUNT * reflectFade;
    }

    //==========================================================================
    // FRAME - Darker outer border
    //==========================================================================

    vec3 frameColor = bgColor.rgb * BEZEL_BRIGHTNESS * 0.3;

    //==========================================================================
    // FINAL COMPOSITION
    //==========================================================================

    vec3 finalColor = vec3(0.0);

    // Layer 1: Screen content (game with CRT effects)
    finalColor += crtColor.rgb * screenMask;

    // Layer 2: Bezel with carbon fiber and reflection
    finalColor += bezelColor * bezelMask;

    // Layer 3: Frame (darker outer border)
    finalColor += frameColor * frameMask;

    // Only show content inside the frame
    finalColor *= outerMask;

    FragColor = vec4(finalColor, 1.0);
}
