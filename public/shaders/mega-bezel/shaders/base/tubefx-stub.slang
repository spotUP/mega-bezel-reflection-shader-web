#version 450

/*
    TubeFxPass Stub - Simple passthrough version

    This simplified version just passes through the source.
    The CRT shader will handle the output without tube effects.
*/

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

#pragma name TubeFxPass
// Removed R32G32B32A32_SFLOAT - causes WebGL2 issues

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
    // Must actually sample Source or GLSL compiler optimizes it away
    vec4 src = texture(Source, vTexCoord);

    // Output zeros - the deconvergence shader will detect this and skip tube layers
    // Use src.a * 0.0 to keep the sampler from being optimized away
    FragColor = vec4(0.0, 0.0, 0.0, src.a * 0.0);
}
