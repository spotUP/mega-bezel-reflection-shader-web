#version 450

// Simple frame overlay - just draws a border around the game
// This is a much simpler approach than the full Mega Bezel bezel system

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

void main() {
    // Get the game image
    vec4 gameColor = texture(Source, vTexCoord);

    // Define frame area (outer 10% of screen)
    float frameWidth = 0.10;
    bool isInFrame = vTexCoord.x < frameWidth || vTexCoord.x > (1.0 - frameWidth) ||
                     vTexCoord.y < frameWidth || vTexCoord.y > (1.0 - frameWidth);

    // Define inner game area
    float innerBorder = 0.12;
    bool isInGame = vTexCoord.x > innerBorder && vTexCoord.x < (1.0 - innerBorder) &&
                    vTexCoord.y > innerBorder && vTexCoord.y < (1.0 - innerBorder);

    if (isInFrame && !isInGame) {
        // Draw a dark gray frame with gradient
        float dist = min(min(vTexCoord.x, 1.0 - vTexCoord.x),
                        min(vTexCoord.y, 1.0 - vTexCoord.y));
        float gradient = smoothstep(0.0, frameWidth, dist);
        vec3 frameColor = vec3(0.15, 0.15, 0.18) * (0.5 + 0.5 * gradient);
        FragColor = vec4(frameColor, 1.0);
    } else if (isInGame) {
        // Show the game
        FragColor = gameColor;
    } else {
        // Transition area - blend
        FragColor = gameColor;
    }
}
