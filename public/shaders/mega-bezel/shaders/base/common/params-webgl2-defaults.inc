/*
    WebGL2 Default Parameters for Mega Bezel
    These parameters are not defined via #pragma in the shader files
    but are expected to exist as uniforms. Adding defaults here for WebGL2 compatibility.
*/

// Source matte types (from helper-functions.inc - may not be included)
#ifndef SOURCE_MATTE_PREMULTIPLIED
#define SOURCE_MATTE_PREMULTIPLIED 0.0
#endif
#ifndef SOURCE_MATTE_WHITE
#define SOURCE_MATTE_WHITE 1.0
#endif
#ifndef SOURCE_MATTE_NONE
#define SOURCE_MATTE_NONE 2.0
#endif

// Blend modes (from helper-functions.inc - may not be included)
#ifndef BLEND_MODE_OFF
#define BLEND_MODE_OFF 0.0
#endif
#ifndef BLEND_MODE_NORMAL
#define BLEND_MODE_NORMAL 1.0
#endif
#ifndef BLEND_MODE_ADD
#define BLEND_MODE_ADD 2.0
#endif
#ifndef BLEND_MODE_MULTIPLY
#define BLEND_MODE_MULTIPLY 3.0
#endif

// Default gamma values
#ifndef DEFAULT_SRGB_GAMMA
#define DEFAULT_SRGB_GAMMA 2.2
#endif
#ifndef DEFAULT_CRT_GAMMA
#define DEFAULT_CRT_GAMMA 2.4
#endif

// Nightlight parameters (used in tubefx.inc)
#ifndef HSM_NIGHTLIGHT1_OPACITY
#define HSM_NIGHTLIGHT1_OPACITY 0.0
#endif
#ifndef HSM_NIGHTLIGHT2_OPACITY
#define HSM_NIGHTLIGHT2_OPACITY 0.0
#endif
#ifndef HSM_LIGHT_NIGHTLIGHTING_SWAP_IMAGE_MODE
#define HSM_LIGHT_NIGHTLIGHTING_SWAP_IMAGE_MODE 0.0
#endif

// Tube shadow parameters
#ifndef HSM_TUBE_SHADOW_IMAGE_ON
#define HSM_TUBE_SHADOW_IMAGE_ON 0.0
#endif
#ifndef HSM_TUBE_SHADOW_IMAGE_OPACITY
#define HSM_TUBE_SHADOW_IMAGE_OPACITY 50.0
#endif
#ifndef HSM_TUBE_SHADOW_IMAGE_POS_X
#define HSM_TUBE_SHADOW_IMAGE_POS_X 0.0
#endif
#ifndef HSM_TUBE_SHADOW_IMAGE_POS_Y
#define HSM_TUBE_SHADOW_IMAGE_POS_Y 0.0
#endif
#ifndef HSM_TUBE_SHADOW_IMAGE_SCALE_X
#define HSM_TUBE_SHADOW_IMAGE_SCALE_X 1.0
#endif
#ifndef HSM_TUBE_SHADOW_IMAGE_SCALE_Y
#define HSM_TUBE_SHADOW_IMAGE_SCALE_Y 1.0
#endif
#ifndef HSM_TUBE_SHADOW_CURVATURE_SCALE
#define HSM_TUBE_SHADOW_CURVATURE_SCALE 0.0
#endif

// Tube diffuse parameters
#ifndef HSM_TUBE_DIFFUSE_MODE
#define HSM_TUBE_DIFFUSE_MODE 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_AMOUNT
#define HSM_TUBE_DIFFUSE_IMAGE_AMOUNT 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE
#define HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON
#define HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_HUE
#define HSM_TUBE_DIFFUSE_IMAGE_HUE 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_SATURATION
#define HSM_TUBE_DIFFUSE_IMAGE_SATURATION 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS
#define HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_GAMMA
#define HSM_TUBE_DIFFUSE_IMAGE_GAMMA 1.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING
#define HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING
#define HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_LIGHT_NIGHTLIGHTING
#define HSM_TUBE_DIFFUSE_IMAGE_LIGHT_NIGHTLIGHTING 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_LIGHT_NIGHTLIGHTING2
#define HSM_TUBE_DIFFUSE_IMAGE_LIGHT_NIGHTLIGHTING2 0.0
#endif

