#version 450

#pragma name TestShader
#pragma parameter BRIGHTNESS "Brightness" 1.0 0.0 2.0 0.01

layout(push_constant) uniform Push {
    float BRIGHTNESS;
} params;

layout(set = 0, binding = 0) uniform sampler2D Source;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main() {
    gl_Position = Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

void main() {
    vec4 color = texture(Source, vTexCoord);
    FragColor = vec4(color.rgb * params.BRIGHTNESS, color.a);
}
