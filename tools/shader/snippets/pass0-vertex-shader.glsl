#version 300 es
precision highp float;

// Missing constants with default values
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// REMOVED: CSHARPEN, CCONTR, CDETAILS #defines - these are shader parameters
// that get declared as uniforms. Adding #defines causes preprocessor to expand
// "uniform float CSHARPEN;" -> "uniform float 0.0;" which is a syntax error.
// These parameters are handled by the pragma parameter system.

// CRITICAL: transpose() is NOT available in GLSL ES 1.0 (WebGL 1)!
// Add polyfill for WebGL 1 compatibility (only if not already available)
// Note: GLSL doesn't have a way to check if a function exists, so we use a version check
#if __VERSION__ < 300
  #ifndef TRANSPOSE_POLYFILL_DEFINED
  #define TRANSPOSE_POLYFILL_DEFINED
  mat3 transpose(mat3 m) {
    return mat3(
      m[0][0], m[1][0], m[2][0],
      m[0][1], m[1][1], m[2][1],
      m[0][2], m[1][2], m[2][2]
    );
  }
  #endif
#endif

// Mega Bezel shader parameters are injected as uniforms in megaBezelVariables (lines 1488+)
// DO NOT add fallback definitions here - they cause redefinition errors with the uniforms!

// REMOVED: Guest CRT color and gamut variable fallbacks (lines 5163-5189)
// These variables (RW, crtgamut, SPC, beamr, satr, satg, satb, etc.) are #defined in dogway shaders
// Adding "float RW = 0.0;" when RW is #defined as vec3(...) causes:
// "float vec3(0.95...) = 0.0;" → syntax error!
// These variables should come from #defines or be declared in the actual shader source.