// Tube static reflection parameters
#ifndef HSM_TUBE_STATIC_REFLECTION_IMAGE_ON
#define HSM_TUBE_STATIC_REFLECTION_IMAGE_ON 0.0
#endif
#ifndef HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE
#define HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE 0.0
#endif
#ifndef HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY
#define HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY 20.0
#endif
#ifndef HSM_TUBE_STATIC_SHADOW_OPACITY
#define HSM_TUBE_STATIC_SHADOW_OPACITY 0.0
#endif
#ifndef HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY
#define HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY 0.0
#endif
#ifndef HSM_TUBE_STATIC_BLACK_LEVEL
#define HSM_TUBE_STATIC_BLACK_LEVEL 0.0
#endif
#ifndef HSM_TUBE_STATIC_AMBIENT_LIGHTING
#define HSM_TUBE_STATIC_AMBIENT_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_STATIC_AMBIENT2_LIGHTING
#define HSM_TUBE_STATIC_AMBIENT2_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_STATIC_SCALE
#define HSM_TUBE_STATIC_SCALE 100.0
#endif
#ifndef HSM_TUBE_STATIC_SCALE_X
#define HSM_TUBE_STATIC_SCALE_X 100.0
#endif
#ifndef HSM_TUBE_STATIC_POS_X
#define HSM_TUBE_STATIC_POS_X 0.0
#endif
#ifndef HSM_TUBE_STATIC_POS_Y
#define HSM_TUBE_STATIC_POS_Y 0.0
#endif
#ifndef HSM_TUBE_STATIC_DITHER_SAMPLES
#define HSM_TUBE_STATIC_DITHER_SAMPLES 0.0
#endif
#ifndef HSM_TUBE_STATIC_DITHER_DISTANCE
#define HSM_TUBE_STATIC_DITHER_DISTANCE 1.0
#endif
#ifndef HSM_TUBE_STATIC_DITHER_AMOUNT
#define HSM_TUBE_STATIC_DITHER_AMOUNT 0.0
#endif

// Tube colored gel parameters
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_ON
#define HSM_TUBE_COLORED_GEL_IMAGE_ON 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE
#define HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_SCALE
#define HSM_TUBE_COLORED_GEL_IMAGE_SCALE 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_SCALE_X
#define HSM_TUBE_COLORED_GEL_IMAGE_SCALE_X 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL
#define HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL
#define HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT
#define HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT
#define HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT
#define HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS
#define HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE
#define HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD
#define HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT
#define HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING
#define HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING
#define HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING 0.0
#endif

// AB Compare parameters (used in tubefx.inc)
#ifndef HSM_AB_COMPARE_FREEZE_CRT_TUBE
#define HSM_AB_COMPARE_FREEZE_CRT_TUBE 0.0
#endif

