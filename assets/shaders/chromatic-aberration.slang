#version 450

/*
   Chromatic Aberration - RGB color fringing effect
   Simulates imperfect CRT electron gun alignment
*/

#pragma name ChromaticAberration

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
    // Subtle chromatic aberration for CRT look
    float ABERRATION = 0.0015;  // Very subtle

    // Calculate offset based on distance from center (stronger at edges)
    vec2 fromCenter = vTexCoord - 0.5;
    float dist = length(fromCenter);
    vec2 dir = normalize(fromCenter + 0.0001);

    // Offset increases towards edges
    vec2 offset = dir * ABERRATION * dist;

    // Sample each color channel at slightly different positions
    float r = texture(Source, vTexCoord + offset).r;
    float g = texture(Source, vTexCoord).g;
    float b = texture(Source, vTexCoord - offset).b;

    FragColor = vec4(r, g, b, 1.0);
}
