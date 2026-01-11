#version 450

layout(push_constant) uniform Push {
    vec4 SourceSize;
    vec4 OutputSize;
    uint FrameCount;
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

void main() {
    vec2 uv = vTexCoord;

    // EXTREME curvature for testing
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    uv = uv + cc * dist * 0.3; // Much stronger curvature

    // Check bounds
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        FragColor = vec4(1.0, 0.0, 0.0, 1.0); // RED borders to confirm shader is running
        return;
    }

    // Sample texture
    vec3 col = texture(Source, uv).rgb;

    // STRONG scanlines for testing
    float scanline = sin(uv.y * params.OutputSize.y * 3.14159 * 2.0) * 0.5; // Much stronger
    col *= 1.0 - scanline;

    // Strong vignette for testing
    float vignette = 1.0 - dot(cc, cc) * 1.5; // Much stronger
    col *= vignette;

    FragColor = vec4(col, 1.0);
}