// Additional parameters that might be missing
#ifndef HSM_TUBE_BLACK_EDGE_SHARPNESS
#define HSM_TUBE_BLACK_EDGE_SHARPNESS 90.0
#endif
#ifndef HSM_BZL_INNER_EDGE_SHADOW
#define HSM_BZL_INNER_EDGE_SHADOW 0.0
#endif
#ifndef HSM_BZL_INNER_CORNER_RADIUS_SCALE
#define HSM_BZL_INNER_CORNER_RADIUS_SCALE 1.0
#endif
#ifndef HSM_BZL_USE_INDEPENDENT_CURVATURE
#define HSM_BZL_USE_INDEPENDENT_CURVATURE 0.0
#endif
#ifndef HSM_CRT_BLEND_MODE
#define HSM_CRT_BLEND_MODE 0.0
#endif
#ifndef HSM_GLOBAL_CORNER_RADIUS
#define HSM_GLOBAL_CORNER_RADIUS 10.0
#endif
#ifndef HSM_GLOBAL_GRAPHICS_BRIGHTNESS
#define HSM_GLOBAL_GRAPHICS_BRIGHTNESS 100.0
#endif
#ifndef HSM_SCREEN_CORNER_RADIUS_SCALE
#define HSM_SCREEN_CORNER_RADIUS_SCALE 1.0
#endif
#ifndef HSM_SCREEN_REFLECTION_ALLOW_REFLECTION
#define HSM_SCREEN_REFLECTION_ALLOW_REFLECTION 1.0
#endif
#ifndef HSM_SCREEN_VIGNETTE_IN_REFLECTION
#define HSM_SCREEN_VIGNETTE_IN_REFLECTION 0.0
#endif
#ifndef HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE
#define HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE 1.0
#endif
#ifndef HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE
#define HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE 1.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_ROTATION
#define HSM_TUBE_DIFFUSE_IMAGE_ROTATION 0.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_SCALE
#define HSM_TUBE_DIFFUSE_IMAGE_SCALE 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_SCALE_X
#define HSM_TUBE_DIFFUSE_IMAGE_SCALE_X 100.0
#endif
#ifndef HSM_TUBE_DIFFUSE_IMAGE_NIGHTLIGHT2_LIGHTING
#define HSM_TUBE_DIFFUSE_IMAGE_NIGHTLIGHT2_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_STATIC_LIGHT_NIGHTLIGHTING
#define HSM_TUBE_STATIC_LIGHT_NIGHTLIGHTING 0.0
#endif
#ifndef HSM_TUBE_STATIC_NIGHTLIGHT2_LIGHTING
#define HSM_TUBE_STATIC_NIGHTLIGHT2_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_LIGHT_NIGHTLIGHTING
#define HSM_TUBE_COLORED_GEL_IMAGE_LIGHT_NIGHTLIGHTING 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_NIGHTLIGHT2_LIGHTING
#define HSM_TUBE_COLORED_GEL_IMAGE_NIGHTLIGHT2_LIGHTING 0.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_BRIGHTNESS
#define HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_BRIGHTNESS 100.0
#endif
#ifndef HSM_TUBE_COLORED_GEL_MIPMAPPING_BLEND_BIAS
#define HSM_TUBE_COLORED_GEL_MIPMAPPING_BLEND_BIAS 0.0
#endif

// ============================================================================
// WebGL2 STUB FUNCTIONS - Functions that are called but not defined in inc files
// ============================================================================

// Apply ambient lighting multiplier (similar to HSM_ApplyAmbientImage but simpler)
vec3 HSM_ApplyAmbient(vec3 base_image, vec3 ambient_color, float blend_amount)
{
    // Blend amount is typically 0-100, convert to 0-1
    float blend = clamp(blend_amount / 100.0, 0.0, 1.0);
    return base_image * mix(vec3(1.0), ambient_color, blend);
}

// Stub for nightlight fill function - sets ambient lighting to neutral white
void HSM_Fill_Nightlight_Images(
    vec2 vTexCoord,
    vec2 viewport_coord,
    vec2 tube_diffuse_coord,
    vec2 tube_diffuse_scale,
    float nightlight1_opacity,
    float nightlight2_opacity,
    float swap_mode,
    sampler2D NightLightingImage,
    sampler2D NightLighting2Image,
    inout vec3 ambient_rgb,
    inout vec3 ambient2_rgb)
{
    // Simple stub: use neutral white for ambient lighting
    // Full implementation would sample the nightlight textures
    ambient_rgb = vec3(1.0);
    ambient2_rgb = vec3(1.0);

    // If opacities are set, we could blend with texture samples
    if (nightlight1_opacity > 0.0) {
        vec4 sample1 = texture(NightLightingImage, viewport_coord);
        ambient_rgb = mix(vec3(1.0), sample1.rgb, nightlight1_opacity);
    }
    if (nightlight2_opacity > 0.0) {
        vec4 sample2 = texture(NightLighting2Image, viewport_coord);
        ambient2_rgb = mix(vec3(1.0), sample2.rgb, nightlight2_opacity);
    }
}
