#version 450

/*
   Reflection Blur Horizontal - Blurs screen content for bezel reflection
   Stronger blur than glow passes for softer reflection
*/

#pragma name ReflectionBlurH

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

    // Wider blur for reflection (13-tap)
    float RADIUS = 8.0;

    // Gaussian weights
    float w0 = 0.20;
    float w1 = 0.17;
    float w2 = 0.13;
    float w3 = 0.09;
    float w4 = 0.05;
    float w5 = 0.025;
    float w6 = 0.01;

    color += texture(Source, vTexCoord).rgb * w0;
    total += w0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS * 0.15, 0.0)).rgb * w1;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS * 0.15, 0.0)).rgb * w1;
    total += w1 * 2.0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS * 0.35, 0.0)).rgb * w2;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS * 0.35, 0.0)).rgb * w2;
    total += w2 * 2.0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS * 0.55, 0.0)).rgb * w3;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS * 0.55, 0.0)).rgb * w3;
    total += w3 * 2.0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS * 0.75, 0.0)).rgb * w4;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS * 0.75, 0.0)).rgb * w4;
    total += w4 * 2.0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS * 0.9, 0.0)).rgb * w5;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS * 0.9, 0.0)).rgb * w5;
    total += w5 * 2.0;

    color += texture(Source, vTexCoord + vec2(texel.x * RADIUS, 0.0)).rgb * w6;
    color += texture(Source, vTexCoord - vec2(texel.x * RADIUS, 0.0)).rgb * w6;
    total += w6 * 2.0;

    FragColor = vec4(color / total, 1.0);
}
