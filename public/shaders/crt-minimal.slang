#version 450

/*
   Minimal CRT Shader - Single pass scanlines and curvature
   Designed to work standalone without complex dependencies
*/

#pragma name CRTMinimal

layout(push_constant) uniform Push
{
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
    float curvature;
    float scanline_weight;
    float scanline_gap_brightness;
    float bloom_amount;
    float mask_strength;
} params;

#pragma parameter curvature "Curvature" 0.15 0.0 0.5 0.01
#pragma parameter scanline_weight "Scanline Weight" 0.3 0.0 1.0 0.05
#pragma parameter scanline_gap_brightness "Scanline Gap Brightness" 0.12 0.0 1.0 0.02
#pragma parameter bloom_amount "Bloom Amount" 0.05 0.0 0.5 0.01
#pragma parameter mask_strength "Shadow Mask Strength" 0.3 0.0 1.0 0.05

layout(std140, set = 0, binding = 0) uniform UBO
{
    mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main()
{
    gl_Position = global.MVP * Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;

// Apply barrel distortion for CRT curvature
vec2 CRTCurve(vec2 uv, float curvature)
{
    // Convert to -1 to 1 range
    vec2 coord = uv * 2.0 - 1.0;

    // Calculate distance from center
    float r2 = dot(coord, coord);

    // Apply barrel distortion - stronger formula
    coord *= 1.0 + r2 * curvature;

    // Convert back to 0-1 range
    return coord * 0.5 + 0.5;
}

// Simple scanline effect
float Scanline(float y, float weight)
{
    float scanline = sin(y * params.SourceSize.y * 3.14159);
    return 1.0 - weight * (1.0 - abs(scanline));
}

// Slot mask - less moiré than aperture grille
vec3 SlotMask(vec2 pos, float strength)
{
    // Use lower frequency to reduce moiré
    float maskScale = 6.0; // Larger = less moiré

    // Slot mask pattern (alternating RGB columns with vertical offset)
    float col = mod(floor(pos.x / maskScale), 3.0);
    float row = mod(floor(pos.y / (maskScale * 0.5)), 2.0);

    // Offset columns on alternating rows
    if (row > 0.5) {
        col = mod(col + 1.5, 3.0);
    }

    // Smooth transitions to reduce aliasing
    float maskR = smoothstep(0.0, 1.0, 1.0 - abs(col - 0.0));
    float maskG = smoothstep(0.0, 1.0, 1.0 - abs(col - 1.0));
    float maskB = smoothstep(0.0, 1.0, 1.0 - abs(col - 2.0));

    // Blend between mask and white based on strength
    vec3 mask = vec3(maskR, maskG, maskB);
    mask = mix(vec3(1.0), mask * 0.8 + 0.2, strength);

    return mask;
}

void main()
{
    // Sample the source
    vec3 color = texture(Source, vTexCoord).rgb;

    // Subtle scanline effect based on source pixel position
    float scanlineFreq = params.SourceSize.y * 2.0;
    float scanline = 0.92 + 0.08 * sin(vTexCoord.y * scanlineFreq * 3.14159);
    color *= scanline;

    // Subtle vignette
    vec2 vignetteCoord = vTexCoord - 0.5;
    float vignetteDist = length(vignetteCoord);
    float vignette = 1.0 - vignetteDist * vignetteDist * 0.3;
    vignette = clamp(vignette, 0.7, 1.0);
    color *= vignette;

    FragColor = vec4(color, 1.0);
}