uniform mat4 MVP;
uniform vec4 OriginalFeedbackSize;
uniform vec4 FinalViewportSize;
uniform vec4 DerezedPassSize;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_OPACITY;
uniform float PARAM_HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_AMBIENT_LIGHTING;
uniform float PARAM_HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float PARAM_HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float PARAM_HSM_AMBIENT_LIGHTING_OPACITY;
uniform float PARAM_HSM_AMBIENT1_OPACITY;
uniform float PARAM_HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float PARAM_HSM_AMBIENT1_HUE;
uniform float PARAM_HSM_AMBIENT1_SATURATION;
uniform float PARAM_HSM_AMBIENT1_VALUE;
uniform float PARAM_HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float PARAM_HSM_AMBIENT1_SCALE;
uniform float PARAM_HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float PARAM_HSM_AMBIENT1_POSITION_X;
uniform float PARAM_HSM_AMBIENT1_POSITION_Y;
uniform float PARAM_HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float PARAM_HSM_AMBIENT2_HUE;
uniform float PARAM_HSM_AMBIENT2_SATURATION;
uniform float PARAM_HSM_AMBIENT2_VALUE;
uniform float PARAM_HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float PARAM_HSM_AMBIENT2_SCALE;
uniform float PARAM_HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float PARAM_HSM_AMBIENT2_POSITION_X;
uniform float PARAM_HSM_AMBIENT2_POSITION_Y;
uniform float PARAM_HSM_VIEWPORT_ZOOM;
uniform float PARAM_HSM_VIEWPORT_POSITION_X;
uniform float PARAM_HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float PARAM_HSM_FLIP_VIEWPORT_VERTICAL;
uniform float PARAM_HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float PARAM_HSM_FLIP_CORE_VERTICAL;
uniform float PARAM_HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float PARAM_HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_VERTICAL_PRESET;
uniform float PARAM_HSM_NON_INTEGER_SCALE;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_SIM_TUBE_DIAGONAL_SIZE;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float PARAM_HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float PARAM_HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float PARAM_HSM_SCREEN_POSITION_X;
uniform float PARAM_HSM_SCREEN_POSITION_Y;
uniform float HSM_CROP_MODE;
uniform float PARAM_HSM_CROP_PERCENT_ZOOM;
uniform float PARAM_HSM_CROP_PERCENT_TOP;
uniform float PARAM_HSM_CROP_PERCENT_BOTTOM;
uniform float PARAM_HSM_CROP_PERCENT_LEFT;
uniform float PARAM_HSM_CROP_PERCENT_RIGHT;
uniform float PARAM_HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_SCANLINE_DIRECTION;
uniform float PARAM_HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float PARAM_HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float PARAM_HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float PARAM_HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_SHIFT_OPPOSITE_DIR;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_BRIGHTNESS_CUTOFF;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float PARAM_HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float PARAM_HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float PARAM_HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float PARAM_HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float PARAM_HSM_2ND_SCREEN_POS_X;
uniform float PARAM_HSM_2ND_SCREEN_POS_Y;
uniform float PARAM_HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float PARAM_HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float PARAM_HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float PARAM_HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float PARAM_HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float PARAM_HSM_CURVATURE_3D_RADIUS;
uniform float PARAM_HSM_CURVATURE_3D_VIEW_DIST;
uniform float PARAM_HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float PARAM_HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float PARAM_HSM_CRT_CURVATURE_SCALE;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_AREA;
uniform float HSM_AB_COMPARE_FREEZE_CRT_TUBE;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SPLIT_AREA;
uniform float PARAM_HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float PARAM_HSM_SCREEN_REFLECTION_SCALE;
uniform float PARAM_HSM_SCREEN_REFLECTION_POS_X;
uniform float PARAM_HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float PARAM_HSM_TUBE_OPACITY;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float PARAM_HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_EXPLICIT_ASPECT;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float PARAM_HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float PARAM_HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float PARAM_HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float PARAM_HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float PARAM_HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float PARAM_HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float PARAM_HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float PARAM_HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float PARAM_HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float PARAM_HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float PARAM_HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float PARAM_HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float PARAM_HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float PARAM_HSM_TUBE_STATIC_SCALE;
uniform float PARAM_HSM_TUBE_STATIC_SCALE_X;
uniform float PARAM_HSM_TUBE_STATIC_POS_X;
uniform float PARAM_HSM_TUBE_STATIC_POS_Y;
uniform float PARAM_HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float PARAM_HSM_BZL_OPACITY;
uniform float HSM_BZL_BLEND_MODE;
uniform float PARAM_HSM_BZL_WIDTH;
uniform float PARAM_HSM_BZL_HEIGHT;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float PARAM_HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_GLASS_BORDER_ON;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_STANDARD_DECAL_SCALE_WITH_FRAME;
uniform float HSM_STANDARD_TOP_SCALE_WITH_FRAME;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_CRT_LAYER_ORDER;
uniform float HSM_DEVICE_LAYER_ORDER;
uniform float HSM_DEVICELED_LAYER_ORDER;
uniform float HSM_CAB_GLASS_LAYER_ORDER;
uniform float HSM_DECAL_LAYER_ORDER;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_CUTOUT_ASPECT_MODE;
uniform float HSM_CUTOUT_EXPLICIT_ASPECT;
uniform float HSM_CUTOUT_FOLLOW_LAYER;
uniform float HSM_CUTOUT_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_CUTOUT_SCALE;
uniform float HSM_CUTOUT_SCALE_X;
uniform float HSM_CUTOUT_CORNER_RADIUS;
uniform float HSM_CUTOUT_POS_X;
uniform float HSM_CUTOUT_POS_Y;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_HUE;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_HUE;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_DEVICE_OPACITY;
uniform float HSM_DEVICE_HUE;
uniform float HSM_DEVICE_COLORIZE_ON;
uniform float HSM_DEVICE_SATURATION;
uniform float HSM_DEVICE_BRIGHTNESS;
uniform float HSM_DEVICE_GAMMA;
uniform float HSM_DEVICE_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_DEVICE_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_DEVICE_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_DEVICE_BLEND_MODE;
uniform float HSM_DEVICE_SOURCE_MATTE_TYPE;
uniform float HSM_DEVICE_MASK_MODE;
uniform float HSM_DEVICE_CUTOUT_MODE;
uniform float HSM_DEVICE_DUALSCREEN_VIS_MODE;
uniform float HSM_DEVICE_FOLLOW_LAYER;
uniform float HSM_DEVICE_FOLLOW_MODE;
uniform float HSM_DEVICE_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_DEVICE_FILL_MODE;
uniform float HSM_DEVICE_SPLIT_PRESERVE_CENTER;
uniform float HSM_DEVICE_SPLIT_REPEAT_WIDTH;
uniform float HSM_DEVICE_SCALE;
uniform float HSM_DEVICE_SCALE_X;
uniform float HSM_DEVICE_POS_X;
uniform float HSM_DEVICE_POS_Y;
uniform float HSM_DEVICE_MIPMAPPING_BLEND_BIAS;
uniform float HSM_DEVICELED_OPACITY;
uniform float HSM_DEVICELED_HUE;
uniform float HSM_DEVICELED_COLORIZE_ON;
uniform float HSM_DEVICELED_SATURATION;
uniform float HSM_DEVICELED_BRIGHTNESS;
uniform float HSM_DEVICELED_GAMMA;
uniform float HSM_DEVICELED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_DEVICELED_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_DEVICELED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_DEVICELED_BLEND_MODE;
uniform float HSM_DEVICELED_SOURCE_MATTE_TYPE;
uniform float HSM_DEVICELED_MASK_MODE;
uniform float HSM_DEVICELED_CUTOUT_MODE;
uniform float HSM_DEVICELED_DUALSCREEN_VIS_MODE;
uniform float HSM_DEVICELED_FOLLOW_LAYER;
uniform float HSM_DEVICELED_FOLLOW_MODE;
uniform float HSM_DEVICELED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_DEVICELED_FILL_MODE;
uniform float HSM_DEVICELED_SPLIT_PRESERVE_CENTER;
uniform float HSM_DEVICELED_SPLIT_REPEAT_WIDTH;
uniform float HSM_DEVICELED_SCALE;
uniform float HSM_DEVICELED_SCALE_X;
uniform float HSM_DEVICELED_POS_X;
uniform float HSM_DEVICELED_POS_Y;
uniform float HSM_DEVICELED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_DECAL_OPACITY;
uniform float HSM_DECAL_HUE;
uniform float HSM_DECAL_COLORIZE_ON;
uniform float HSM_DECAL_SATURATION;
uniform float HSM_DECAL_BRIGHTNESS;
uniform float HSM_DECAL_GAMMA;
uniform float HSM_DECAL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_DECAL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_DECAL_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_DECAL_BLEND_MODE;
uniform float HSM_DECAL_SOURCE_MATTE_TYPE;
uniform float HSM_DECAL_MASK_MODE;
uniform float HSM_DECAL_CUTOUT_MODE;
uniform float HSM_DECAL_DUALSCREEN_VIS_MODE;
uniform float HSM_DECAL_FOLLOW_LAYER;
uniform float HSM_DECAL_FOLLOW_MODE;
uniform float HSM_DECAL_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_DECAL_FILL_MODE;
uniform float HSM_DECAL_SPLIT_PRESERVE_CENTER;
uniform float HSM_DECAL_SPLIT_REPEAT_WIDTH;
uniform float HSM_DECAL_SCALE;
uniform float HSM_DECAL_SCALE_X;
uniform float HSM_DECAL_POS_X;
uniform float HSM_DECAL_POS_Y;
uniform float HSM_DECAL_MIPMAPPING_BLEND_BIAS;
uniform float HSM_CAB_GLASS_OPACITY;
uniform float HSM_CAB_GLASS_HUE;
uniform float HSM_CAB_GLASS_COLORIZE_ON;
uniform float HSM_CAB_GLASS_SATURATION;
uniform float HSM_CAB_GLASS_BRIGHTNESS;
uniform float HSM_CAB_GLASS_GAMMA;
uniform float HSM_CAB_GLASS_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_CAB_GLASS_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_CAB_GLASS_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_CAB_GLASS_BLEND_MODE;
uniform float HSM_CAB_GLASS_SOURCE_MATTE_TYPE;
uniform float HSM_CAB_GLASS_MASK_MODE;
uniform float HSM_CAB_GLASS_CUTOUT_MODE;
uniform float HSM_CAB_GLASS_DUALSCREEN_VIS_MODE;
uniform float HSM_CAB_GLASS_FOLLOW_LAYER;
uniform float HSM_CAB_GLASS_FOLLOW_MODE;
uniform float HSM_CAB_GLASS_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_CAB_GLASS_FILL_MODE;
uniform float HSM_CAB_GLASS_SPLIT_PRESERVE_CENTER;
uniform float HSM_CAB_GLASS_SPLIT_REPEAT_WIDTH;
uniform float HSM_CAB_GLASS_SCALE;
uniform float HSM_CAB_GLASS_SCALE_X;
uniform float HSM_CAB_GLASS_POS_X;
uniform float HSM_CAB_GLASS_POS_Y;
uniform float HSM_CAB_GLASS_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_MIRROR_WRAP;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float m_glow;
uniform float m_glow_low;
uniform float m_glow_high;
uniform float m_glow_dist;
uniform float m_glow_mask;
uniform float smask_mit;
uniform float bmask;
uniform float bmask1;
uniform float hmask1;
uniform float glow;
uniform float bloom;
uniform float mask_bloom;
uniform float bloom_dist;
uniform float halation;
uniform float TATE;
uniform float IOS;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float prescalex;
uniform float c_shape;
uniform float sborder;
uniform float csize;
uniform float bsize1;
uniform float warpX;
uniform float warpY;
uniform float gamma_c;
uniform float brightboost;
uniform float brightboost1;
uniform float clips;
uniform float blendMode;
uniform float gsl;
uniform float scanline1;
uniform float scanline2;
uniform float beam_min;
uniform float beam_max;
uniform float tds;
uniform float beam_size;
uniform float vertmask;
uniform float scans;
uniform float scan_falloff;
uniform float spike;
uniform float ssharp;
uniform float ring;
uniform float scangamma;
uniform float rolling_scan;
uniform float h_sharp;
uniform float s_sharp;
uniform float smart_ei;
uniform float ei_limit;
uniform float sth;
uniform float barspeed;
uniform float barintensity;
uniform float bardir;
uniform float shadowMask;
uniform float maskstr;
uniform float mcut;
uniform float maskboost;
uniform float masksize;
uniform float mask_zoom;
uniform float mzoom_sh;
uniform float masksizeautothreshold;
uniform float maskDark;
uniform float maskLight;
uniform float mask_gamma;
uniform float slotmask;
uniform float slotmask1;
uniform float slotwidth;
uniform float double_slot;
uniform float slotms;
uniform float smoothmask;
uniform float mshift;
uniform float mask_layout;
uniform float GDV_DECONVERGENCE_ON;
uniform float decons;
uniform float deconrr;
uniform float deconrg;
uniform float deconrb;
uniform float deconrry;
uniform float deconrgy;
uniform float PARAM_deconrby;
uniform float PARAM_deconsmooth;
uniform float PARAM_dctypex;
uniform float PARAM_dctypey;
uniform float PARAM_dcscalemode;
uniform float PARAM_GDV_NOISE_ON;
uniform float PARAM_addnoised;
uniform float PARAM_noisetype;
uniform float PARAM_noiseresd;
uniform float PARAM_noiseresd4kmult;
uniform float PARAM_g_grade_on;
uniform float PARAM_g_Dark_to_Dim;
uniform float PARAM_g_GCompress;
uniform float PARAM_wp_temperature;
uniform float PARAM_g_analog;
uniform float PARAM_g_digital;
uniform float PARAM_g_sfixes;
uniform float PARAM_g_MD_Pal;
uniform float PARAM_g_SMS_bl;
uniform float PARAM_g_CRT_br;
uniform float PARAM_g_CRT_bg;
uniform float PARAM_g_CRT_bb;
uniform float PARAM_g_CRT_rf;
uniform float PARAM_g_CRT_sl;
uniform float PARAM_g_satr;
uniform float PARAM_g_satg;
uniform float PARAM_g_satb;
uniform float PARAM_AS;
uniform float PARAM_asat;
uniform float PARAM_hcrt_h_size;
uniform float PARAM_hcrt_v_size;
uniform float PARAM_hcrt_h_cent;
uniform float PARAM_hcrt_v_cent;
uniform float PARAM_hcrt_pin_phase;
uniform float PARAM_hcrt_pin_amp;
precision highp int;
// Critical RetroArch uniforms (declared after precision, before UBO)
uniform vec4 SourceSize;
uniform vec4 OriginalSize;
uniform vec4 OutputSize;
uniform float FrameCount;
uniform float FrameDirection;

