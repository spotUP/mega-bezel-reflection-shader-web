#version 450

/*
   Bloom Combine - Adds glow on top of original image
*/

#pragma name BloomCombine

layout(push_constant) uniform Push
{
    vec4 SourceSize;
    vec4 OriginalSize;
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
layout(set = 0, binding = 3) uniform sampler2D Original;

void main()
{
    // Bloom for CRT glow effect
    float BLOOM_STRENGTH = 0.2;    // Noticeable glow
    float BLOOM_SATURATION = 1.1;  // Slightly boost saturation

    // Get original sharp image
    vec3 original = texture(Original, vTexCoord).rgb;

    // Get blurred glow from previous passes
    vec3 glow = texture(Source, vTexCoord).rgb;

    // Additive bloom - glow adds light on top of original
    vec3 color = original + glow * BLOOM_STRENGTH;

    // Slight saturation boost for vibrant colors
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, BLOOM_SATURATION);

    FragColor = vec4(color, 1.0);
}
