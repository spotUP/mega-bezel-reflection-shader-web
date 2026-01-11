#version 450

// Simple bezel shader - just composites background frame over the game
#pragma format R8G8B8A8_UNORM

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

layout(set = 0, binding = 2) uniform sampler2D Source;          // The game
layout(set = 0, binding = 3) uniform sampler2D BackgroundImage; // The frame

void main() {
    // Sample the game
    vec4 game = texture(Source, vTexCoord);

    // Sample the frame/background
    vec4 frame = texture(BackgroundImage, vTexCoord);

    // Create a simple composite:
    // - Show frame in border areas
    // - Show game in center area (roughly 70% of screen)
    vec2 center = vTexCoord - 0.5;
    float dist = length(center);

    // Simple mixing: game in center, frame on edges
    float gameArea = smoothstep(0.42, 0.38, dist);

    // Composite: blend game and frame
    FragColor = mix(frame, game, gameArea);

    // Add slight vignette for CRT effect
    float vignette = 1.0 - (dist * dist * 0.5);
    FragColor.rgb *= vignette;
}
