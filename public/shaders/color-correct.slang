#version 450

/*
   Color Correction - Gamma, brightness, contrast, saturation
*/

#pragma name ColorCorrect

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
    // Color correction for CRT look
    float GAMMA = 1.1;           // Slightly darker midtones
    float BRIGHTNESS = 1.05;     // Slight brightness boost
    float CONTRAST = 1.08;       // More contrast for CRT pop
    float SATURATION = 1.15;     // More saturated colors

    vec3 color = texture(Source, vTexCoord).rgb;

    // Apply gamma correction
    color = pow(color, vec3(GAMMA));

    // Apply brightness
    color *= BRIGHTNESS;

    // Apply contrast (around 0.5 midpoint)
    color = (color - 0.5) * CONTRAST + 0.5;

    // Apply saturation
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, SATURATION);

    // Clamp to valid range
    color = clamp(color, 0.0, 1.0);

    FragColor = vec4(color, 1.0);
}