// Vertex shader inputs and outputs (moved early for WebGL compatibility)
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

// Stub definitions for missing Mega Bezel variables and functions
#define LPOS vec3(0.0, 0.0, 1.0)
#define LCOL vec3(1.0, 1.0, 1.0)
#define FIX(c) max(abs(c), 1e-5)
#define HRG_MAX_POINT_CLOUD_SIZE 9.0
#define IS_POTATO_PRESET
#define FXAA_EDGE_THRESHOLD 0.125
#define FXAA_EDGE_THRESHOLD_MIN 0.0312
#define FXAA_SUBPIX_TRIM 0.25
#define FXAA_SUBPIX_TRIM_SCALE 1.0
#define FXAA_SUBPIX_CAP 0.75
#define FXAA_SEARCH_STEPS 8.0
#define FXAA_SEARCH_THRESHOLD 0.25
#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)
#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)
#define SOURCE_MATTE_WHITE 0.0
#define SOURCE_MATTE_NONE 1.0
#define BLEND_MODE_OFF 0.0
#define BLEND_MODE_NORMAL 1.0
#define BLEND_MODE_ADD 2.0
#define BLEND_MODE_MULTIPLY 3.0

// Cache variables (mutable - updated by HSM_UpdateGlobalScreenValuesFromCache)
vec2 CROPPED_ROTATED_SIZE;
vec2 CROPPED_ROTATED_SIZE_WITH_RES_MULT;
vec2 SAMPLE_AREA_START_PIXEL_COORD;

