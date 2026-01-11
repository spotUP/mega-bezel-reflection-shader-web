#version 450

/*
   Fast Sharpen - Enhances edges before CRT processing
   Based on Mega Bezel's custom-fast-sharpen
*/

#pragma name Sharpen

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
    // Sharpening for crisp pixels
    float SHARPEN_STRENGTH = 0.35;  // Noticeable sharpening
    float SHARPEN_CLAMP = 0.1;      // Allow more sharpening

    vec2 texel = params.SourceSize.zw;

    // Sample center and neighbors
    vec3 center = texture(Source, vTexCoord).rgb;
    vec3 left   = texture(Source, vTexCoord - vec2(texel.x, 0.0)).rgb;
    vec3 right  = texture(Source, vTexCoord + vec2(texel.x, 0.0)).rgb;
    vec3 top    = texture(Source, vTexCoord - vec2(0.0, texel.y)).rgb;
    vec3 bottom = texture(Source, vTexCoord + vec2(0.0, texel.y)).rgb;

    // Calculate edge (high-pass filter)
    vec3 edge = center * 4.0 - left - right - top - bottom;

    // Clamp the sharpening to avoid excessive halos
    edge = clamp(edge, -SHARPEN_CLAMP, SHARPEN_CLAMP);

    // Apply sharpening
    vec3 color = center + edge * SHARPEN_STRENGTH;

    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);

    FragColor = vec4(color, 1.0);
}
