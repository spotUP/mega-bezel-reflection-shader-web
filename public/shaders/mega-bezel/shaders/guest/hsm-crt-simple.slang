#version 450

/*
   Simple CRT Shader for WebGL2
   Adds basic scanlines and slight curvature effect
   Without complex HSM dependencies
*/

layout(std140, set = 0, binding = 0) uniform UBO
{
    mat4 MVP;
    vec4 SourceSize;
    vec4 OriginalSize;
    vec4 OutputSize;
    uint FrameCount;
} global;

const float ScanlinePulse = 0.0;

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

// CRT parameters
const float scanline_base = 0.35;         // Base scanline darkening (0 = none, 1 = black lines)
const float scanline_pulse_boost = 0.25;  // Extra darkening when pulsing with beat
const float curvature = 0.35;             // Barrel distortion amount (strong CRT curve)
const float vignette_strength = 0.25;     // Corner darkening
const float brightness = 1.2;             // Brightness boost to compensate for effects
const float saturation = 1.1;             // Color saturation
const float bloom_strength = 0.1;         // Glow on bright areas
const float mask_strength = 0.12;         // Phosphor mask visibility

// Apply barrel distortion for CRT curvature
vec2 CRTCurve(vec2 uv)
{
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
    uv = uv + uv * offset * offset * curvature;
    uv = uv * 0.5 + 0.5;
    return uv;
}

// Scanline effect - alternating dark lines every 2 pixels
// Pulses with the music beat via ScanlinePulse uniform
float Scanline(float fragY)
{
    // Create scanlines every 2 pixels (alternating bright/dark bands)
    float line = mod(floor(fragY), 2.0);
    // Combine base strength with dynamic pulse boost
    float strength = scanline_base + scanline_pulse_boost * ScanlinePulse;
    return 1.0 - strength * line;
}

// Simple bloom - adds glow to bright areas
vec3 Bloom(sampler2D tex, vec2 uv, vec2 texelSize)
{
    vec3 bloom = vec3(0.0);
    float total = 0.0;

    // Sample in a cross pattern for simple bloom
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            float weight = 1.0 / (1.0 + abs(x) + abs(y));
            bloom += texture(tex, uv + vec2(x, y) * texelSize * 2.0).rgb * weight;
            total += weight;
        }
    }

    return bloom / total;
}

// Vignette effect
float Vignette(vec2 uv)
{
    uv = uv * 2.0 - 1.0;
    return 1.0 - vignette_strength * dot(uv, uv);
}

// Saturation adjustment
vec3 AdjustSaturation(vec3 color, float sat)
{
    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(grey), color, sat);
}

void main()
{
    // Apply CRT curvature
    vec2 curved_uv = CRTCurve(vTexCoord);

    // Check if we're outside the screen after curvature
    if (curved_uv.x < 0.0 || curved_uv.x > 1.0 || curved_uv.y < 0.0 || curved_uv.y > 1.0)
    {
        FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Calculate texel size for effects
    vec2 texelSize = 1.0 / global.SourceSize.xy;

    // Sample the source texture
    vec3 color = texture(Source, curved_uv).rgb;

    // Add subtle bloom for glow effect on bright areas
    vec3 bloomColor = Bloom(Source, curved_uv, texelSize);
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(color, color + bloomColor * bloom_strength, luminance);

    // Apply scanlines using gl_FragCoord.y for stable pixel-based effect
    color *= Scanline(gl_FragCoord.y);

    // Simple phosphor mask - RGB stripe pattern
    float maskX = mod(gl_FragCoord.x, 3.0);
    vec3 mask = vec3(1.0);
    if (maskX < 1.0) mask = vec3(1.0, 0.85, 0.85);
    else if (maskX < 2.0) mask = vec3(0.85, 1.0, 0.85);
    else mask = vec3(0.85, 0.85, 1.0);
    color *= mix(vec3(1.0), mask, mask_strength);

    // Apply vignette
    color *= Vignette(curved_uv);

    // Apply brightness and saturation
    color = AdjustSaturation(color, saturation) * brightness;

    // Slight warm color shift for CRT phosphor feel
    color.r *= 1.02;
    color.b *= 0.97;

    // Clamp to prevent over-bright pixels
    color = clamp(color, 0.0, 1.0);

    FragColor = vec4(color, 1.0);
}
