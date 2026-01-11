#version 450

/*
   Simple Frame/Bezel Shader
   Draws a simple CRT-style frame around the game content
   No complex dependencies - just adds visual frame effect
*/

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
layout(set = 0, binding = 2) uniform sampler2D Source;

// Frame parameters
const float screen_scale = 0.85;          // How much of viewport the screen takes (0.85 = 85%)
const float frame_thickness = 0.03;       // Thickness of the bezel frame
const float frame_roundness = 0.02;       // Corner roundness
const vec3 frame_color = vec3(0.15, 0.15, 0.18);  // Dark gray frame
const vec3 frame_highlight = vec3(0.25, 0.25, 0.28);  // Lighter edge highlight
const vec3 background_color = vec3(0.08, 0.08, 0.1);  // Dark background

// Signed distance to rounded rectangle
float roundedBoxSDF(vec2 p, vec2 size, float radius)
{
    vec2 q = abs(p) - size + radius;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main()
{
    vec2 uv = vTexCoord;

    // Center coordinates (-0.5 to 0.5)
    vec2 centered = uv - 0.5;

    // Frame border size (percentage of screen)
    float border = 0.08;
    float outer_border = 0.05;

    // Inner content area bounds
    float content_start = border;
    float content_end = 1.0 - border;
    float content_size = content_end - content_start;

    // Check if we're in the outer background area
    bool in_outer = (uv.x < outer_border || uv.x > (1.0 - outer_border) ||
                     uv.y < outer_border || uv.y > (1.0 - outer_border));

    // Check if we're in the border area (between outer and content)
    bool in_border = !in_outer && (uv.x < border || uv.x > (1.0 - border) ||
                                   uv.y < border || uv.y > (1.0 - border));

    if (in_outer)
    {
        // Outer dark background
        float bg_fade = length(centered) * 0.5;
        vec3 bg = background_color * (1.0 - bg_fade * 0.3);
        FragColor = vec4(bg, 1.0);
    }
    else if (in_border)
    {
        // Frame/bezel area
        float dist_from_edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float frame_shade = smoothstep(outer_border, border, dist_from_edge);
        vec3 bezel = mix(frame_color, frame_highlight, frame_shade);
        FragColor = vec4(bezel, 1.0);
    }
    else
    {
        // Game content area - remap UV to sample full texture
        vec2 content_uv = (uv - content_start) / content_size;
        vec4 game_color = texture(Source, content_uv);

        // Apply subtle vignette within content area
        vec2 content_centered = content_uv - 0.5;
        float vignette = 1.0 - length(content_centered) * 0.3;
        FragColor = game_color * vignette;
    }
}