// Stub function for reflection boundary check
bool HSM_IsOutsideReflectionBoundary() { return false; }
// Stub function for tube layers (returns input color without tube effects)
vec4 HSM_ApplyPackedTubeLayers(vec4 color, vec4 layers) { return color; }

// Global #define macros
#define DEFAULT_CRT_GAMMA 2.4
#define DEFAULT_SRGB_GAMMA 2.2
#define DEFAULT_SCREEN_HEIGHT 0.8297
#define DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER (DEFAULT_SCREEN_HEIGHT - 0.4792) / DEFAULT_SCREEN_HEIGHT
#define SHOW_ON_DUALSCREEN_MODE_BOTH 0.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_1 1.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_2 2.0
#define FOLLOW_LAYER_VIEWPORT 0.0
#define FOLLOW_LAYER_TUBE_DIFFUSE 1.0
#define FOLLOW_LAYER_BEZEL_OUTSIDE 2.0
#define FOLLOW_LAYER_BG 3.0
#define FOLLOW_LAYER_DEVICE 4.0
#define FOLLOW_LAYER_DECAL 5.0
#define FOLLOW_LAYER_CAB_GLASS 6.0
#define FOLLOW_LAYER_TOP 7.0
#define TEXTURE_ASPECT_MODE_VIEWPORT 0.0
#define TEXTURE_ASPECT_MODE_EXPLICIT 1.0
#define TEXTURE_ASPECT_MODE_4_3 2.0
#define TEXTURE_ASPECT_MODE_3_4 3.0
#define TEXTURE_ASPECT_MODE_16_9 4.0
#define TEXTURE_ASPECT_MODE_9_16 5.0
#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)
#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)
#define DEFAULT_SCREEN_CORNER_RADIUS 10.0
#define HSM_GAMMA_OUT_CRT gamma_out
#define HSM_POST_CRT_BRIGHTNESS post_br
#define HSM_POST_CRT_BRIGHTNESS_AFFECT_BLACK_LEVEL post_br_affect_black_level / 100.0

