#version 450

/*
   Mega Bezel Style Composite for WebGL2
   Clean implementation with proper screen sizing
*/

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
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
layout(set = 0, binding = 3) uniform sampler2D CRTPass;
layout(set = 0, binding = 4) uniform sampler2D BlurredPass;
layout(set = 0, binding = 5) uniform sampler2D BackgroundImage;
layout(set = 0, binding = 6) uniform sampler2D FrameTextureImage;

// Geometry - screen LARGER so content fits
const float SCREEN_SCALE = 0.88;        // Larger screen (was 0.72)
const float BEZEL_WIDTH = 0.045;        // Thinner bezel
const float CORNER_RADIUS = 0.02;
const float REFLECTION_STRENGTH = 0.08; // Reduced reflection

// Rounded rectangle SDF
float roundedBoxSDF(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
    vec2 uv = vTexCoord;
    vec2 centered = uv - 0.5;
    float aspect = params.OutputSize.x / params.OutputSize.y;

    // Screen area - LARGER to fit content
    vec2 screenSize = vec2(SCREEN_SCALE * 0.5 / aspect, SCREEN_SCALE * 0.5);
    float screenDist = roundedBoxSDF(centered, screenSize, CORNER_RADIUS * 0.5);
    float screenMask = 1.0 - smoothstep(0.0, 0.004, screenDist);

    // Bezel area
    vec2 bezelSize = screenSize + vec2(BEZEL_WIDTH / aspect, BEZEL_WIDTH);
    float bezelDist = roundedBoxSDF(centered, bezelSize, CORNER_RADIUS);
    float bezelMask = (1.0 - smoothstep(0.0, 0.004, bezelDist)) * (1.0 - screenMask);

    // Frame boundary
    vec2 frameSize = bezelSize + vec2(0.015 / aspect, 0.015);
    float frameDist = roundedBoxSDF(centered, frameSize, CORNER_RADIUS + 0.008);
    float frameMask = 1.0 - smoothstep(0.0, 0.003, frameDist);

    // Background mask
    float bgMask = 1.0 - frameMask;

    // Sample textures
    vec4 crtColor = texture(CRTPass, uv);
    vec4 blurColor = texture(BlurredPass, uv);

    // Background - tile carbon fiber
    vec2 bgUV = uv * 4.0;
    vec4 bgColor = texture(BackgroundImage, bgUV);

    // Frame highlights
    vec4 frameHighlight = texture(FrameTextureImage, uv);

    // Screen edge glow (subtle)
    float edgeDist = max(0.0, screenDist);
    float edgeGlow = exp(-edgeDist * 30.0) * REFLECTION_STRENGTH;
    vec3 reflectionColor = blurColor.rgb * edgeGlow;

    // Build final color
    vec3 finalColor = vec3(0.0);

    // Background (carbon fiber) - brighter
    finalColor = bgColor.rgb * bgMask;

    // Bezel - carbon fiber base + highlight + reflection
    vec3 bezelColor = bgColor.rgb * 0.6;
    bezelColor += frameHighlight.rgb * 0.25;
    bezelColor += reflectionColor;
    finalColor += bezelColor * bezelMask;

    // Inner edge - subtle dark line at screen/bezel boundary
    float innerEdge = smoothstep(0.008, 0.0, abs(screenDist)) * 0.3;
    finalColor = mix(finalColor, vec3(0.02), innerEdge * (1.0 - screenMask));

    // Screen content - direct passthrough, preserve colors
    finalColor += crtColor.rgb * screenMask;

    // Frame edge (dark outline)
    float frameEdge = smoothstep(0.005, 0.0, abs(bezelDist));
    finalColor = mix(finalColor, vec3(0.01), frameEdge * 0.6);

    // Subtle vignette
    float vignette = 1.0 - dot(centered, centered) * 0.12;
    finalColor *= vignette;

    FragColor = vec4(finalColor, 1.0);
}
