#version 450

// Gaussian blur 9x9 for Mega Bezel reflection system
// Based on libretro royale blur shader

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OutputSize;
} params;

layout(std140, set = 0, binding = 0) uniform UBO {
    mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main() {
    gl_Position = global.MVP * Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;

// Gaussian weights as individual constants (more WebGL compatible)
#define W0 0.227027
#define W1 0.1945946
#define W2 0.1216216
#define W3 0.054054
#define W4 0.016216

void main() {
    vec2 tex_offset = 1.0 / params.SourceSize.xy;
    vec3 result = texture(Source, vTexCoord).rgb * W0;

    // Horizontal blur
    result += texture(Source, vTexCoord + vec2(tex_offset.x * 1.0, 0.0)).rgb * W1;
    result += texture(Source, vTexCoord - vec2(tex_offset.x * 1.0, 0.0)).rgb * W1;
    result += texture(Source, vTexCoord + vec2(tex_offset.x * 2.0, 0.0)).rgb * W2;
    result += texture(Source, vTexCoord - vec2(tex_offset.x * 2.0, 0.0)).rgb * W2;
    result += texture(Source, vTexCoord + vec2(tex_offset.x * 3.0, 0.0)).rgb * W3;
    result += texture(Source, vTexCoord - vec2(tex_offset.x * 3.0, 0.0)).rgb * W3;
    result += texture(Source, vTexCoord + vec2(tex_offset.x * 4.0, 0.0)).rgb * W4;
    result += texture(Source, vTexCoord - vec2(tex_offset.x * 4.0, 0.0)).rgb * W4;

    // Vertical blur
    vec3 vResult = result * W0;
    vResult += texture(Source, vTexCoord + vec2(0.0, tex_offset.y * 1.0)).rgb * W1;
    vResult += texture(Source, vTexCoord - vec2(0.0, tex_offset.y * 1.0)).rgb * W1;
    vResult += texture(Source, vTexCoord + vec2(0.0, tex_offset.y * 2.0)).rgb * W2;
    vResult += texture(Source, vTexCoord - vec2(0.0, tex_offset.y * 2.0)).rgb * W2;
    vResult += texture(Source, vTexCoord + vec2(0.0, tex_offset.y * 3.0)).rgb * W3;
    vResult += texture(Source, vTexCoord - vec2(0.0, tex_offset.y * 3.0)).rgb * W3;
    vResult += texture(Source, vTexCoord + vec2(0.0, tex_offset.y * 4.0)).rgb * W4;
    vResult += texture(Source, vTexCoord - vec2(0.0, tex_offset.y * 4.0)).rgb * W4;

    // Mix horizontal and vertical
    FragColor = vec4(mix(result, vResult, 0.5), 1.0);
}