// Global mutable variables (vertex only - fragment gets varyings)
float FOLLOW_MODE_SCALE_AND_POS;
float FOLLOW_MODE_EXACT;
float NEGATIVE_CROP_EXPAND_MULTIPLIER;
float MAX_NEGATIVE_CROP;
float DEFAULT_SCREEN_ASPECT;
float DEFAULT_BEZEL_ASPECT;
vec2 DEFAULT_SCREEN_SCALE;
vec2 DEFAULT_BEZEL_SCALE;
float INFOCACHE_MAX_INDEX;
bool CACHE_INFO_CHANGED;
float CURRENT_FRAME_FROM_CACHE_INFO;
float TUBE_DIFFUSE_MASK;
float TUBE_MASK;
float BEZEL_MASK;
float INSIDE_BEZEL_MASK;
float OUTSIDE_TUBE_MASK_FOR_IMAGE;
float FRAME_MASK;
float FRAME_MASK_FOR_IMAGE;
float OUTSIDE_BEZEL_MASK;
float OUTSIDE_FRAME_MASK_FOR_IMAGE;
float OUTSIDE_FRAME_MASK;
float CUTOUT_MASK;
float SCREEN_INDEX;  // Initialized in main()
float SCREEN_ASPECT;
vec2 SCREEN_SCALE;
vec2 SCREEN_SCALE_WITH_ZOOM;
vec2 SCREEN_POS_OFFSET;
vec2 SCREEN_SCALE_2ND_SCREEN;
vec2 SCREEN_POS_OFFSET_1ST_SCREEN;
vec2 SCREEN_POS_OFFSET_2ND_SCREEN;
vec2 VIEWPORT_SCALE;
vec2 VIEWPORT_POS;
vec2 TUBE_SCALE;
vec2 TUBE_DIFFUSE_SCALE;
float TUBE_DIFFUSE_ASPECT;
vec2 TUBE_DIFFUSE_SCALE_1ST_SCREEN;
vec2 TUBE_DIFFUSE_SCALE_2ND_SCREEN;
vec2 FRAME_SCALE;
vec2 BEZEL_OUTSIDE_SCALE;
vec2 BACKGROUND_SCALE;
vec2 LED_SCALE;
vec2 DEVICE_SCALE;
vec2 DEVICELED_SCALE;
vec2 DECAL_SCALE;
vec2 CAB_GLASS_SCALE;
vec2 TOP_IMAGE_SCALE;
float AVERAGE_LUMA;
float USE_VERTICAL_SCANLINES;
float SAMPLING_SCANLINE_DIR_MULT;
float SAMPLING_OPPOSITE_DIR_MULT;
vec2 CORE_SIZE;
vec2 ROTATED_CORE_ORIGINAL_SIZE;
vec2 ROTATED_CORE_PREPPED_SIZE;
vec2 ROTATED_DEREZED_SIZE;
vec2 CROPPED_UNROTATED_SIZE;
vec2 CROPPED_UNROTATED_SIZE_WITH_RES_MULT;
vec2 CROPPED_ROTATED_SIZE_WITH_RES_MULT_FEEDBACK;
vec2 SCREEN_SIZE;
vec2 VIEWPORT_UNSCALED_COORD;
vec2 SCREEN_COORD;
vec2 TUBE_COORD;
vec2 TUBE_DIFFUSE_COORD;
vec2 TUBE_DIFFUSE_COORD_MIXED_POS;
vec2 BEZEL_OUTSIDE_COORD;
vec2 BACKGROUND_COORD;
vec2 DEVICE_COORD;
vec2 DEVICELED_COORD;
vec2 LED_COORD;
vec2 DECAL_COORD;
vec2 CAB_GLASS_COORD;
vec2 TOP_IMAGE_COORD;
vec2 SCREEN_CURVED_COORD;
vec2 TUBE_CURVED_COORD;
vec2 TUBE_DIFFUSE_CURVED_COORD;
vec2 BEZEL_OUTSIDE_CURVED_COORD;
vec2 FRAME_OUTSIDE_CURVED_COORD;
vec2 BACKGROUND_CURVED_COORD;
vec2 LED_CURVED_COORD;
vec2 DEVICE_CURVED_COORD;
vec2 DEVICELED_CURVED_COORD;
vec2 DECAL_CURVED_COORD;
vec2 CAB_GLASS_CURVED_COORD;
vec2 TOP_IMAGE_CURVED_COORD;
float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
float HSM_AMBIENT_LIGHTING_OPACITY;
float HSM_AMBIENT1_OPACITY;
float HSM_AMBIENT2_OPACITY;
float HSM_SINDEN_BORDER_BRIGHTNESS;
float HSM_SINDEN_BORDER_THICKNESS;
float HSM_VIEWPORT_ZOOM;
float HSM_VIEWPORT_POSITION_X;
float HSM_VIEWPORT_POSITION_Y;
float HSM_FLIP_VIEWPORT_VERTICAL;
float HSM_FLIP_VIEWPORT_HORIZONTAL;
float HSM_FLIP_CORE_VERTICAL;
float HSM_FLIP_CORE_HORIZONTAL;
float HSM_INT_SCALE_MAX_HEIGHT;
float HSM_NON_INTEGER_SCALE;
float HSM_NON_INTEGER_SCALE_OFFSET;
float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
float HSM_SCREEN_POSITION_X;
float HSM_SCREEN_POSITION_Y;
float HSM_CROP_PERCENT_ZOOM;
float HSM_CROP_PERCENT_TOP;
float HSM_CROP_PERCENT_BOTTOM;
float HSM_CROP_PERCENT_LEFT;
float HSM_CROP_PERCENT_RIGHT;
float HSM_CROP_BLACK_THRESHOLD;
float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
float HSM_USE_GEOM;
float HSM_CURVATURE_3D_RADIUS;
float HSM_CURVATURE_3D_VIEW_DIST;
float HSM_CURVATURE_3D_TILT_ANGLE_X;
float HSM_CURVATURE_3D_TILT_ANGLE_Y;
float HSM_CRT_CURVATURE_SCALE;
float HSM_AB_COMPARE_SPLIT_POSITION;
float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
float HSM_TUBE_DIFFUSE_IMAGE_HUE;
float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
float HSM_TUBE_SHADOW_IMAGE_OPACITY;
float HSM_TUBE_SHADOW_IMAGE_POS_X;
float HSM_TUBE_SHADOW_IMAGE_POS_Y;
float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
float HSM_TUBE_SHADOW_CURVATURE_SCALE;
float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
float HSM_TUBE_STATIC_BLACK_LEVEL;
float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
float HSM_TUBE_STATIC_SCALE;
float HSM_TUBE_STATIC_SCALE_X;
float HSM_TUBE_STATIC_POS_X;
float HSM_TUBE_STATIC_POS_Y;
float HSM_TUBE_STATIC_SHADOW_OPACITY;
float HSM_TUBE_OPACITY;
float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
float HSM_2ND_SCREEN_SCALE_OFFSET;
float HSM_2ND_SCREEN_POS_X;
float HSM_2ND_SCREEN_POS_Y;
float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
float HSM_SCREEN_REFLECTION_SCALE;
float HSM_SCREEN_REFLECTION_POS_X;
float HSM_SCREEN_REFLECTION_POS_Y;
float HSM_AMBIENT1_HUE;
float HSM_AMBIENT1_SATURATION;
float HSM_AMBIENT1_VALUE;
float HSM_AMBIENT1_CONTRAST;
float HSM_AMBIENT1_SCALE;
float HSM_AMBIENT1_SCALE_X;
float HSM_AMBIENT1_POSITION_X;
float HSM_AMBIENT1_POSITION_Y;
float HSM_AMBIENT1_DITHERING_SAMPLES;
float HSM_AMBIENT2_HUE;
float HSM_AMBIENT2_SATURATION;
float HSM_AMBIENT2_VALUE;
float HSM_AMBIENT2_CONTRAST;
float HSM_AMBIENT2_SCALE;
float HSM_AMBIENT2_SCALE_X;
float HSM_AMBIENT2_POSITION_X;
float HSM_AMBIENT2_POSITION_Y;
float HSM_BZL_OPACITY;
float HSM_BZL_WIDTH;
float HSM_BZL_HEIGHT;
float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
float deconrby;
float deconsmooth;
float dctypex;
float dctypey;
float dcscalemode;
float GDV_NOISE_ON;
float addnoised;
float noisetype;
float noiseresd;
float noiseresd4kmult;
float g_grade_on;
float g_Dark_to_Dim;
float g_GCompress;
float wp_temperature;
float g_analog;
float g_digital;
float g_sfixes;
float g_MD_Pal;
float g_SMS_bl;
float g_CRT_br;
float g_CRT_bg;
float g_CRT_bb;
float g_CRT_rf;
float g_CRT_sl;
float g_satr;
float g_satg;
float g_satb;
float AS;
float asat;
float hcrt_h_size;
float hcrt_v_size;
float hcrt_h_cent;
float hcrt_v_cent;
float hcrt_pin_phase;
float hcrt_pin_amp;

