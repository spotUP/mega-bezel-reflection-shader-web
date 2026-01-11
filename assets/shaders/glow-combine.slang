#version 450

/*
   Glow Combine + Frame Shader
   Combines CRT pass with blur/glow and adds simple frame
   Used as final pass in simplified shader pipeline
*/

#pragma name GlowCombineFrame

layout(push_constant) uniform Push
{
    vec4 SourceSize;
    vec4 OriginalSize;
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

// Source is the diffused blur pass output (BR_MirrorReflectionDiffusedPass)
layout(set = 0, binding = 2) uniform sampler2D Source;
// PostCRTPass is the CRT output (for sharp game image)
layout(set = 0, binding = 3) uniform sampler2D PostCRTPass;
// Blurred pass for intermediate glow
layout(set = 0, binding = 4) uniform sampler2D BR_MirrorBlurredPass;

// Frame parameters - matches simple-frame.slang
const float border = 0.08;
const float outer_border = 0.05;
const vec3 frame_color = vec3(0.15, 0.15, 0.18);
const vec3 frame_highlight = vec3(0.25, 0.25, 0.28);
const vec3 background_color = vec3(0.08, 0.08, 0.1);

// Glow parameters
const float glow_strength = 0.2;

void main()
{
    vec2 uv = vTexCoord;
    vec2 centered = uv - 0.5;

    // Define content area
    float content_start = border;
    float content_end = 1.0 - border;
    float content_size = content_end - content_start;

    // Check regions
    bool in_outer = (uv.x < outer_border || uv.x > (1.0 - outer_border) ||
                     uv.y < outer_border || uv.y > (1.0 - outer_border));

    bool in_border = !in_outer && (uv.x < border || uv.x > (1.0 - border) ||
                                   uv.y < border || uv.y > (1.0 - border));

    if (in_outer)
    {
        // Outer dark background with subtle glow reflection
        float bg_fade = length(centered) * 0.5;
        vec3 bg = background_color * (1.0 - bg_fade * 0.3);

        // Sample diffused blur and add subtle reflection to outer area
        vec3 diffused_glow = texture(Source, uv).rgb;
        vec3 blur_glow = texture(BR_MirrorBlurredPass, uv).rgb;
        bg += (diffused_glow * 0.5 + blur_glow * 0.3) * glow_strength * 0.4;

        FragColor = vec4(bg, 1.0);
    }
    else if (in_border)
    {
        // Frame/bezel area with layered glow reflection
        float dist_from_edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float frame_shade = smoothstep(outer_border, border, dist_from_edge);
        vec3 bezel = mix(frame_color, frame_highlight, frame_shade);

        // Add layered glow to bezel for reflection effect
        vec3 diffused_glow = texture(Source, uv).rgb;
        vec3 blur_glow = texture(BR_MirrorBlurredPass, uv).rgb;
        bezel += (diffused_glow * 0.6 + blur_glow * 0.4) * glow_strength * 0.6;

        FragColor = vec4(bezel, 1.0);
    }
    else
    {
        // Game content area - remap UV to sample full texture
        vec2 content_uv = (uv - content_start) / content_size;

        // Sample CRT output (sharp)
        vec3 crt_color = texture(PostCRTPass, content_uv).rgb;

        // Sample blurs for bloom effect
        vec3 blur_glow = texture(BR_MirrorBlurredPass, content_uv).rgb;
        vec3 diffused_glow = texture(Source, content_uv).rgb;

        // Combine CRT with layered bloom
        vec3 final_color = crt_color + (blur_glow * 0.7 + diffused_glow * 0.3) * glow_strength;

        // Subtle vignette
        vec2 content_centered = content_uv - 0.5;
        float vignette = 1.0 - length(content_centered) * 0.25;

        FragColor = vec4(final_color * vignette, 1.0);
    }
}
