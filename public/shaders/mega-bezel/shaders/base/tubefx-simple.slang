#version 450

/*
   Simplified Tube Effects Pass for WebGL2
   Directly samples tube textures and outputs in simplified format
   for the deconvergence shader to blend with CRT output.

   Output format:
   - RGB = tube diffuse texture color (brownish CRT tube frame)
   - A = highlight brightness (glass reflection overlay)
*/

#pragma name TubeFxPass
#pragma format R32G32B32A32_SFLOAT

layout(std140, set = 0, binding = 0) uniform UBO
{
    mat4 MVP;
    vec4 SourceSize;
    vec4 OriginalSize;
    vec4 OutputSize;
    uint FrameCount;
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

// Input textures - must use layout(set, binding) for shader compiler to extract them
layout(set = 0, binding = 2) uniform sampler2D Source;
layout(set = 0, binding = 3) uniform sampler2D TubeDiffuseImage;
layout(set = 0, binding = 4) uniform sampler2D TubeShadowImage;
layout(set = 0, binding = 5) uniform sampler2D TubeColoredGelImage;
layout(set = 0, binding = 6) uniform sampler2D TubeStaticReflectionImage;

void main()
{
    // Sample tube diffuse texture (brownish CRT tube frame texture)
    vec4 tube_diffuse = texture(TubeDiffuseImage, vTexCoord);

    // Sample tube static reflection texture (glass highlight overlay)
    vec4 tube_highlight = texture(TubeStaticReflectionImage, vTexCoord);

    // Output format for deconvergence shader:
    // RGB = tube diffuse texture color
    // A = highlight brightness (average of highlight RGB)
    float highlight_brightness = (tube_highlight.r + tube_highlight.g + tube_highlight.b) / 3.0;
    FragColor = vec4(tube_diffuse.rgb, highlight_brightness);
}