// Common RetroArch compatibility macros (for shaders that don't include hsm-crt-guest-advanced.inc)
#ifndef COMPAT_TEXTURE
#define COMPAT_TEXTURE(c,d) texture(c,d)
#endif

#define DEFAULT_CRT_GAMMA 2.4
#define DEFAULT_SRGB_GAMMA 2.2
#define DEFAULT_SCREEN_HEIGHT 0.8297
#define DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER (DEFAULT_SCREEN_HEIGHT - 0.4792) / DEFAULT_SCREEN_HEIGHT
#define SHOW_ON_DUALSCREEN_MODE_BOTH 0.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_1 1.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_2 2.0
#define FOLLOW_LAYER_VIEWPORT 0.0
#define FOLLOW_LAYER_TUBE_DIFFUSE 1.0
#define FOLLOW_LAYER_BEZEL_OUTSIDE 2.0
#define FOLLOW_LAYER_BG 3.0
#define FOLLOW_LAYER_DEVICE 4.0
#define FOLLOW_LAYER_DECAL 5.0
#define FOLLOW_LAYER_CAB_GLASS 6.0
#define FOLLOW_LAYER_TOP 7.0
#define TEXTURE_ASPECT_MODE_VIEWPORT 0.0
#define TEXTURE_ASPECT_MODE_EXPLICIT 1.0
#define TEXTURE_ASPECT_MODE_4_3 2.0
#define TEXTURE_ASPECT_MODE_3_4 3.0
#define TEXTURE_ASPECT_MODE_16_9 4.0
#define TEXTURE_ASPECT_MODE_9_16 5.0
#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)
#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)
#define DEFAULT_SCREEN_CORNER_RADIUS 10.0

