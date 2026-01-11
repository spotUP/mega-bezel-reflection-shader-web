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
layout(set = 0, binding = 3) uniform sampler2D DerezedPass;

void main() {
    vec2 uv = vTexCoord;

    // 1. CRT Barrel Distortion (subtle)
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc);
    uv = uv + cc * dist * 0.15; // Reduced curvature

    // Check bounds after curvature
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // 2. Sample game texture - preserve original colors
    vec3 col = texture(DerezedPass, uv).rgb;

    // 3. Scanlines - subtle horizontal lines only
    float scanlineCount = 200.0;
    float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
    scanline = pow(scanline, 1.5) * 0.15; // Very subtle
    col *= 1.0 - scanline;

    // 4. NO RGB mask - removed to prevent vertical bars

    // 5. Subtle vignette
    float vignette = 1.0 - dot(cc, cc) * 0.3;
    col *= vignette;

    // 6. Output with minimal gamma adjustment
    FragColor = vec4(col, 1.0);
}
