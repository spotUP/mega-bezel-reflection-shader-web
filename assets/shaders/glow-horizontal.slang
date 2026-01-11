#version 450

/*
   Horizontal Gaussian Blur for Glow Effect
*/

#pragma name GlowH

layout(push_constant) uniform Push
{
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
    float glow_radius;
} params;

#pragma parameter glow_radius "Glow Radius" 4.0 1.0 12.0 1.0

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

    // 9-tap gaussian blur horizontal - unrolled to avoid int/float comparison issues
    float w0 = 0.227027;
    float w1 = 0.1945946;
    float w2 = 0.1216216;
    float w3 = 0.054054;
    float w4 = 0.016216;

    float RADIUS = 4.0; // Hardcoded glow radius

    color += texture(Source, vTexCoord).rgb * w0;
    total += w0;

    // Sample 1
    float offset1 = 1.0 * RADIUS * 0.5;
    color += texture(Source, vTexCoord + vec2(texel.x * offset1, 0.0)).rgb * w1;
    color += texture(Source, vTexCoord - vec2(texel.x * offset1, 0.0)).rgb * w1;
    total += w1 * 2.0;

    // Sample 2
    float offset2 = 2.0 * RADIUS * 0.5;
    color += texture(Source, vTexCoord + vec2(texel.x * offset2, 0.0)).rgb * w2;
    color += texture(Source, vTexCoord - vec2(texel.x * offset2, 0.0)).rgb * w2;
    total += w2 * 2.0;

    // Sample 3
    float offset3 = 3.0 * RADIUS * 0.5;
    color += texture(Source, vTexCoord + vec2(texel.x * offset3, 0.0)).rgb * w3;
    color += texture(Source, vTexCoord - vec2(texel.x * offset3, 0.0)).rgb * w3;
    total += w3 * 2.0;

    // Sample 4
    float offset4 = 4.0 * RADIUS * 0.5;
    color += texture(Source, vTexCoord + vec2(texel.x * offset4, 0.0)).rgb * w4;
    color += texture(Source, vTexCoord - vec2(texel.x * offset4, 0.0)).rgb * w4;
    total += w4 * 2.0;

    FragColor = vec4(color / total, 1.0);
}