// [Stripped redundant UBO initializer]




#define HSM_GAMMA_OUT_CRT gamma_out

#define HSM_POST_CRT_BRIGHTNESS post_br

#define HSM_POST_CRT_BRIGHTNESS_AFFECT_BLACK_LEVEL post_br_affect_black_level / 100.0



// [Stripped redundant UBO initializer]





// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]



// [Stripped redundant UBO initializer]








// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]



// [Stripped redundant UBO initializer]










// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]





// [Stripped redundant UBO initializer]








// [Stripped redundant UBO initializer]





























// [Stripped redundant UBO initializer]



















// 	#define HSM_FAKE_SCANLINE_BRIGHTNESS_CUTOFF 3.0 // STRIPPED: conflicts with uniform



#define HSM_OVERSCAN_AMOUNT        (HSM_OVERSCAN_AMOUNT / 100.0)

#define HSM_OVERSCAN_X        (HSM_OVERSCAN_AMOUNT + HSM_OVERSCAN_X / 100.0)

#define HSM_OVERSCAN_Y        (HSM_OVERSCAN_AMOUNT + HSM_OVERSCAN_Y / 100.0)







// [Stripped redundant UBO initializer]





















// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]

// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]






// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]



// [Stripped redundant UBO initializer]

#define HSM_SCREEN_VIGNETTE_STRENGTH (1.0 - HSM_SCREEN_VIGNETTE_STRENGTH / 100.0) * 50.0








