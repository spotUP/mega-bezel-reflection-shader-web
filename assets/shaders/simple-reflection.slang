#version 450

/*
   CRT Bezel with Reflection - Mega Bezel style
   Curved screen, thick bezel, corner shadows, carbon fiber background
*/

#pragma name SimpleReflection

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
layout(set = 0, binding = 2) uniform sampler2D Source;           // Fullscreen glow
layout(set = 0, binding = 3) uniform sampler2D DiffusedPass;     // Diffused glow
layout(set = 0, binding = 4) uniform sampler2D ReflectBlur;      // Light blur
layout(set = 0, binding = 5) uniform sampler2D ChromaPass;       // Sharp screen

// Procedural carbon fiber pattern
vec3 carbonFiber(vec2 uv)
{
    // Scale for carbon fiber weave
    vec2 p = uv * 80.0;

    // Create diagonal weave pattern
    float weave1 = sin(p.x + p.y) * sin(p.x - p.y);
    float weave2 = sin(p.x * 0.5) * sin(p.y * 0.5);

    // Combine for carbon fiber look
    float pattern = weave1 * 0.3 + weave2 * 0.2 + 0.5;
    pattern = pattern * 0.15 + 0.02; // Dark carbon fiber

    // Add slight color variation
    vec3 color = vec3(pattern) * vec3(1.0, 1.0, 1.05);

    return color;
}

// Barrel distortion for curved CRT
vec2 curveScreen(vec2 uv, float curvature)
{
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc) * curvature;
    return uv + cc * dist;
}

void main()
{
    // Screen geometry - tuned for good balance
    float SCREEN_SCALE = 0.78;        // Larger screen, less bezel
    float SCREEN_CURVE = 0.05;        // Subtle CRT curvature
    float CORNER_RADIUS = 0.025;      // Rounded screen corners
    float BEZEL_THICKNESS = 0.06;     // Bezel frame width

    // Bezel colors (dark matte plastic)
    vec3 BEZEL_OUTER = vec3(0.02, 0.02, 0.02);
    vec3 BEZEL_INNER = vec3(0.04, 0.04, 0.045);
    vec3 BEZEL_EDGE = vec3(0.08, 0.08, 0.085);

    // Reflection settings
    float REFLECTION_STRENGTH = 0.25;

    vec2 center = vec2(0.5);
    vec2 fromCenter = vTexCoord - center;
    float aspect = params.OutputSize.x / params.OutputSize.y;

    // Aspect-corrected coordinates
    vec2 aspectCoord = fromCenter;
    aspectCoord.x *= aspect;

    // Screen bounds with aspect correction
    vec2 screenHalfSize = vec2(SCREEN_SCALE * 0.5 * aspect, SCREEN_SCALE * 0.5);

    // For a square game, we want square screen
    float minHalf = min(screenHalfSize.x, screenHalfSize.y);
    screenHalfSize = vec2(minHalf, minHalf);

    // Screen coordinate (normalized to screen space)
    vec2 screenCoord = fromCenter / screenHalfSize;
    vec2 absCoord = abs(screenCoord);

    // Rounded rectangle SDF
    vec2 cornerDist = absCoord - vec2(1.0 - CORNER_RADIUS);
    float sdf = length(max(cornerDist, 0.0)) + min(max(cornerDist.x, cornerDist.y), 0.0) - CORNER_RADIUS;

    // Screen UV with curvature
    vec2 screenUV = screenCoord * 0.5 + 0.5;
    vec2 curvedUV = curveScreen(screenUV, SCREEN_CURVE);

    bool inScreen = sdf < 0.0;

    if (inScreen && curvedUV.x > 0.0 && curvedUV.x < 1.0 && curvedUV.y > 0.0 && curvedUV.y < 1.0)
    {
        // Inside screen - sample sharp screen with curvature
        vec3 color = texture(ChromaPass, curvedUV).rgb;

        // Edge darkening (CRT tube shadow)
        float edgeDark = 1.0 - pow(length(screenCoord) * 0.65, 2.0) * 0.2;
        edgeDark = max(edgeDark, 0.75);

        // Corner shadow
        float cornerShadow = 1.0 - pow(max(absCoord.x, absCoord.y), 3.0) * 0.15;
        cornerShadow = max(cornerShadow, 0.8);

        color *= edgeDark * cornerShadow;

        FragColor = vec4(color, 1.0);
    }
    else
    {
        // === BEZEL/FRAME AREA ===
        float distFromScreen = max(sdf, 0.0);
        float normalizedDist = clamp(distFromScreen / BEZEL_THICKNESS, 0.0, 1.0);

        // Inner edge highlight
        float innerEdge = 1.0 - smoothstep(0.0, 0.015, distFromScreen);

        // Bezel gradient (bright inner edge, dark outside)
        vec3 bezel;
        if (normalizedDist < 0.15) {
            bezel = mix(BEZEL_EDGE, BEZEL_INNER, normalizedDist / 0.15);
        } else if (normalizedDist < 0.6) {
            bezel = mix(BEZEL_INNER, BEZEL_OUTER, (normalizedDist - 0.15) / 0.45);
        } else {
            bezel = BEZEL_OUTER;
        }

        // Add inner edge highlight
        bezel += vec3(innerEdge * 0.15);

        // === CORNER DARKENING ===
        vec2 cornerPos = abs(vTexCoord - 0.5);
        float cornerDist2 = max(cornerPos.x, cornerPos.y);
        float cornerDark = 1.0 - smoothstep(0.35, 0.50, cornerDist2);
        cornerDark = cornerDark * 0.5 + 0.5;
        bezel *= cornerDark;

        // === CARBON FIBER BACKGROUND ===
        vec3 carbon = carbonFiber(vTexCoord);
        float carbonBlend = smoothstep(0.03, 0.10, distFromScreen);
        bezel = mix(bezel, carbon, carbonBlend * 0.75);

        // === REFLECTIONS ===
        vec2 reflectUV = screenUV;
        reflectUV = clamp(reflectUV, 0.01, 0.99);

        // Use multiple blur levels for rich reflection
        vec3 sharpReflect = texture(ReflectBlur, reflectUV).rgb;
        vec3 diffuseReflect = texture(DiffusedPass, reflectUV).rgb;
        vec3 glowReflect = texture(Source, reflectUV).rgb;

        // Layer reflections with distance-based falloff
        float sharpFade = exp(-distFromScreen * 15.0) * REFLECTION_STRENGTH;
        float diffuseFade = exp(-distFromScreen * 8.0) * REFLECTION_STRENGTH * 0.6;
        float glowFade = exp(-distFromScreen * 4.0) * REFLECTION_STRENGTH * 0.3;

        bezel += sharpReflect * sharpFade * cornerDark;
        bezel += diffuseReflect * diffuseFade * cornerDark;
        bezel += glowReflect * glowFade * cornerDark;

        // Outer vignette
        float outerDist = length(vTexCoord - 0.5);
        float outerVig = 1.0 - smoothstep(0.50, 0.72, outerDist);
        bezel *= outerVig;

        FragColor = vec4(bezel, 1.0);
    }
}
