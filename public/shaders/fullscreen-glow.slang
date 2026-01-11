#version 450

/*
   Fullscreen Glow - Maximum blur for ambient light spill
   Creates soft colored glow that spreads far from screen
*/

#pragma name FullscreenGlow

layout(push_constant) uniform Push
{
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
} params;

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

void main()
{
    vec2 texel = params.SourceSize.zw;
    vec3 color = vec3(0.0);
    float total = 0.0;

    // Massive blur - sparse sampling (unrolled to avoid int/float issues)
    float RADIUS = 24.0;

    // Simplified 3x3 very wide sampling for maximum blur
    float w0 = 0.1;
    float w1 = 0.25;
    float w2 = 0.1;

    float o0 = -1.0;
    float o1 = 0.0;
    float o2 = 1.0;

    // 3x3 grid sampling with large radius
    // Row 0
    color += texture(Source, vTexCoord + vec2(o0, o0) * RADIUS * texel).rgb * w0 * w0; total += w0 * w0;
    color += texture(Source, vTexCoord + vec2(o1, o0) * RADIUS * texel).rgb * w1 * w0; total += w1 * w0;
    color += texture(Source, vTexCoord + vec2(o2, o0) * RADIUS * texel).rgb * w2 * w0; total += w2 * w0;

    // Row 1
    color += texture(Source, vTexCoord + vec2(o0, o1) * RADIUS * texel).rgb * w0 * w1; total += w0 * w1;
    color += texture(Source, vTexCoord + vec2(o1, o1) * RADIUS * texel).rgb * w1 * w1; total += w1 * w1;
    color += texture(Source, vTexCoord + vec2(o2, o1) * RADIUS * texel).rgb * w2 * w1; total += w2 * w1;

    // Row 2
    color += texture(Source, vTexCoord + vec2(o0, o2) * RADIUS * texel).rgb * w0 * w2; total += w0 * w2;
    color += texture(Source, vTexCoord + vec2(o1, o2) * RADIUS * texel).rgb * w1 * w2; total += w1 * w2;
    color += texture(Source, vTexCoord + vec2(o2, o2) * RADIUS * texel).rgb * w2 * w2; total += w2 * w2;

    // Normalize without boosting (was causing purple artifacts)
    color = color / total;

    FragColor = vec4(color, 1.0);
}