#define HSM_MONOCHROME_HUE_OFFSET (HSM_MONOCHROME_HUE_OFFSET / 360.0)

#define HSM_MONOCHROME_SATURATION (HSM_MONOCHROME_SATURATION / 100.0)
// [Stripped redundant UBO initializer]





#define HSM_TUBE_EMPTY_THICKNESS (0.7 * HSM_TUBE_EMPTY_THICKNESS / 100.0)

#define HSM_TUBE_EMPTY_THICKNESS_X_SCALE (HSM_TUBE_EMPTY_THICKNESS_X_SCALE / 100.0)

#define HSM_SCREEN_CORNER_RADIUS_SCALE (HSM_SCREEN_CORNER_RADIUS_SCALE / 100.0)


// [Stripped redundant UBO initializer]

// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]



// [Stripped redundant UBO initializer]




// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]








// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]










// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]







// [Stripped redundant UBO initializer]



// [Stripped redundant UBO initializer]


















#define HSM_TUBE_BLACK_EDGE_THICKNESS (0.7 * HSM_TUBE_BLACK_EDGE_THICKNESS / 100.0)

#define HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE (HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE / 100.0)


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]

// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]



















// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]








// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]


// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]
// [Stripped redundant UBO initializer]












// [Stripped redundant UBO initializer]



void main()
{
  // Initialize global variables (WebGL doesn't support initialized non-const globals)
  SCREEN_INDEX = 1.0;

   gl_Position = MVP * Position;
   vTexCoord = TexCoord;
}
