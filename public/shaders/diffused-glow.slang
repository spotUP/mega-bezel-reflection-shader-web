#version 450

/*
   Diffused Glow - Heavy blur for mid-range reflection glow
   Downscales and blurs significantly for soft ambient glow
*/

#pragma name DiffusedGlow

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

    // Wide 2D blur - 5x5 sample grid (unrolled to avoid int/float issues)
    float RADIUS = 12.0;

    // Weights for 5-tap gaussian
    float w0 = 0.06;
    float w1 = 0.15;
    float w2 = 0.22;
    float w3 = 0.15;
    float w4 = 0.06;

    // Offsets
    float o0 = -2.0;
    float o1 = -1.0;
    float o2 = 0.0;
    float o3 = 1.0;
    float o4 = 2.0;

    // Row 0 (y = -2)
    color += texture(Source, vTexCoord + vec2(o0, o0) * RADIUS * texel).rgb * w0 * w0; total += w0 * w0;
    color += texture(Source, vTexCoord + vec2(o1, o0) * RADIUS * texel).rgb * w1 * w0; total += w1 * w0;
    color += texture(Source, vTexCoord + vec2(o2, o0) * RADIUS * texel).rgb * w2 * w0; total += w2 * w0;
    color += texture(Source, vTexCoord + vec2(o3, o0) * RADIUS * texel).rgb * w3 * w0; total += w3 * w0;
    color += texture(Source, vTexCoord + vec2(o4, o0) * RADIUS * texel).rgb * w4 * w0; total += w4 * w0;

    // Row 1 (y = -1)
    color += texture(Source, vTexCoord + vec2(o0, o1) * RADIUS * texel).rgb * w0 * w1; total += w0 * w1;
    color += texture(Source, vTexCoord + vec2(o1, o1) * RADIUS * texel).rgb * w1 * w1; total += w1 * w1;
    color += texture(Source, vTexCoord + vec2(o2, o1) * RADIUS * texel).rgb * w2 * w1; total += w2 * w1;
    color += texture(Source, vTexCoord + vec2(o3, o1) * RADIUS * texel).rgb * w3 * w1; total += w3 * w1;
    color += texture(Source, vTexCoord + vec2(o4, o1) * RADIUS * texel).rgb * w4 * w1; total += w4 * w1;

    // Row 2 (y = 0)
    color += texture(Source, vTexCoord + vec2(o0, o2) * RADIUS * texel).rgb * w0 * w2; total += w0 * w2;
    color += texture(Source, vTexCoord + vec2(o1, o2) * RADIUS * texel).rgb * w1 * w2; total += w1 * w2;
    color += texture(Source, vTexCoord + vec2(o2, o2) * RADIUS * texel).rgb * w2 * w2; total += w2 * w2;
    color += texture(Source, vTexCoord + vec2(o3, o2) * RADIUS * texel).rgb * w3 * w2; total += w3 * w2;
    color += texture(Source, vTexCoord + vec2(o4, o2) * RADIUS * texel).rgb * w4 * w2; total += w4 * w2;

    // Row 3 (y = 1)
    color += texture(Source, vTexCoord + vec2(o0, o3) * RADIUS * texel).rgb * w0 * w3; total += w0 * w3;
    color += texture(Source, vTexCoord + vec2(o1, o3) * RADIUS * texel).rgb * w1 * w3; total += w1 * w3;
    color += texture(Source, vTexCoord + vec2(o2, o3) * RADIUS * texel).rgb * w2 * w3; total += w2 * w3;
    color += texture(Source, vTexCoord + vec2(o3, o3) * RADIUS * texel).rgb * w3 * w3; total += w3 * w3;
    color += texture(Source, vTexCoord + vec2(o4, o3) * RADIUS * texel).rgb * w4 * w3; total += w4 * w3;

    // Row 4 (y = 2)
    color += texture(Source, vTexCoord + vec2(o0, o4) * RADIUS * texel).rgb * w0 * w4; total += w0 * w4;
    color += texture(Source, vTexCoord + vec2(o1, o4) * RADIUS * texel).rgb * w1 * w4; total += w1 * w4;
    color += texture(Source, vTexCoord + vec2(o2, o4) * RADIUS * texel).rgb * w2 * w4; total += w2 * w4;
    color += texture(Source, vTexCoord + vec2(o3, o4) * RADIUS * texel).rgb * w3 * w4; total += w3 * w4;
    color += texture(Source, vTexCoord + vec2(o4, o4) * RADIUS * texel).rgb * w4 * w4; total += w4 * w4;

    FragColor = vec4(color / total, 1.0);
}
