#version 300 es
precision highp float;

// Missing constants with default values
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#ifndef CCONTR
#define CCONTR 0.0
#endif

#ifndef CSHARPEN
#define CSHARPEN 0.0
#endif

#ifndef CDETAILS
#define CDETAILS 0.0
#endif

// Don't add shader parameter defaults - they're causing syntax errors when already defined

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

// Color and gamut constants
float RW = 0.0;
float crtgamut = 0.0;
float SPC = 0.0;
float beamr = 0.0;
float beamg = 0.0;
float beamb = 0.0;
float satr = 0.0;
float satg = 0.0;
float satb = 0.0;
float vibr = 0.0;
float wp_temp = 0.0;
float lum_fix = 0.0;
float SMS_bl = 0.0;
float MD_Palette = 0.0;
float hue_degrees = 0.0;
float U_SHIFT = 0.0;
float U_MUL = 0.0;
float V_SHIFT = 0.0;
float V_MUL = 0.0;
float signal = 0.0;
float CRT_l = 0.0;
float GCompress = 0.0;
float cntrst = 0.0;
float mid = 0.0;
float lum = 0.0;
float lift = 0.0;
vec3 c = vec3(0.0);





uniform mat4 MVP;
uniform vec4 SourceSize;
uniform vec4 OriginalSize;
uniform vec4 OriginalFeedbackSize;
uniform vec4 OutputSize;
uniform vec4 FinalViewportSize;
uniform vec4 DerezedPassSize;
uniform float FrameDirection;
uniform float FrameCount;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_OPACITY;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_AMBIENT_LIGHTING;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_SIM_TUBE_DIAGONAL_SIZE;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
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
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CRT_CURVATURE_SCALE;
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
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
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
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_EXPLICIT_ASPECT;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
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
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
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
uniform float sborder;
uniform float csize;
uniform float bsize1;
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
uniform float no_scanlines;
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
uniform float deconrby;
uniform float deconsmooth;
uniform float dctypex;
uniform float dctypey;
uniform float dcscalemode;
uniform float GDV_NOISE_ON;
uniform float addnoised;
uniform float noisetype;
uniform float noiseresd;
uniform float noiseresd4kmult;
uniform float g_grade_on;
uniform float g_Dark_to_Dim;
uniform float g_GCompress;
uniform float wp_temperature;
uniform float g_analog;
uniform float g_digital;
uniform float g_sfixes;
uniform float g_MD_Pal;
uniform float g_SMS_bl;
uniform float g_CRT_br;
uniform float g_CRT_bg;
uniform float g_CRT_bb;
uniform float g_CRT_rf;
uniform float g_CRT_sl;
uniform float g_satr;
uniform float g_satg;
uniform float g_satb;
uniform float AS;
uniform float asat;
uniform float hcrt_h_size;
uniform float hcrt_v_size;
uniform float hcrt_h_cent;
uniform float hcrt_v_cent;
uniform float hcrt_pin_phase;
uniform float hcrt_pin_amp;
// Stub definitions for missing Mega Bezel variables and functions
#define LPOS vec3(0.0, 0.0, 1.0)
#define LCOL vec3(1.0, 1.0, 1.0)
#define FIX(c) max(abs(c), 1e-5)
#define HRG_MAX_POINT_CLOUD_SIZE 9
#define IS_POTATO_PRESET
#define FXAA_EDGE_THRESHOLD 0.125
#define FXAA_EDGE_THRESHOLD_MIN 0.0312
#define FXAA_SUBPIX_TRIM 0.25
#define FXAA_SUBPIX_TRIM_SCALE 1.0
#define FXAA_SUBPIX_CAP 0.75
#define FXAA_SEARCH_STEPS 8.0
#define FXAA_SEARCH_THRESHOLD 0.25
#define DEFAULT_CRT_GAMMA 2.4
#define DEFAULT_SRGB_GAMMA 2.2
#define DEFAULT_SCREEN_HEIGHT 0.8297
#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)
#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)
#define DEFAULT_SCREEN_CORNER_RADIUS 10.0
#define SOURCE_MATTE_WHITE 0.0
#define SOURCE_MATTE_NONE 1.0
#define BLEND_MODE_OFF 0.0
#define BLEND_MODE_NORMAL 1.0
#define BLEND_MODE_ADD 2.0
#define BLEND_MODE_MULTIPLY 3.0
#define DEFAULT_CRT_GAMMA 2.4
#define DEFAULT_SRGB_GAMMA 2.2
#define DEFAULT_SCREEN_HEIGHT 0.8297
#define DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER 0.42229
#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)
#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)
#define DEFAULT_SCREEN_CORNER_RADIUS 10.0
#define TEXTURE_ASPECT_MODE_VIEWPORT 0.0
#define TEXTURE_ASPECT_MODE_EXPLICIT 1.0
#define TEXTURE_ASPECT_MODE_4_3 2.0
#define TEXTURE_ASPECT_MODE_3_4 3.0
#define TEXTURE_ASPECT_MODE_16_9 4.0
#define TEXTURE_ASPECT_MODE_9_16 5.0
#define SHOW_ON_DUALSCREEN_MODE_BOTH 0.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_1 1.0
#define SHOW_ON_DUALSCREEN_MODE_SCREEN_2 2.0
#define MASK_MODE_ALL 0.0
#define MASK_MODE_SCREEN 1.0
#define MASK_MODE_TUBE 2.0
#define MASK_MODE_INSIDE_BEZEL 3.0
#define MASK_MODE_BEZEL 4.0
#define MASK_MODE_OUTSIDE_TUBE 5.0
#define MASK_MODE_FRAME 6.0
#define MASK_MODE_OUTSIDE_BEZEL 7.0
#define MASK_MODE_OUTSIDE_FRAME 8.0
#define CUTOUT_MODE_INSIDE 1.0
#define CUTOUT_MODE_OUTSIDE 2.0
#define FOLLOW_LAYER_VIEWPORT 0.0
#define FOLLOW_LAYER_SCREEN 1.0
#define FOLLOW_LAYER_TUBE_DIFFUSE 2.0
#define FOLLOW_LAYER_BEZEL_OUTSIDE 3.0
#define FOLLOW_LAYER_BG 4.0
#define FOLLOW_LAYER_DEVICE 5.0
#define FOLLOW_LAYER_DECAL 6.0
#define FOLLOW_LAYER_CAB_GLASS 7.0
#define FOLLOW_LAYER_TOP 8.0


// Stub functions
vec2 HSM_GetTubeCurvedCoord(vec2 in_coord, float in_geom_mode, vec2 in_geom_radius_scaled, vec2 in_geom_view_dist, float in_geom_tilt_angle_x, float in_geom_tilt_angle_y, float in_geom_aspect_ratio, vec2 in_geom_overscan, vec2 in_geom_tilted_tangent, vec2 in_geom_tangent_angle, vec2 in_geom_tangent_angle_screen_scale, vec2 in_geom_pos_x, vec2 in_geom_pos_y) {
  return in_coord;
}

float HSM_GetCornerMask(vec2 in_coord, float screen_aspect, float corner_radius, float edge_sharpness) {
  vec2 new_coord = min(in_coord, vec2(1.0) - in_coord) * vec2(screen_aspect, 1.0);
  vec2 corner_distance = vec2(max(corner_radius / 1000.0, (1.0 - edge_sharpness) * 0.01));
  new_coord = (corner_distance - min(new_coord, corner_distance));
  float distance = sqrt(dot(new_coord, new_coord));
  return clamp((corner_distance.x - distance) * (edge_sharpness * 500.0 + 100.0), 0.0, 1.0);
}

vec4 HSM_ApplyMonochrome(vec4 in_color) {
  return in_color;
}

vec2 HSM_GetMirrorWrappedCoord(vec2 in_coord, float mirror_x, float mirror_y) {
  return in_coord;
}

vec2 HSM_GetCurvedCoord(vec2 in_coord, float curvature_scale, float screen_aspect) {
  return in_coord;
}

vec4 HSM_ApplyGamma(vec4 in_color, float in_gamma) {
  vec3 out_color = pow(in_color.rgb, vec3(in_gamma));
  return vec4(out_color, in_color.a);
}

vec4 HSM_Linearize(vec4 in_color, float encoded_gamma) {
  return HSM_ApplyGamma(in_color, 1.0 / encoded_gamma);
}

vec4 HSM_Delinearize(vec4 in_color, float in_gamma) {
  return HSM_ApplyGamma(in_color, in_gamma);
}

vec4 HSM_BlendModeLayerMix(vec4 color_under, vec4 color_over, float blend_mode, float layer_opacity) {
  return mix(color_under, color_over, layer_opacity);
}

vec4 HSM_Apply_Sinden_Lightgun_Border(vec4 in_color, vec2 in_coord) {
  return in_color;
}

vec2 HSM_GetViewportCoordWithZoomAndPan(vec2 in_coord, float zoom_percent, vec2 pan_offset) {
  return in_coord;
}

void HSM_UpdateGlobalScreenValuesFromCache(out vec2 cache_bounds_coord, out vec2 cache_bounds_coord_clamped, out vec2 cache_bounds_clamped, out vec2 screen_curved_coord, out vec2 screen_curved_coord_clamped, out vec2 screen_pos_offset, out vec2 screen_scale_offset, out vec2 screen_pos_offset_1st_screen, out vec2 screen_scale_offset_1st_screen, out vec2 screen_curved_coord_with_overscan, out vec2 screen_curved_coord_with_overscan_clamped, out vec2 screen_coord_with_overscan, out vec2 screen_coord_with_overscan_clamped, out vec2 screen_scale_with_overscan, out vec2 screen_pos_with_overscan, out vec2 source_size_minned, out vec2 source_size_maxed, out vec2 source_size_minned_1st_screen, out vec2 source_size_maxed_1st_screen) {
  cache_bounds_coord = vec2(0.0);
  cache_bounds_coord_clamped = vec2(0.0);
  cache_bounds_clamped = vec2(0.0);
  screen_curved_coord = vec2(0.0);
  screen_curved_coord_clamped = vec2(0.0);
  screen_pos_offset = vec2(0.0);
  screen_scale_offset = vec2(0.0);
  screen_pos_offset_1st_screen = vec2(0.0);
  screen_scale_offset_1st_screen = vec2(0.0);
  screen_curved_coord_with_overscan = vec2(0.0);
  screen_curved_coord_with_overscan_clamped = vec2(0.0);
  screen_coord_with_overscan = vec2(0.0);
  screen_coord_with_overscan_clamped = vec2(0.0);
  screen_scale_with_overscan = vec2(0.0);
  screen_pos_with_overscan = vec2(0.0);
  source_size_minned = vec2(0.0);
  source_size_maxed = vec2(0.0);
  source_size_minned_1st_screen = vec2(0.0);
  source_size_maxed_1st_screen = vec2(0.0);
}

float HSM_GetUseScreenVignette() {
  return 0.0;
}

float HSM_GetScreenVignetteFactor(vec2 in_coord) {
  return 1.0;
}

float HSM_GetBezelCoords(vec2 tube_diffuse_coord, vec2 tube_diffuse_scale, vec2 tube_scale, float screen_aspect, bool curve_coords_on, inout vec2 bezel_outside_scale, inout vec2 bezel_outside_coord, inout vec2 bezel_outside_curved_coord, inout vec2 frame_outside_curved_coord) {
  bezel_outside_scale = vec2(1.0);
  bezel_outside_coord = tube_diffuse_coord;
  bezel_outside_curved_coord = tube_diffuse_coord;
  frame_outside_curved_coord = tube_diffuse_coord;
  return 0.0;
}

vec3 hrg_get_ideal_global_eye_pos_for_points(vec3 eye_pos, vec2 output_aspect, vec3 global_coords[HRG_MAX_POINT_CLOUD_SIZE], float num_points, float in_geom_radius, float in_geom_view_dist) {
  return eye_pos;
}

vec3 hrg_get_ideal_global_eye_pos(mat3 local_to_global, vec2 output_aspect, float in_geom_mode, float in_geom_radius, float in_geom_view_dist) {
  return vec3(0.0, 0.0, 1.0);
}

vec2 HSM_GetRotatedCoreOriginalSize() {
  return vec2(800.0, 600.0);  // Fallback size
}

vec2 HSM_GetRotatedDerezedSize() {
  return vec2(800.0, 600.0);  // Fallback size
}





vec2 HSM_GetViewportCoordWithZoomAndPan(vec2 coord) {
  return coord;
}

void HSM_UpdateGlobalScreenValuesFromCache(sampler2D cache) {
  // Stub - actual implementation would read from cache
}




bool HHLP_IsOutsideCoordSpace(vec2 coord) {
  return coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0;
}

float GetFade(float current_position, float corner_position, float fade_distance) {
  return smoothstep(corner_position + fade_distance / 2.0, corner_position - fade_distance / 2.0, current_position);
}

// Global mutable variables (shared between vertex and fragment)
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
vec2 CROPPED_ROTATED_SIZE;
vec2 CROPPED_ROTATED_SIZE_WITH_RES_MULT;
vec2 CROPPED_ROTATED_SIZE_WITH_RES_MULT_FEEDBACK;
vec2 SAMPLE_AREA_START_PIXEL_COORD;
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
float HSM_USE_GEOM;
float CURVATURE_MODE_OFF;  // Initialized in main()
float CURVATURE_MODE_2D;  // Initialized in main()
float CURVATURE_MODE_2D_CYLINDER;  // Initialized in main()
float CURVATURE_MODE_3D_1;  // Initialized in main()
float CURVATURE_MODE_3D_2;  // Initialized in main()
float CURVATURE_MODE_3D_CYLINDER;  // Initialized in main()
float MAX_LAYER_ORDER;  // Initialized in main()
float FILL_MODE_KEEP_TEXTURE_ASPECT;
float FILL_MODE_SPLIT;  // Initialized in main()
float FILL_MODE_STRETCH;  // Initialized in main()
float USE_INHERITED_COORD_OFF;
float USE_INHERITED_COORD_ON;
vec2 VIEWPORT_COORD;

// Global function definitions
vec3 HSM_RGBtoHSV(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
    vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 HSM_HSVtoRGB(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(vec3(c) + K.xyz) * 6.0 - K.www);
    return c.z * mix(vec3(K), clamp(p - vec3(K), 0.0, 1.0), c.y);
}
vec3 HSM_ApplyHSVAdjustment(vec3 in_color_rgb, float in_hue, float in_saturation, float in_brightness, float in_colorize_on, float in_gamma_adjust)
{
	if (!(in_colorize_on == 1.0 || in_hue != 0.0 || in_saturation != 1.0 || in_brightness != 1.0 || in_gamma_adjust != 1.0))
		return in_color_rgb;
	
	vec3 color_hsv = HSM_RGBtoHSV(in_color_rgb);

	if (in_colorize_on > 0.5)
{
		color_hsv.x = in_hue;
		color_hsv.y = mix(mix(0.0, color_hsv.y, clamp(in_saturation, 0.0, 1.0)), 1.0, clamp(in_saturation - 1.0, 0.0, 1.0) );
	}
	else
	{
		color_hsv.x += in_hue;
		color_hsv.y *= in_saturation;
	}

	color_hsv.z *= in_brightness;

	vec3 color_rgb = HSM_HSVtoRGB(color_hsv);

	if (in_gamma_adjust != 1.0)
		color_rgb = HSM_ApplyGamma(vec4(color_rgb.r, color_rgb.g, color_rgb.b, 1.0), in_gamma_adjust).rgb;

	return color_rgb;
}
vec4 HSM_GetPreMultipliedColorLinear(vec4 in_color, float matte_type, float encoded_gamma)
{
	vec4 out_color = in_color;

	if (matte_type == SOURCE_MATTE_WHITE)
		out_color.rgb = clamp(out_color.rgb - (1.0 - out_color.a), 0.0, 1.0);

	out_color = HSM_Linearize(out_color, encoded_gamma);

	// If the color was not already premultiplied (matted with black) premultiply it now
	if (matte_type == SOURCE_MATTE_NONE)
		out_color.rgb *= out_color.a;

	return out_color;
}
vec4 HSM_PreMultAlphaBlend(vec4 color_under, vec4 color_over)
{
	vec4 out_color = vec4(color_over.rgb + (color_under.rgb * (1.0 - color_over.a)), clamp(color_under.a + color_over.a, 0.0, 1.0));
	return out_color;
}
vec4 HSM_BlendMultiply(vec4 color_under, vec4 color_over, float opacity)
{
	float final_opacity = color_over.a * opacity;
	return vec4(color_under.rgb * (final_opacity * color_over.rgb + (1.0 - final_opacity) * vec3(1.0)), color_under.a);
}
vec4 HSM_TextureQuilez(sampler2D in_sampler_2D, vec2 in_texture_size, vec2 p)
{
	vec2 tex_size = vec2(ivec2(1024, 1024));
	p = p * in_texture_size + vec2(0.5, 0.5);

	vec2 i = floor(p);
	vec2 f = p - i;
	f = f * f * f * (f * (f * 6.0 - vec2(15.0, 15.0)) + vec2(10.0, 10.0));
	p = float(i) + f;

	p = (p - vec2(0.5, 0.5)) * (1.0 / in_texture_size);

	// final sum and weight normalization
	return texture(in_sampler_2D, p);
}
float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)
{
	float edge_0 = value_to_match - threshold;
	float edge_1 = value_to_match - 0.5 * threshold;
	float edge_2 = value_to_match + 0.5 * threshold;
	float edge_3 = value_to_match + threshold;
	float out_mask = 1.0;
	out_mask *= smoothstep(edge_0, edge_1, in_value);
	out_mask *= smoothstep(edge_3, edge_2, in_value);
	return out_mask;
}
float HHLP_QuadraticBezier (float x, vec2 a)
{
  // Originally adapted by @kyndinfo from BEZMATH.PS(1993.0) by Don Lancaster
  // http://www.tinaja.com/text/bezmath.html
  
  float epsilon = 0.00001;
  a.x = clamp(a.x,0.0,1.0); 
  a.y = clamp(a.y,0.0,1.0); 
  if (a.x == 0.5){
    a += epsilon;
  }
  
  // solve t from x (an inverse operation)
  float om2a = 1.0 - 2.0 * a.x;
  float t = (sqrt(a.x*a.x + om2a*x) - a.x)/om2a;
  float y = (1.0-2.0*a.y)*(t*t) + (2.0*a.y)*t;
  return y;
}
float HHLP_EasePowerIn(float x, float in_exponent)
{
  x = max(0.0, min(x, 1.0));
  return pow(x, in_exponent);
}
float HHLP_EasePowerOut(float x, float in_exponent)
{
  x = 1.0 - max(0.0, min(x, 1.0));
  return 1.0 - pow(x, in_exponent);
}
float HHLP_EasePowerInOut(float x, float in_exponent)
{
  x = max(0.0, min(x, 1.0));
  if (x < 0.5)
{
    return pow(x * 2.0, in_exponent) * 0.5;
  } 
  else 
  {
    return 1.0 - pow((1.0 - x) * 2.0, in_exponent) * 0.5;
  }
}
float HHLP_GetDistanceToLine(float x1, float y1, float a, float b, float c)
{
    float d = abs((a * x1 + b * y1 + c)) /  
              (sqrt(a * a + b * b));
    return d; 
}
float HHLP_IsUnderValue(float in_value, float compare_value)
{
	return clamp((compare_value - in_value) * 100000.0, 0.0, 1.0);
}
float HHLP_IsOverValue(float in_value, float compare_value)
{
	return clamp( - 1.0 * (compare_value - in_value) * 100000.0, 0.0, 1.0);
}
float HHLP_EqualsValue(float in_value, float compare_value, float epsilon)
{
	return HHLP_IsUnderValue(in_value, compare_value + epsilon) * HHLP_IsOverValue(in_value, compare_value - epsilon);
}
float HHLP_EqualsResolution(vec2 in_res, vec2 test_res)
{
  float hardcoded_epsilon = 0.001;
  return  HHLP_EqualsValue(in_res.x, test_res.x, hardcoded_epsilon) * 
          HHLP_EqualsValue(in_res.y, test_res.y, hardcoded_epsilon);
}
vec4 HHLP_GetBilinearTextureSample(sampler2D in_sampler, vec2 in_coord, vec4 in_size)
{
   vec2 uv = in_coord * in_size.xy - 0.5; // Shift by 0.5 since the texel sampling points are in the texel center.
   vec2 a = fract(uv);
   vec2 tex = (floor(uv) + 0.5) * in_size.zw; // Build a sampling point which is in the center of the texel.

   // Sample the bilinear footprint.
   vec4 t0 = texture(in_sampler, tex);
   vec4 t1 = texture(in_sampler, tex);
   vec4 t2 = texture(in_sampler, tex);
   vec4 t3 = texture(in_sampler, tex);

   // Bilinear filter.
   vec4 result = mix(mix(t0, t1, a.x), mix(t2, t3, a.x), a.y);

   return result;
}
float rand(vec2 co, float size){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453) * size;
}
float HSM_GetCoreImageSplitDirection()
{
	float core_image_split_direction = 1.0;

	if (HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE == 0.0)
{
		if (HSM_DUALSCREEN_MODE == 1.0)
			core_image_split_direction = 1.0;
		if (HSM_DUALSCREEN_MODE == 2.0)
			core_image_split_direction = 2.0;
	}
	else
	{
		core_image_split_direction = HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
	}
	return core_image_split_direction;
}
vec2 HSM_GetCoordWithPositionOffset(vec2 in_coord, vec2 position_offset)
{
	return in_coord - position_offset;
}
vec2 HSM_GetInverseScaledCoord(vec2 in_coord, vec2 in_scale)
{
	vec2 middle = vec2(0.49999, 0.49999);
	vec2 diff = in_coord.xy - middle;
	vec2 screen_inverse_scale = 1.0 / in_scale;
	vec2 scaled_coord = middle + diff * screen_inverse_scale;

	return scaled_coord;
}
vec2 HSM_GetVTexCoordWithArgs(vec2 in_coord, vec2 in_scale, vec2 position_offset)
{
	return HSM_GetInverseScaledCoord(HSM_GetCoordWithPositionOffset(in_coord, position_offset), in_scale);
}
vec4 HSM_GetCacheSampleRange(float column_index, float row_index)
{
	float num_rows = 8.0;
	float num_columns = 8.0;

	float range_width = 1.0 / num_columns;
	float range_height = 1.0 / num_rows;

	float zero_based_row_index = row_index - 1.0;
	float zero_based_column_index = column_index - 1.0;

	vec4 out_sample_range = vec4(0.0);

	out_sample_range.x = zero_based_column_index * range_width;
	out_sample_range.y = zero_based_row_index * range_height;
	out_sample_range.z = out_sample_range.x + range_width;
	out_sample_range.w = out_sample_range.y + range_height;
	
	return out_sample_range;
}
vec2 HSM_GetCacheSampleCoord(float column_index, float row_index)
{
	float num_rows = 8.0;
	float num_columns = 8.0;

	float range_width = 1.0 / num_columns;
	float range_height = 1.0 / num_rows;

	vec4 sample_range = HSM_GetCacheSampleRange(column_index, row_index);
	return vec2(sample_range.x + range_width / 2.0, sample_range.y + range_height / 2.0);
}
vec2 HSM_GetViewportCoordWithFlip(vec2 viewport_coord)
{
	vec2 out_coord = viewport_coord;

	// out_coord.y = HSM_FLIP_VIEWPORT_VERTICAL * (out_coord.y - 0.5) + 0.5;
	// out_coord.x = HSM_FLIP_VIEWPORT_HORIZONTAL * (out_coord.x - 0.5) + 0.5;

	if (HSM_FLIP_VIEWPORT_VERTICAL == -1.0)
		out_coord.y = 1.0 - out_coord.y;
	
	if (HSM_FLIP_VIEWPORT_HORIZONTAL == -1.0)
		out_coord.x =  1.0 - out_coord.x;

	return out_coord;
}
float HSM_GetScreenIndex(vec2 viewport_coord)
{
	float out_index = 1.0;
	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;

	if (HSM_DUALSCREEN_MODE == 0.0)
		out_index = 1.0;
	if (HSM_DUALSCREEN_MODE == 1.0)
		out_index = (viewport_coord.y < 0.5 + HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION / output_aspect) ? 1.0 : 2.0;
	if (HSM_DUALSCREEN_MODE == 2.0)
		out_index = (viewport_coord.x < 0.5 + HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION / output_aspect) ? 1.0 : 2.0;

	return out_index;
}
vec4 HSM_UpdateGlobalScreenValuesFromCache(sampler2D in_cache_pass, vec2 vTexCoord)
{
	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;
	vec2 flipped_viewport_coord = HSM_GetViewportCoordWithZoomAndPan(vTexCoord);
	SCREEN_INDEX = HSM_GetScreenIndex(flipped_viewport_coord);
	vec2 sample_coord = vec2(0.0);
	vec4 texture_sample = vec4(0.0);

	// Sample 1.0, 1.0
	sample_coord = HSM_GetCacheSampleCoord(1.0, 1.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	AVERAGE_LUMA = texture_sample.a;
	SAMPLING_SCANLINE_DIR_MULT = texture_sample.r;
	SAMPLING_OPPOSITE_DIR_MULT = texture_sample.g;

	float res_mult_size_sum = 0.0;
	float res_mult_size2_sum = 0.0;

	if (SCREEN_INDEX == 1.0)
{
		// Sample 2.0, 1.0 // r SCREEN_ASPECT
		// ba SCREEN_SCALE
		sample_coord = HSM_GetCacheSampleCoord(2.0, 1.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		SCREEN_ASPECT = texture_sample.r;
		SCREEN_SCALE = texture_sample.ba;

		// Sample 3.0, 1.0 // rg TUBE_SCALE 
		// ba SCREEN_POS_OFFSET
		sample_coord = HSM_GetCacheSampleCoord(3.0, 1.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		TUBE_SCALE = texture_sample.rg;
		SCREEN_POS_OFFSET = texture_sample.ba;

		// Sample 3.0, 4.0 // rg TUBE_DIFFUSE_SCALE 
		sample_coord = HSM_GetCacheSampleCoord(3.0, 4.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		TUBE_DIFFUSE_SCALE = texture_sample.rg;
		TUBE_DIFFUSE_ASPECT = TUBE_DIFFUSE_SCALE.x / TUBE_DIFFUSE_SCALE.y * output_aspect;

		// Sample 4.0, 1.0 // rg CROPPED_ROTATED_SIZE_WITH_RES_MULT
		sample_coord = HSM_GetCacheSampleCoord(4.0, 1.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		CROPPED_ROTATED_SIZE_WITH_RES_MULT = texture_sample.rg;
		res_mult_size_sum = CROPPED_ROTATED_SIZE_WITH_RES_MULT.x + CROPPED_ROTATED_SIZE_WITH_RES_MULT.y;
		ROTATED_CORE_PREPPED_SIZE = texture_sample.ba;

		// Sample 1.0, 2.0 // rg CROPPED_ROTATED_SIZE
		// ba SAMPLE_AREA_START_PIXEL_COORD
		sample_coord = HSM_GetCacheSampleCoord(1.0, 2.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		CROPPED_ROTATED_SIZE = texture_sample.rg;
		SAMPLE_AREA_START_PIXEL_COORD = texture_sample.ba;

		// // Sample 5.0, 1.0 // // rg CROPPED_UNROTATED_SIZE
		// sample_coord = HSM_GetCacheSampleCoord(5.0, 1.0);
		// CROPPED_UNROTATED_SIZE = texture_sample.rg;
		// CROPPED_UNROTATED_SIZE_WITH_RES_MULT = texture_sample.ba;

		// Sample 4.0, 4.0 // rg screen size first screen
		// ba screen size second screen
		sample_coord = HSM_GetCacheSampleCoord(4.0, 4.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		SCREEN_SIZE = texture_sample.rg;
	}
	// If we are in the section of the viewport which is the second screen
	if (SCREEN_INDEX == 2.0)
{
		// Sample 2.0, 2.0 Sample - 2nd Screen
		// r SCREEN_ASPECT
		// ba SCREEN_SCALE
		sample_coord = HSM_GetCacheSampleCoord(2.0, 2.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		SCREEN_ASPECT = texture_sample.r;
		SCREEN_SCALE = texture_sample.gb;

		// Sample 3.0, 2.0 - 2nd Screen
		// rg TUBE_SCALE
		// ba SCREEN_POS_OFFSET
		sample_coord = HSM_GetCacheSampleCoord(3.0, 2.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		TUBE_SCALE = 		texture_sample.rg;
		SCREEN_POS_OFFSET = texture_sample.ba;

		// TODO need to add TUBE_DIFFUSE_ASPECT & deal with 2nd Screen
		// Sample 3.0, 4.0 // ba TUBE_DIFFUSE_SCALE 
		sample_coord = HSM_GetCacheSampleCoord(3.0, 4.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		TUBE_DIFFUSE_SCALE = texture_sample.ba;
		TUBE_DIFFUSE_ASPECT = TUBE_DIFFUSE_SCALE.x / TUBE_DIFFUSE_SCALE.y * output_aspect;

		// Sample 4.0, 2.0 // rg CROPPED_ROTATED_SIZE_WITH_RES_MULT
		sample_coord = HSM_GetCacheSampleCoord(4.0, 2.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		CROPPED_ROTATED_SIZE_WITH_RES_MULT = texture_sample.rg;
		res_mult_size2_sum = CROPPED_ROTATED_SIZE_WITH_RES_MULT.x + CROPPED_ROTATED_SIZE_WITH_RES_MULT.y;

		// Sample 1.0, 3.0 // rg CROPPED_ROTATED_SIZE
		// ba SAMPLE_AREA_START_PIXEL_COORD
		sample_coord = HSM_GetCacheSampleCoord(1.0, 3.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		CROPPED_ROTATED_SIZE = texture_sample.rg;
		SAMPLE_AREA_START_PIXEL_COORD = texture_sample.ba;

		// Sample 4.0, 4.0 // rg screen size first screen
		// ba screen size second screen
		sample_coord = HSM_GetCacheSampleCoord(4.0, 4.0);
		texture_sample = texture(in_cache_pass, sample_coord);
		SCREEN_SIZE = texture_sample.ba;
	}

	// Sample 3.0, 1.0 // rg TUBE_SCALE 
	// ba SCREEN_POS_OFFSET
	sample_coord = HSM_GetCacheSampleCoord(3.0, 1.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	// TUBE_SCALE_1ST_SCREEN = texture_sample.rg;
	SCREEN_POS_OFFSET_1ST_SCREEN = texture_sample.ba;

	// Sample 3.0, 4.0 // rg TUBE_DIFFUSE_SCALE_1ST_SCREEN 
	sample_coord = HSM_GetCacheSampleCoord(3.0, 4.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	TUBE_DIFFUSE_SCALE_1ST_SCREEN = texture_sample.rg;
	// TUBE_DIFFUSE_ASPECT_1ST_SCREEN = TUBE_DIFFUSE_SCALE_1ST_SCREEN.x / TUBE_DIFFUSE_SCALE_1ST_SCREEN.y * output_aspect;

	// Sample 3.0, 2.0 - 2nd Screen
	// rg TUBE_SCALE_2ND_SCREEN
	// ba SCREEN_POS_OFFSET_2ND_SCREEN
	sample_coord = HSM_GetCacheSampleCoord(3.0, 2.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	// TUBE_SCALE_2ND_SCREEN = 		texture_sample.rg;
	SCREEN_POS_OFFSET_2ND_SCREEN = texture_sample.ba;

	// TODO need to add TUBE_DIFFUSE_ASPECT & deal with 2nd Screen
	// Sample 3.0, 4.0 // ba TUBE_DIFFUSE_SCALE_2ND_SCREEN 
	sample_coord = HSM_GetCacheSampleCoord(3.0, 4.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	TUBE_DIFFUSE_SCALE_2ND_SCREEN = texture_sample.ba;

	// Sample 2.0, 3.0 Sample
	// rg CORE_SIZE
	sample_coord = HSM_GetCacheSampleCoord(2.0, 3.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	CORE_SIZE = texture_sample.rg;
	ROTATED_CORE_ORIGINAL_SIZE = texture_sample.ba;

	// Sample 3.0, 3.0 // rg VIEWPORT_SCALE
	// ba VIEWPORT_POS
	sample_coord = HSM_GetCacheSampleCoord(3.0, 3.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	VIEWPORT_SCALE = texture_sample.rg;
	VIEWPORT_POS = texture_sample.ba;

	// Sample 4.0, 3.0 // rg SCREEN_SCALE_2ND_SCREEN
	// ba SCREEN_POS_OFFSET_2ND_SCREEN
	sample_coord = HSM_GetCacheSampleCoord(4.0, 3.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	SCREEN_SCALE_2ND_SCREEN = texture_sample.rg;
	SCREEN_POS_OFFSET_2ND_SCREEN = texture_sample.ba;

	// Sample 1.0, 4.0 // g CURRENT_FRAME_FROM_CACHE_INFO
	// b ROTATED_DEREZED_SIZE
	sample_coord = HSM_GetCacheSampleCoord(1.0, 4.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	CURRENT_FRAME_FROM_CACHE_INFO = texture_sample.g;
	ROTATED_DEREZED_SIZE = texture_sample.ba;

	// Sample 2.0, 4.0 // r NEGATIVE_CROP_EXPAND_MULTIPLIER
	// g MAX_NEGATIVE_CROP
	sample_coord = HSM_GetCacheSampleCoord(2.0, 4.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	NEGATIVE_CROP_EXPAND_MULTIPLIER = texture_sample.r;
	MAX_NEGATIVE_CROP = texture_sample.g;
	USE_VERTICAL_SCANLINES = texture_sample.b;

	// Sample 8.0, 8.0 // r CACHE_INFO_CHANGED
	sample_coord = HSM_GetCacheSampleCoord(8.0, 8.0);
	texture_sample = texture(in_cache_pass, sample_coord);
	CACHE_INFO_CHANGED = texture_sample.r > 0.5 ? true : false;

	SCREEN_SCALE_WITH_ZOOM = SCREEN_SCALE * HSM_VIEWPORT_ZOOM;
	SCREEN_COORD = HSM_GetVTexCoordWithArgs(flipped_viewport_coord, SCREEN_SCALE, SCREEN_POS_OFFSET);
	TUBE_DIFFUSE_COORD = HSM_GetVTexCoordWithArgs(flipped_viewport_coord, TUBE_DIFFUSE_SCALE, SCREEN_POS_OFFSET);
	TUBE_DIFFUSE_COORD_MIXED_POS = HSM_GetVTexCoordWithArgs(flipped_viewport_coord, TUBE_DIFFUSE_SCALE_1ST_SCREEN, (SCREEN_POS_OFFSET_1ST_SCREEN + SCREEN_POS_OFFSET_2ND_SCREEN) / 2.0);

	return vec4(0.0);
}
vec2 hrg_quadratic_solve(float a, float b_over_2, float c)
{
    //  Requires:   1.) a, b, and c are quadratic formula coefficients
    //              2.) b_over_2 = b/2.0 (simplifies terms to factor 2.0 out)
    //              3.) b_over_2 must be guaranteed < 0.0 (avoids a branch)
    //  Returns:    Returns vec2(first_solution, discriminant), so the caller
    //              can choose how to handle the "no intersection" case.  The
    //              Kahan or Citardauq formula is used for numerical robustness.
    float discriminant = b_over_2 * b_over_2 - a * c;
    float solution0 = c / (-b_over_2 + sqrt(discriminant));
    return vec2(solution0, discriminant);
}
vec2 hrg_intersect_sphere(vec3 view_vec, vec3 eye_pos_vec, float in_geom_radius)
{
    //  Requires:   1.) view_vec and eye_pos_vec are 3D vectors in the sphere's
    //                  local coordinate frame (eye_pos_vec is a position, i.e.
    //                  a vector from the origin to the eye/camera)
    //              2.) in_geom_radius is a global containing the sphere's radius
    //  Returns:    Cast a ray of direction view_vec from eye_pos_vec at a
    //              sphere of radius in_geom_radius, and return the distance to
    //              the first intersection in units of length(view_vec).
    //              http://wiki.cgsociety.org/index.php/Ray_Sphere_Intersection
    //  Quadratic formula coefficients (b_over_2 is guaranteed negative):
    float a = dot(view_vec, view_vec);
    float b_over_2 = dot(view_vec, eye_pos_vec);  //  * 2.0 factored out
    float c = dot(eye_pos_vec, eye_pos_vec) - in_geom_radius * in_geom_radius;
    return hrg_quadratic_solve(a, b_over_2, c);
}
vec2 hrg_intersect_cylinder(vec3 view_vec, vec3 eye_pos_vec, float in_geom_radius)
{
    //  Requires:   1.) view_vec and eye_pos_vec are 3D vectors in the sphere's
    //                  local coordinate frame (eye_pos_vec is a position, i.e.
    //                  a vector from the origin to the eye/camera)
    //              2.) in_geom_radius is a global containing the cylinder's radius
    //  Returns:    Cast a ray of direction view_vec from eye_pos_vec at a
    //              cylinder of radius in_geom_radius, and return the distance to
    //              the first intersection in units of length(view_vec).  The
    //              derivation of the coefficients is in Christer Ericson's
    //              Real-Time Collision Detection, p. 195.0 - 196.0, and this version
    //              uses LaGrange's identity to reduce operations.
    //  Arbitrary "cylinder top" reference point for an infinite cylinder:
    vec3 cylinder_top_vec = vec3(0.0, in_geom_radius, 0.0);
    vec3 cylinder_axis_vec = vec3(0.0, 1.0, 0.0);//vec3(0.0, 2.0*in_geom_radius, 0.0);
    vec3 top_to_eye_vec = eye_pos_vec - cylinder_top_vec;
    vec3 axis_x_view = cross(cylinder_axis_vec, view_vec);
    vec3 axis_x_top_to_eye = cross(cylinder_axis_vec, top_to_eye_vec);
    //  Quadratic formula coefficients (b_over_2 is guaranteed negative):
    float a = dot(axis_x_view, axis_x_view);
    float b_over_2 = dot(axis_x_top_to_eye, axis_x_view);
    float c = dot(axis_x_top_to_eye, axis_x_top_to_eye) - in_geom_radius * in_geom_radius; //*dot(cylinder_axis_vec, cylinder_axis_vec);
    return hrg_quadratic_solve(a, b_over_2, c);
}
vec2 hrg_cylinder_xyz_to_uv( vec3 intersection_pos_local, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   An xyz intersection position on a cylinder.
    //  Returns:    video_uv coords mapped to range [-0.5, 0.5]
    //  Mapping:    Define square_uv.x to be the signed arc length in xz-space,
    //              and define square_uv.y = -intersection_pos_local.y (+v = -y).
    //  Start with a numerically robust arc length calculation.
    float angle_from_image_center = atan(intersection_pos_local.x, intersection_pos_local.z);
    float signed_arc_len = angle_from_image_center * in_geom_radius;
    //  Get a uv-mapping where [-0.5, 0.5] maps to a "square" area, then divide
    //  by the aspect ratio to stretch the mapping appropriately:
    vec2 square_uv = vec2(signed_arc_len, -intersection_pos_local.y);
    vec2 video_uv = square_uv / output_aspect;
    return video_uv;
}
vec3 hrg_cylinder_uv_to_xyz(vec2 video_uv, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   video_uv coords mapped to range [-0.5, 0.5]
    //  Returns:    An xyz intersection position on a cylinder.  This is the
    //              inverse of hrg_cylinder_xyz_to_uv().
    //  Expand video_uv by the aspect ratio to get proportionate x/y lengths,
    //  then calculate an xyz position for the cylindrical mapping above.
    vec2 square_uv = video_uv * output_aspect;
    float arc_len = square_uv.x;
    float angle_from_image_center = arc_len / in_geom_radius;
    float x_pos = sin(angle_from_image_center) * in_geom_radius;
    float z_pos = cos(angle_from_image_center) * in_geom_radius;
    //  Or: z = sqrt(in_geom_radius**2.0 - x** 2.0)
    //  Or: z = in_geom_radius/sqrt(1.0 + tan(angle)** 2.0), x = z * tan(angle)
    vec3 intersection_pos_local = vec3(x_pos, -square_uv.y, z_pos);
    return intersection_pos_local;
}
vec2 hrg_sphere_xyz_to_uv(vec3 intersection_pos_local, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   An xyz intersection position on a sphere.
    //  Returns:    video_uv coords mapped to range [-0.5, 0.5]
    //  Mapping:    First define square_uv.x/square_uv.y ==
    //              intersection_pos_local.x/intersection_pos_local.y.  Then,
    //              length(square_uv) is the arc length from the image center
    //              at(0.0, 0.0, in_geom_radius) along the tangent great circle.
    //              Credit for this mapping goes to cgwg: I never managed to
    //              understand his code, but he told me his mapping was based on
    //              great circle distances when I asked him about it, which
    //              informed this very similar (almost identical) mapping.
    //  Start with a numerically robust arc length calculation between the ray-
    //  sphere intersection point and the image center using a method posted by
    //  Roger Stafford on comp.soft-sys.matlab:
    //  https://groups.google.com/d/msg/comp.soft-sys.matlab/zNbUui3bjcA/c0HV_bHSx9cJ
    vec3 image_center_pos_local = vec3(0.0, 0.0, in_geom_radius);
    float cp_len =
        length(cross(intersection_pos_local, image_center_pos_local));
    float dp = dot(intersection_pos_local, image_center_pos_local);
    float angle_from_image_center = atan(cp_len, dp);
    float arc_len = angle_from_image_center * in_geom_radius;
    //  Get a uv-mapping where [-0.5, 0.5] maps to a "square" area, then divide
    //  by the aspect ratio to stretch the mapping appropriately:
    vec2 square_uv_unit = normalize(vec2(intersection_pos_local.x, -intersection_pos_local.y));
    vec2 square_uv = arc_len * square_uv_unit;
    vec2 video_uv = square_uv / output_aspect;
    return video_uv;
}
vec3 hrg_sphere_uv_to_xyz(vec2 video_uv, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   video_uv coords mapped to range [-0.5, 0.5]
    //  Returns:    An xyz intersection position on a sphere.  This is the
    //              inverse of hrg_sphere_xyz_to_uv().
    //  Expand video_uv by the aspect ratio to get proportionate x/y lengths,
    //  then calculate an xyz position for the spherical mapping above.
    vec2 square_uv = video_uv * output_aspect;
    //  Using length or sqrt here butchers the framerate on my 8800GTS if
    //  this function is called too many times, and so does taking the max
    //  component of square_uv/square_uv_unit (program length threshold?).
    //float arc_len = length(square_uv);
    vec2 square_uv_unit = normalize(square_uv);
    float arc_len = square_uv.y/square_uv_unit.y;
    float angle_from_image_center = arc_len / in_geom_radius;
    float xy_dist_from_sphere_center = sin(angle_from_image_center) * in_geom_radius;
    //vec2 xy_pos = xy_dist_from_sphere_center * (square_uv/FIX_ZERO(arc_len));
    vec2 xy_pos = xy_dist_from_sphere_center * square_uv_unit;
    float z_pos = cos(angle_from_image_center) * in_geom_radius;
    vec3 intersection_pos_local = vec3(xy_pos.x, -xy_pos.y, z_pos);
    return intersection_pos_local;
}
vec2 hrg_sphere_alt_xyz_to_uv(vec3 intersection_pos_local, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   An xyz intersection position on a cylinder.
    //  Returns:    video_uv coords mapped to range [-0.5, 0.5]
    //  Mapping:    Define square_uv.x to be the signed arc length in xz-space,
    //              and define square_uv.y == signed arc length in yz-space.
    //  See hrg_cylinder_xyz_to_uv() for implementation details (very similar).
    vec2 angle_from_image_center = atan( vec2(intersection_pos_local.x, -intersection_pos_local.y),
                                                intersection_pos_local.zz);
    vec2 signed_arc_len = angle_from_image_center * in_geom_radius;
    vec2 video_uv = signed_arc_len / output_aspect;
    return video_uv;
}
vec3 hrg_sphere_alt_uv_to_xyz(vec2 video_uv, vec2 output_aspect, float in_geom_radius)
{
    //  Requires:   video_uv coords mapped to range [-0.5, 0.5]
    //  Returns:    An xyz intersection position on a sphere.  This is the
    //              inverse of hrg_sphere_alt_xyz_to_uv().
    //  See hrg_cylinder_uv_to_xyz() for implementation details (very similar).
    vec2 square_uv = video_uv * output_aspect;
    vec2 arc_len = square_uv;
    vec2 angle_from_image_center = arc_len / in_geom_radius;
    vec2 xy_pos = sin(angle_from_image_center) * in_geom_radius;
    float z_pos = sqrt(in_geom_radius * in_geom_radius - dot(xy_pos, xy_pos));
    return vec3(xy_pos.x, -xy_pos.y, z_pos);
}
vec2 hrg_intersect(vec3 view_vec_local, vec3 eye_pos_local, float in_geom_mode, float in_geom_radius)
{
    return in_geom_mode < 2.5 ?    hrg_intersect_sphere(view_vec_local, eye_pos_local, in_geom_radius) :
                                hrg_intersect_cylinder(view_vec_local, eye_pos_local, in_geom_radius);
}
vec2 hrg_xyz_to_uv( vec3 intersection_pos_local, vec2 output_aspect, float in_geom_mode, float in_geom_radius)
{
    return in_geom_mode < 1.5 ?    hrg_sphere_xyz_to_uv(intersection_pos_local, output_aspect, in_geom_radius) :
                                in_geom_mode < 2.5 ?   hrg_sphere_alt_xyz_to_uv(intersection_pos_local, output_aspect, in_geom_radius) :
                                                    hrg_cylinder_xyz_to_uv(intersection_pos_local, output_aspect, in_geom_radius);
}
vec3 hrg_uv_to_xyz(vec2 uv, vec2 output_aspect, float in_geom_mode, float in_geom_radius)
{
    return in_geom_mode < 1.5 ? hrg_sphere_uv_to_xyz(uv, output_aspect, in_geom_radius) :
                             in_geom_mode < 2.5 ? hrg_sphere_alt_uv_to_xyz(uv, output_aspect, in_geom_radius) :
                                               hrg_cylinder_uv_to_xyz(uv, output_aspect, in_geom_radius);
}
vec2 hrg_view_vec_to_uv(vec3 view_vec_local, 
                    vec3 eye_pos_local,
                    vec2 output_aspect, 
                    float in_geom_mode,
                    float in_geom_radius, 
                    out vec3 intersection_pos)
{
    //  Get the intersection point on the primitive, given an eye position
    //  and view vector already in its local coordinate frame:
    vec2 intersect_dist_and_discriminant = hrg_intersect(view_vec_local, eye_pos_local, in_geom_mode, in_geom_radius);
    vec3 intersection_pos_local = eye_pos_local + view_vec_local * intersect_dist_and_discriminant.x;
    //  Save the intersection position to an output parameter:
    intersection_pos = intersection_pos_local;
    //  Transform into uv coords, but give out-of-range coords if the
    //  view ray doesn't hrg_intersect the primitive in the first place:
    return intersect_dist_and_discriminant.y > 0.005 ?  hrg_xyz_to_uv(intersection_pos_local, output_aspect, in_geom_mode, in_geom_radius) : 
                                                        vec2(1.0);
}
mat3 hrg_get_pixel_to_object_matrix(  mat3 global_to_local,
                                    vec3 eye_pos_local, 
                                    vec3 view_vec_global,
                                    vec3 intersection_pos_local, 
                                    vec3 normal,
                                    vec2 output_pixel_size)
{
    //  Requires:   See hrg_get_curved_video_uv_coords_and_tangent_matrix for
    //              descriptions of each parameter.
    //  Returns:    Return a transformation matrix from 2D pixel-space vectors
    //              (where ( + 1.0, + 1.0) is a vector to one pixel down-right,
    //              i.e. same directionality as uv texels) to 3D object-space
    //              vectors in the CRT's local coordinate frame (right-handed)
    //              ***which are tangent to the CRT surface at the intersection
    //              position.***  (Basically, we want to convert pixel-space
    //              vectors to 3D vectors along the CRT's surface, for later
    //              conversion to uv vectors.)
    //  Shorthand inputs:
    vec3 pos = intersection_pos_local;
    vec3 eye_pos = eye_pos_local;
    //  Get a piecewise-linear matrix transforming from "pixelspace" offset
    //  vectors (1.0 = one pixel) to object space vectors in the tangent
    //  plane (faster than finding 3.0 view-object intersections).
    //  1.) Get the local view vecs for the pixels to the right and down:
    vec3 view_vec_right_global =  view_vec_global + vec3(output_pixel_size.x, 0.0, 0.0);
    vec3 view_vec_down_global =   view_vec_global + vec3(0.0, -output_pixel_size.y, 0.0);
    vec3 view_vec_right_local =   view_vec_right_global * global_to_local;
    vec3 view_vec_down_local =    view_vec_down_global * global_to_local;
    //  2.) Using the true intersection point, hrg_intersect the neighboring
    //      view vectors with the tangent plane:
    vec3 intersection_vec_dot_normal = vec3(dot(pos - eye_pos, normal));
    vec3 right_pos =    eye_pos + 
                        (intersection_vec_dot_normal / dot(view_vec_right_local, normal)) *
                        view_vec_right_local;
    vec3 down_pos =     eye_pos + 
                        (intersection_vec_dot_normal / dot(view_vec_down_local, normal)) * 
                        view_vec_down_local;
    //  3.) Subtract the original intersection pos from its neighbors; the
    //      resulting vectors are object-space vectors tangent to the plane.
    //      These vectors are the object-space transformations of(1.0, 0.0)
    //      and(0.0, 1.0) pixel offsets, so they form the first two basis
    //      vectors of a pixelspace to object space transformation.  This
    //      transformation is 2D to 3D, so use(0.0, 0.0, 0.0) for the third vector.
    vec3 object_right_vec = right_pos - pos;
    vec3 object_down_vec = down_pos - pos;
    mat3 pixel_to_object = mat3(
                                    object_right_vec.x, object_down_vec.x, 0.0,
                                    object_right_vec.y, object_down_vec.y, 0.0,
                                    object_right_vec.z, object_down_vec.z, 0.0
                                    );
    return pixel_to_object;
}
mat3 hrg_get_object_to_tangent_matrix(vec3 intersection_pos_local,
                                    vec3 normal, 
                                    vec2 output_aspect, 
                                    float in_geom_mode)
{
    //  Requires:   See hrg_get_curved_video_uv_coords_and_tangent_matrix for
    //              descriptions of each parameter.
    //  Returns:    Return a transformation matrix from 3D object-space vectors
    //              in the CRT's local coordinate frame (right-handed, +y = up)
    //              to 2D video_uv vectors (+v = down).
    //  Description:
    //  The TBN matrix formed by the [tangent, bitangent, normal] basis
    //  vectors transforms ordinary vectors from tangent->object space.
    //  The cotangent matrix formed by the [cotangent, cobitangent, normal]
    //  basis vectors transforms normal vectors (covectors) from
    //  tangent->object space.  It's the inverse-transpose of the TBN matrix.
    //  We want the inverse of the TBN matrix (transpose of the cotangent
    //  matrix), which transforms ordinary vectors from object->tangent space.
    //  Start by calculating the relevant basis vectors in accordance with
    //  Christian Schüler's blog post "Followup: Normal Mapping Without
    //  Precomputed Tangents":  http://www.thetenthplanet.de/archives / 1180.0
    //  With our particular uv mapping, the scale of the u and v directions
    //  is determined entirely by the aspect ratio for cylindrical and ordinary
    //  spherical mappings, and so tangent and bitangent lengths are also
    //  determined by it (the alternate mapping is more complex).  Therefore, we
    //  must ensure appropriate cotangent and cobitangent lengths as well.
    //  Base these off the uv<=>xyz mappings for each primitive.
    vec3 pos = intersection_pos_local;
    vec3 x_vec = vec3(1.0, 0.0, 0.0);
    vec3 y_vec = vec3(0.0, 1.0, 0.0);
    //  The tangent and bitangent vectors correspond with increasing u and v,
    //  respectively.  Mathematically we'd base the cotangent/cobitangent on
    //  those, but we'll compute the cotangent/cobitangent directly when we can.
    vec3 cotangent_unscaled;
    vec3 cobitangent_unscaled;
    //  in_geom_mode should be constant-folded without RUNTIME_GEOMETRY_MODE.
    if(in_geom_mode < 1.5)
{
        //  Sphere:
        //  tangent = normalize(cross(normal, cross(x_vec, pos))) * output_aspect.x
        //  bitangent = normalize(cross(cross(y_vec, pos), normal)) * output_aspect.y
        //  inv_determinant = 1.0 / length(cross(bitangent, tangent))
        //  cotangent = cross(normal, bitangent) * inv_determinant
        //            == normalize(cross(y_vec, pos)) * output_aspect.y * inv_determinant
        //  cobitangent = cross(tangent, normal) * inv_determinant
        //            == normalize(cross(x_vec, pos)) * output_aspect.x * inv_determinant
        //  Simplified (scale by inv_determinant below):
        cotangent_unscaled = normalize(cross(y_vec, pos)) * output_aspect.y;
        cobitangent_unscaled = normalize(cross(x_vec, pos)) * output_aspect.x;
    }
    else if(in_geom_mode < 2.5)
{
        //  Sphere, alternate mapping:
        //  This mapping works a bit like the cylindrical mapping in two
        //  directions, which makes the lengths and directions more complex.
        //  Unfortunately, I can't find much of a shortcut:
        vec3 tangent = normalize(cross(y_vec, vec3(pos.x, 0.0, pos.z))) * output_aspect.x;
        vec3 bitangent = normalize(cross(x_vec, vec3(0.0, pos.yz))) * output_aspect.y;
        cotangent_unscaled = cross(normal, bitangent);
        cobitangent_unscaled = cross(tangent, normal);
    }
    else
    {
        //  Cylinder:
        //  tangent = normalize(cross(y_vec, normal)) * output_aspect.x;
        //  bitangent = vec3(0.0, -output_aspect.y, 0.0);
        //  inv_determinant = 1.0 / length(cross(bitangent, tangent))
        //  cotangent = cross(normal, bitangent) * inv_determinant
        //            == normalize(cross(y_vec, pos)) * output_aspect.y * inv_determinant
        //  cobitangent = cross(tangent, normal) * inv_determinant
        //            == vec3(0.0, -output_aspect.x, 0.0) * inv_determinant
        cotangent_unscaled = cross(y_vec, normal) * output_aspect.y;
        cobitangent_unscaled = vec3(0.0, -output_aspect.x, 0.0);
    }
    vec3 computed_normal = cross(cobitangent_unscaled, cotangent_unscaled);
    float inv_determinant = inversesqrt(dot(computed_normal, computed_normal));
    vec3 cotangent = cotangent_unscaled * inv_determinant;
    vec3 cobitangent = cobitangent_unscaled * inv_determinant;
    //  The [cotangent, cobitangent, normal] column vecs form the cotangent
    //  frame, i.e. the inverse-transpose TBN matrix.  Get its transpose:
    mat3 object_to_tangent = mat3(  cotangent, 
                                        cobitangent, 
                                        normal);
    return object_to_tangent;
}
vec2 hrg_get_curved_video_uv_coords_and_tangent_matrix( vec2 flat_video_uv, 
                                                    vec3 eye_pos_local,
                                                    vec2 output_pixel_size, 
                                                    vec2 output_aspect,
                                                    float in_geom_mode, 
                                                    float in_geom_radius, 
                                                    float in_geom_view_dist,
                                                    mat3 global_to_local,
                                                    out mat2 pixel_to_tangent_video_uv)
{
    //  Requires:   Parameters:
    //              1.) flat_video_uv coords are in range [0.0, 1.0], where
    //                  (0.0, 0.0) is the top-left corner of the screen and
    //                  (1.0, 1.0) is the bottom-right corner.
    //              2.) eye_pos_local is the 3D camera position in the simulated
    //                  CRT's local coordinate frame.  For best results, it must
    //                  be computed based on the same in_geom_view_dist used here.
    //              3.) output_pixel_size = vec2(1.0)/IN.OutputSize.xy
    //              4.) output_aspect = hrg_get_aspect_vector(
    //                      IN.OutputSize.xy.x / IN.OutputSize.xy.y);
    //              5.) in_geom_mode is a static or runtime mode setting:
    // 0.0 = off, 1.0 = sphere, 2.0 = sphere alt., 3.0 = cylinder
    //              6.) global_to_local is a 3x3 matrix transforming (ordinary)
    //                  worldspace vectors to the CRT's local coordinate frame
    //              Globals:
    //              1.) in_geom_view_dist must be > 0.  It controls the "near
    //                  plane" used to interpret flat_video_uv as a view
    //                  vector, which controls the field of view (FOV).
    //  Returns:    Return final uv coords in [0.0, 1.0], and return a pixel-
    //              space to video_uv tangent-space matrix in the out parameter.
    //              (This matrix assumes pixel-space +y = down, like +v = down.)
    //              We'll transform flat_video_uv into a view vector, project
    //              the view vector from the camera/eye, hrg_intersect with a sphere
    //              or cylinder representing the simulated CRT, and convert the
    //              intersection position into final uv coords and a local
    //              transformation matrix.
    //  First get the 3D view vector (output_aspect and in_geom_view_dist are globals):
    //  1.) Center uv around(0.0, 0.0) and make (-0.5, -0.5) and (0.5, 0.5)
    //      correspond to the top-left/bottom-right output screen corners.
    //  2.) Multiply by output_aspect to preemptively "undo" Retroarch's screen-
    //      space 2D aspect correction.  We'll reapply it in uv-space.
    //  3.) (x, y) = (u, -v), because +v is down in 2D screenspace, but +y
    //      is up in 3D worldspace (enforce a right-handed system).
    //  4.) The view vector z controls the "near plane" distance and FOV.
    //      For the effect of "looking through a window" at a CRT, it should be
    //      set equal to the user's distance from their physical screen, in
    //      units of the viewport's physical diagonal size.
    vec2 view_uv = (flat_video_uv - vec2(0.5)) * output_aspect;
    vec3 view_vec_global = vec3(view_uv.x, -view_uv.y, -in_geom_view_dist);
    //  Transform the view vector into the CRT's local coordinate frame, convert
    //  to video_uv coords, and get the local 3D intersection position:
    vec3 view_vec_local = view_vec_global * global_to_local;
    vec3 pos;
    vec2 centered_uv = hrg_view_vec_to_uv(  view_vec_local, 
                                        eye_pos_local, 
                                        output_aspect, 
                                        in_geom_mode, 
                                        in_geom_radius, 
                                        pos);
    vec2 video_uv = centered_uv + vec2(0.5);
    //  Get a pixel-to-tangent-video-uv matrix.  The caller could deal with
    //  all but one of these cases, but that would be more complicated.
    //#ifdef DRIVERS_ALLOW_DERIVATIVES
        //  Derivatives obtain a matrix very fast, but the direction of pixel-
        //  space +y seems to depend on the pass.  Enforce the correct direction
        //  on a best-effort basis (but it shouldn't matter for antialiasing).
        // vec2 duv_dx = dFdx(video_uv);
        // vec2 duv_dy = dFdy(video_uv);
        // // #ifdef LAST_PASS
        //     pixel_to_tangent_video_uv = mat2(    duv_dx.x,   duv_dy.x,
        //                                             -duv_dx.y,  -duv_dy.y);
    //     #else
    //         pixel_to_tangent_video_uv = mat2(   duv_dx.x,   duv_dy.x,
    //                                                 duv_dx.y,   duv_dy.y);
    //     #endif
    // #else
        //  Manually define a transformation matrix.  We'll assume pixel-space
        //  +y = down, just like +v = down.
        bool geom_force_correct_tangent_matrix = true;
        if(geom_force_correct_tangent_matrix)
{
            //  Get the surface normal based on the local intersection position:
            vec3 normal_base = in_geom_mode < 2.5 ?    pos :
                                                    vec3(pos.x, 0.0, pos.z);
            vec3 normal = normalize(normal_base);
            //  Get pixel-to-object and object-to-tangent matrices and combine
            //  them into a 2x2 pixel-to-tangent matrix for video_uv offsets:
            mat3 pixel_to_object = hrg_get_pixel_to_object_matrix(global_to_local, 
                                                                eye_pos_local, 
                                                                view_vec_global, 
                                                                pos, 
                                                                normal,
                                                                output_pixel_size);
            mat3 object_to_tangent = hrg_get_object_to_tangent_matrix(pos, normal, output_aspect, in_geom_mode);
            mat3 pixel_to_tangent3x3 = pixel_to_object * object_to_tangent;
            pixel_to_tangent_video_uv = mat2(   pixel_to_tangent3x3[0][0], pixel_to_tangent3x3[0][1], 
                                                    pixel_to_tangent3x3[1][0], pixel_to_tangent3x3[1][1]);//._m00_m01_m10_m11);
        }
        else
        {
            //  Ignore curvature, and just consider flat scaling.  The
            //  difference is only apparent with strong curvature:
            pixel_to_tangent_video_uv = mat2(   output_pixel_size.x, 0.0, 0.0,                      output_pixel_size.y);
        }
    //#endif
    return video_uv;
}
float HRG_GetBorderDimFactor(vec2 video_uv, vec2 output_aspect, float in_border_size, float in_border_darkness, float in_border_compress)
{
    //  COPYRIGHT NOTE FOR THIS FUNCTION:
    //  Copyright (C) 2010.0 - 2012.0 cgwg, 2014.0 TroggleMonkey
    //  This function uses an algorithm first coded in several of cgwg's GPL-
    //  licensed lines in crt-geom-curved.cg and its ancestors.

    //  Calculate border_dim_factor from the proximity to uv-space image
    //  borders; output_aspect/in_border_size/border/darkness/in_border_compress are globals:
    vec2 edge_dists = min(video_uv, vec2(1.0) - video_uv) * output_aspect;
    vec2 border_penetration = max(vec2(in_border_size) - edge_dists, vec2(0.0));
    float penetration_ratio = length(border_penetration)/in_border_size;
    float border_escape_ratio = max(1.0 - penetration_ratio, 0.0);
    float border_dim_factor = pow(border_escape_ratio, in_border_darkness) * max(1.0, in_border_compress);
    return min(border_dim_factor, 1.0);
}
vec2 hrg_get_aspect_vector(float geom_aspect_ratio)
{
    //  Get an aspect ratio vector.  Enforce geom_max_aspect_ratio, and prevent
    //  the absolute scale from affecting the uv-mapping for curvature:
    float geom_max_aspect_ratio = 4.0 / 3.0;
    float geom_clamped_aspect_ratio = min(geom_aspect_ratio, geom_max_aspect_ratio);
    vec2 output_aspect = normalize(vec2(geom_clamped_aspect_ratio, 1.0));
    return output_aspect;
}
vec2 HRG_GetGeomCurvedCoord(    vec2 in_coord, 
                                float in_geom_mode, 
                                float in_geom_radius, 
                                float in_geom_view_dist,
                                float in_geom_tilt_angle_x, 
                                float in_geom_tilt_angle_y,
                                float in_screen_aspect,
                                float pin_inner_edge,
                                vec2 in_source_size,
                                vec2 in_output_size,
                                out mat2 pixel_to_video_uv)
{
    vec2 output_pixel_size = vec2(1.0, 1.0) / in_output_size;

    float geom_radius_scaled = in_geom_radius;

    vec2 output_aspect = hrg_get_aspect_vector(in_screen_aspect);

    //  Create a local-to-global rotation matrix for the CRT's coordinate
    //  frame and its global-to-local inverse.  Rotate around the x axis
    //  first (pitch) and then the y axis (yaw) with yucky Euler angles.
    //  Positive angles go clockwise around the right-vec and up-vec.
    vec2 geom_tilt_angle = vec2(in_geom_tilt_angle_x, in_geom_tilt_angle_y);
    vec2 sin_tilt = sin(geom_tilt_angle);
    vec2 cos_tilt = cos(geom_tilt_angle);

    //  Conceptual breakdown:
    mat3 rot_x_matrix = mat3(1.0, 0.0, 0.0, 0.0,              cos_tilt.y,     -sin_tilt.y, 0.0,              sin_tilt.y,     cos_tilt.y);
                                
    mat3 rot_y_matrix = mat3(   cos_tilt.x, 0.0,              sin_tilt.x, 0.0, 1.0, 0.0,
                                    -sin_tilt.x, 0.0,              cos_tilt.x);

    mat3 local_to_global = rot_x_matrix * rot_y_matrix;
    //  This is a pure rotation, so transpose = inverse:
    mat3 global_to_local = transpose(local_to_global);

    //  Get an optimal eye position based on in_geom_view_dist, viewport_aspect,
    //  and CRT radius/rotation:
    vec3 eye_pos_global = hrg_get_ideal_global_eye_pos( local_to_global, 
                                                        output_aspect, 
                                                        in_geom_mode, 
                                                        geom_radius_scaled, 
                                                        in_geom_view_dist);
    vec3 eye_pos_local = eye_pos_global * global_to_local;


    vec2 curved_coord;

    if(in_geom_mode > 0.5)
{
        // Put in a test for the projection with a flat plane to compare 
        // with the distorted coordinate to scale out to the edges of the flat plane
        // Also helps with cyndrilical projection where the sides shift in towards the center
        vec2 ctr_curved_coord =  hrg_get_curved_video_uv_coords_and_tangent_matrix( in_coord,
                                                                                        eye_pos_local, 
                                                                                        output_pixel_size, 
                                                                                        output_aspect,
                                                                                        in_geom_mode, 
                                                                                        geom_radius_scaled,
                                                                                        in_geom_view_dist,
                                                                                        global_to_local, 
                                                                                        pixel_to_video_uv) - 0.5;

        // Curvature can cause the screen to shrink so we want to scale it back out so it is the same width & height
        // Especially helps with cylindrical projection which shrinks a lot 
        // Right Edge should end up at 1.0, we scale it back out so it hits 1.0 // Only do this when not using tilt so we don't mess up what the perspective is doing
        if (in_geom_tilt_angle_x == 0.0 && in_geom_tilt_angle_y == 0.0)
{
            vec2 right_edge_curved_ctr_coord =  hrg_get_curved_video_uv_coords_and_tangent_matrix(vec2(1.0, 0.5),
                                                                                            eye_pos_local, 
                                                                                            output_pixel_size, 
                                                                                            output_aspect,
                                                                                            in_geom_mode, 
                                                                                            geom_radius_scaled,
                                                                                            in_geom_view_dist,
                                                                                            global_to_local, 
                                                                                            pixel_to_video_uv) - 0.5;

            vec2 bottom_edge_curved_ctr_coord =  hrg_get_curved_video_uv_coords_and_tangent_matrix(vec2(0.5, 1.0),
                                                                                            eye_pos_local, 
                                                                                            output_pixel_size, 
                                                                                            output_aspect,
                                                                                            in_geom_mode, 
                                                                                            geom_radius_scaled,
                                                                                            in_geom_view_dist,
                                                                                            global_to_local, 
                                                                                            pixel_to_video_uv) - 0.5;

            ctr_curved_coord.x = ctr_curved_coord.x * 0.5 / right_edge_curved_ctr_coord.x;
            ctr_curved_coord.y = ctr_curved_coord.y * 0.5 / bottom_edge_curved_ctr_coord.y;
        }
        if (pin_inner_edge == 1.0)
{
            if (in_geom_tilt_angle_y != 0.0)
{
                vec2 top_edge_curved_ctr_coord =  hrg_get_curved_video_uv_coords_and_tangent_matrix(vec2(0.5, 0.0),
                                                                                                    eye_pos_local, 
                                                                                                    output_pixel_size, 
                                                                                                    output_aspect,
                                                                                                    in_geom_mode, 
                                                                                                    geom_radius_scaled,
                                                                                                    in_geom_view_dist,
                                                                                                    global_to_local, 
                                                                                                    pixel_to_video_uv);
                ctr_curved_coord.y = ctr_curved_coord.y - top_edge_curved_ctr_coord.y;
            }
            if (in_geom_tilt_angle_x != 0.0)
{
                vec2 left_edge_curved_ctr_coord =  hrg_get_curved_video_uv_coords_and_tangent_matrix(vec2(0.0, 0.5),
                                                                                                    eye_pos_local, 
                                                                                                    output_pixel_size, 
                                                                                                    output_aspect,
                                                                                                    in_geom_mode, 
                                                                                                    geom_radius_scaled,
                                                                                                    in_geom_view_dist,
                                                                                                    global_to_local, 
                                                                                                    pixel_to_video_uv);
                ctr_curved_coord.x = ctr_curved_coord.x - left_edge_curved_ctr_coord.x;
            }
        }

        curved_coord = ctr_curved_coord + 0.5;
    }
    else
    {
        curved_coord = in_coord;
        pixel_to_video_uv = mat2( output_pixel_size.x, 0.0, 0.0,                      output_pixel_size.y);
    }

    return curved_coord;
}
float HSM_GetAspectRatioFromMode(float in_aspect_ratio_mode, float in_explicit_aspect)
{                                                  
	float out_explicit_aspect = in_explicit_aspect;

	if (in_aspect_ratio_mode == TEXTURE_ASPECT_MODE_VIEWPORT)
		out_explicit_aspect = OutputSize.x / OutputSize.y;
	if (in_aspect_ratio_mode == TEXTURE_ASPECT_MODE_4_3)
		out_explicit_aspect = 1.33333;
	if (in_aspect_ratio_mode == TEXTURE_ASPECT_MODE_3_4)
		out_explicit_aspect = 0.75;
	if (in_aspect_ratio_mode == TEXTURE_ASPECT_MODE_16_9)
		out_explicit_aspect = 1.7777;
	if (in_aspect_ratio_mode == TEXTURE_ASPECT_MODE_9_16)
		out_explicit_aspect = 0.5625;

	return out_explicit_aspect;
}
vec2 HSM_GetDerezedSize()
{
	return DerezedPassSize.xy;
}
float HSM_GetSwappedScreenIndex(float screen_index)
{
	float out_index = screen_index;

	if (HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS == 1.0)
{
		if (screen_index == 1.0)
{
			out_index = 2.0;
		}
		else
		{
			out_index = 1.0;
		}
	}

	return out_index;
}
vec2 HSM_RotateCoordinate(vec2 in_coord, float rotation)
{
	if (rotation == 0.0)
		return in_coord;
	
	float abs_rotation = abs(rotation);
	vec2 ctr_coord = in_coord - 0.5;

	ctr_coord = (1.0 - abs_rotation) * ctr_coord
				+ clamp(abs_rotation, 0.0, 1.0) * abs_rotation * vec2(-ctr_coord.y, ctr_coord.x)
				+ abs(clamp(abs_rotation, -1.0, 0.0)) * abs_rotation * vec2(ctr_coord.y, -ctr_coord.x);

	if (rotation < 0.0)
		ctr_coord *= -1.0;

	return ctr_coord + 0.5;
}
vec4 HSM_GetTexSampleFromSampleStartAndSize(sampler2D in_sampler, vec2 in_screen_coord, vec2 sample_start_pixel_coord, vec2 window_size)
{
	vec2 core_prepped_size = HSM_GetRotatedDerezedSize();

	if ( HSM_DUALSCREEN_MODE > 0.0 )
		if (HSM_FLIP_CORE_VERTICAL == -1.0)
			in_screen_coord.y = 1.0 - in_screen_coord.y;
			
		// in_screen_coord.y = abs(HSM_FLIP_CORE_VERTICAL) * (1.0 - in_screen_coord.y) + (1.0 - abs(HSM_FLIP_CORE_VERTICAL)) * in_screen_coord.y;
		// in_screen_coord.y = HSM_FLIP_CORE_VERTICAL * (in_screen_coord.y - 0.5) + 0.5;
		
	vec2 px_coord = SAMPLE_AREA_START_PIXEL_COORD + in_screen_coord * window_size;

	vec2 sample_coord = px_coord / core_prepped_size;
	sample_coord =  HSM_RotateCoordinate(sample_coord, HSM_ROTATE_CORE_IMAGE);
	
	vec4 out_color = texture(in_sampler, sample_coord);

	return out_color;
}
vec2 HSM_AddPosScaleToCoord(vec2 in_base_coord, vec2 in_pos, vec2 in_scale)
{
	vec2 positioned_coord = in_base_coord + in_pos;
	vec2 out_coord = HSM_GetInverseScaledCoord(positioned_coord, in_scale);
	return out_coord;
}
vec2 GetSimpleImageScaledCoord(vec2 in_viewport_coord, vec2 in_viewport_unscaled_coord, vec2 in_tube_coord, vec2 in_tube_scale, in sampler2D in_sampler, vec2 in_pos, float in_inherit_pos, vec2 in_scale, float in_scale_inherit_mode, float in_keep_aspect, float in_mirror_horz, float in_rotate )
{
	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;

	vec2 coord_ctr = vec2(1.0);

	if (in_scale_inherit_mode == 0.0)
		coord_ctr = in_viewport_unscaled_coord - 0.5;
	if (in_scale_inherit_mode == 1.0)
		coord_ctr = in_viewport_coord - 0.5;

	if (in_scale_inherit_mode == 2.0)
{
		if (in_inherit_pos < 0.5 || HSM_DUALSCREEN_MODE > 0.5)
			coord_ctr = (in_viewport_coord - 0.5) / in_tube_scale * vec2((in_tube_scale.x / in_tube_scale.y), 1.0) * DEFAULT_SCREEN_HEIGHT; //in_tube_scale.y / (in_tube_scale.y / DEFAULT_SCREEN_HEIGHT);
		else
		 	coord_ctr = (in_tube_coord - 0.5) * vec2((in_tube_scale.x / in_tube_scale.y), 1.0) * DEFAULT_SCREEN_HEIGHT; // / vec2( 1.0 / (in_tube_scale.x / in_tube_scale.y), 1.0);

		// If it's dual screen is on, then the screens are at least half the size,
		// so scale up the image so it covers the whole viewport by default
		if (HSM_DUALSCREEN_MODE > 0.5)
			coord_ctr *= 0.5;
	}

	coord_ctr.x = in_mirror_horz == 1.0 ? -1.0 * coord_ctr.x : coord_ctr.x;
	
	in_viewport_coord = HSM_RotateCoordinate(in_viewport_coord, in_rotate);

	vec2 tex_size = vec2(ivec2(1024, 1024));
	float tex_aspect = in_rotate == 1.0 ? tex_size.y / tex_size.x : tex_size.x / tex_size.y;

	coord_ctr.x *= in_keep_aspect == 1.0 ? output_aspect / tex_aspect : 1.0;
	coord_ctr /= in_rotate > 0.5 ? FinalViewportSize.x / FinalViewportSize.y : 1.0;

	if (in_rotate > 0.5)
{
		coord_ctr = vec2(-coord_ctr.y, -coord_ctr.x);
	}

	return HSM_AddPosScaleToCoord(coord_ctr + 0.5, in_pos, in_scale);
}
vec2 HSM_GetScreenPositionOffset(vec2 placement_image_pos, vec2 screen_scale, float screen_index )
{

	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;


	// If we are not using the image placement then get its offset from the center
	placement_image_pos = HSM_USE_IMAGE_FOR_PLACEMENT == 1.0 && screen_index == 1.0 ? placement_image_pos : vec2(0.5);

	vec2 pos_offset = screen_index == 1.0 ? vec2(HSM_SCREEN_POSITION_X / output_aspect, HSM_SCREEN_POSITION_Y) + (placement_image_pos - 0.5)
										: vec2(HSM_2ND_SCREEN_POS_X / output_aspect, HSM_2ND_SCREEN_POS_Y);

	float split_offset_multiplier = screen_index == 1.0 ? -1.0 : 1.0;

	if (HSM_DUALSCREEN_MODE == 1.0)
{
		if (HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE == 1.0)
			pos_offset.y += HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION + split_offset_multiplier * screen_scale.y * 1.17 / 2.0;
		else
			pos_offset.y += split_offset_multiplier * 0.25;

		pos_offset.y += split_offset_multiplier * HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
	}

	if (HSM_DUALSCREEN_MODE == 2.0)
{
		if (HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE == 1.0)
			pos_offset.x += HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION / output_aspect + split_offset_multiplier * screen_scale.x * 1.17 / 2.0;
		else
			pos_offset.x += split_offset_multiplier * 0.25 / output_aspect;

		pos_offset.x += split_offset_multiplier * HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS / output_aspect;
	}

	return pos_offset;
}
float HSM_GetAverageLuma(sampler2D Source, vec2 SourceSize)
{
   //////// Calculate Average Luminance ////////// 
   float m = max(log2(SourceSize.x), log2(SourceSize.y));
	m = max(m - 1.0, 1.0);
	
	float luma_total = 0.0;
	
	float num_samples = 5.0;
	float sample_dist = 1.0 / (num_samples - 1.0);
	vec4 tex_sample = vec4(0.0);
	for (float i = 0.0; i <= num_samples; i++)
{
		for (float j = 0.0; j <= num_samples; j++)
{
			tex_sample = textureLod(Source, vec2(sample_dist * i, sample_dist * j), m);
			luma_total += max(0.0, (tex_sample.r + tex_sample.g + tex_sample.g) / 3.0);
			// luma_total += max(0.0, length(tex_sample.rgb));
		}
	}
	luma_total = pow(0.577350269 * luma_total / (num_samples * num_samples), 0.6);
   return luma_total;
}
vec3 HSM_GetScreenPlacementAndHeight(sampler2D in_sampler_2D, float num_samples)
{
	if (HSM_USE_IMAGE_FOR_PLACEMENT == 1.0)
{
		float screen_top_y_pos = 1.0;
		float screen_bottom_y_pos = 0.0;

		for (int i = 0; i < int(num_samples); i++)
{
			float y_pos = float(i) * 1.0 / num_samples;
			vec4 sample_color = texture(in_sampler_2D, vec2(0.5, y_pos));
			float test_value = 0.0;
			if (HSM_PLACEMENT_IMAGE_MODE > 0.0)
				test_value = (sample_color.r + sample_color.b + sample_color.g) / 3.0;
			else
				test_value = 1.0 - sample_color.a;

			if (test_value > 0.5)
{
				screen_top_y_pos = min(screen_top_y_pos, y_pos);
				screen_bottom_y_pos = max(screen_bottom_y_pos, y_pos);
			}
		}

		float screen_left_x_pos = 0.75;
		float screen_right_x_pos = 0.25;

		if (HSM_PLACEMENT_IMAGE_USE_HORIZONTAL == 1.0)
			for (int i = 0; i < int(num_samples); i++)
{
				float x_pos = 0.25 + float(i) * 0.5 / num_samples;
				vec4 sample_color = texture(in_sampler_2D, vec2(x_pos, 0.5));
				float test_value = 0.0;
				if (HSM_PLACEMENT_IMAGE_MODE == 1.0)
					test_value = (sample_color.r + sample_color.b + sample_color.g) / 3.0;
				else
					test_value = 1.0 - sample_color.a;

				if (test_value > 0.5)
{
					screen_left_x_pos = min(screen_left_x_pos, x_pos);
					screen_right_x_pos = max(screen_right_x_pos, x_pos);
				}
			}

		return vec3((screen_left_x_pos + screen_right_x_pos) / 2.0, (screen_top_y_pos + screen_bottom_y_pos) / 2.0, screen_bottom_y_pos - screen_top_y_pos);
	}
	else
		return vec3(0.5, 0.5, 1.0);
}
vec2 HSM_GetScreenVTexCoord(vec2 in_coord, vec2 in_screen_scale, vec2 position_offset)
{
	return HSM_GetVTexCoordWithArgs(in_coord, in_screen_scale, position_offset);
}
vec2 HSM_GetCurvatureValues(float screen_aspect)
{
	vec2 curvature_values = screen_aspect < 1.0 ? vec2(2.0 * HSM_CURVATURE_2D_SCALE_SHORT_AXIS * 2.0 / 100.0, HSM_CURVATURE_2D_SCALE_LONG_AXIS * 3.0 / 100.0)
											  : vec2(HSM_CURVATURE_2D_SCALE_LONG_AXIS * 3.0 / 100.0, 2.0 * HSM_CURVATURE_2D_SCALE_SHORT_AXIS * 2.0 / 100.0);
	return curvature_values;
}
vec2 intersect(vec2 in_coord , vec2 sinangle, vec2 cosangle, float in_radius, vec2 in_distance)
{
  float A = dot(in_coord, in_coord) + in_distance.x * in_distance.x;
  float B = 2.0 * (in_radius * (dot(in_coord, sinangle) - in_distance.x * cosangle.x * cosangle.y) - in_distance.x * in_distance.x);
  float C = in_distance.x * in_distance.x + 2.0 * in_radius * in_distance.x * cosangle.x * cosangle.y;
  return vec2((-B-sqrt(B * B - 4.0 * A * C)) / (2.0 * A));
}
vec2 bkwtrans(vec2 in_coord, vec2 sinangle, vec2 cosangle, float in_radius, vec2 in_distance)
{
  vec2 c = intersect(in_coord, sinangle, cosangle, in_radius, in_distance);
  vec2 pt = c * in_coord;
  pt -= vec2(-in_radius) * sinangle;
  pt /= vec2(in_radius);
  vec2 tang = sinangle / cosangle;
  vec2 poc = pt / cosangle;
  float A = dot(tang, tang) + 1.0;
  float B = -2.0 * dot(poc, tang);
  float C = dot(poc,poc)-1.0;
  float a = (-B + sqrt(B * B - 4.0 * A * C)) / (2.0 * A);
  vec2 uv = (pt - a * sinangle) / cosangle;
  float r = FIX(in_radius * acos(a));
  return uv * r / sin(r / in_radius);
}
vec2 fwtrans(vec2 uv, vec2 sinangle, vec2 cosangle, float in_radius, vec2 in_distance)
{
  float r = FIX(sqrt(dot(uv,uv)));
  uv *= sin(r/in_radius)/r;
  float x = 1.0-cos(r/in_radius);
  float D = in_distance.x/in_radius + x*cosangle.x*cosangle.y+dot(uv,sinangle);
  return in_distance.x*(uv*cosangle-x*sinangle)/D;
}
vec3 maxscale(vec2 sinangle, vec2 cosangle, float in_radius, vec2 in_distance, float in_aspect)
{
  vec2 aspect_vec2 = vec2(1.0, 1.0 / in_aspect);
  vec2 c = bkwtrans(-in_radius * sinangle / (1.0 + in_radius/in_distance.x*cosangle.x*cosangle.y), sinangle, cosangle, in_radius, in_distance);
  vec2 a = vec2(0.5,0.5)*aspect_vec2.xy;

  vec2 lo = vec2(	fwtrans(vec2(-a.x,c.y), sinangle, cosangle, in_radius, in_distance).x,
  		 			fwtrans(vec2(c.x,-a.y), sinangle, cosangle, in_radius, in_distance).y)/aspect_vec2.xy;

  vec2 hi = vec2(	fwtrans(vec2(+a.x,c.y), sinangle, cosangle, in_radius, in_distance).x,
  		 			fwtrans(vec2(c.x,+a.y), sinangle, cosangle, in_radius, in_distance).y)/aspect_vec2.xy;

  return vec3((hi+lo)*aspect_vec2.xy*0.5,max(hi.x-lo.x,hi.y-lo.y));
}
vec2 transform(vec2 coord, vec3 stretch, vec2 sinangle, vec2 cosangle, float in_radius, vec2 in_distance, vec2 aspect)
{
  coord = (coord-vec2(0.5))*aspect.xy*stretch.z+stretch.xy;
  return (bkwtrans(coord, sinangle, cosangle, in_radius, in_distance)/aspect.xy+vec2(0.5));
}
vec2 HSM_GetGeomCurvedCoord(vec2 in_coord, float tilt_x, float tilt_y, float in_radius, vec2 in_distance, float in_aspect)
{
	//default radius = 3.5
    //default distance = 2.0
	in_distance *= vec2(1.4);
	vec2 ang = vec2(tilt_x, tilt_y);
	vec2 v_sinangle = sin(ang);
	vec2 v_cosangle = cos(ang);
	vec3 v_stretch = maxscale(v_sinangle, v_cosangle, in_radius, in_distance, in_aspect);
	vec2 aspect_vec2 = vec2(1.0, 1.0 / in_aspect);
	vec2 curved_coord = transform(in_coord, v_stretch, v_sinangle, v_cosangle, in_radius, in_distance, aspect_vec2);

	return curved_coord;
}
vec2 HSM_GetGeomCurvedCoordRetainWidth(vec2 in_coord, float tilt_x, float tilt_y, float in_radius, vec2 in_distance, float in_aspect)
{
	vec2 ctr_curved_coord =  HSM_GetGeomCurvedCoord(in_coord, tilt_x, tilt_y, in_radius, in_distance, in_aspect) - 0.5;
	vec2 right_edge_curved_ctr_coord = HSM_GetGeomCurvedCoord(vec2(1.0, 0.5), tilt_x, tilt_y, in_radius, in_distance, in_aspect) - 0.5;
	ctr_curved_coord.x = ctr_curved_coord.x * 0.5 / right_edge_curved_ctr_coord.x;
	return ctr_curved_coord + 0.5;
}
vec2 HSM_GetGuestCurvedCoord(vec2 in_coord, vec2 in_curvature, float in_curvature_shape)
{
	vec2 pos = in_coord;
	float warpX = in_curvature.x;
	float warpY = in_curvature.y;
	float c_shape = in_curvature_shape;

	pos  = pos*2.0-1.0;    
	pos  = mix(pos, vec2(pos.x*inversesqrt(1.0-c_shape*pos.y*pos.y), pos.y*inversesqrt(1.0-c_shape*pos.x*pos.x)), vec2(warpX, warpY)/c_shape);
	return pos*0.5 + 0.5;
}
vec2 HSM_GetTorridGristleCurvedCoord(vec2 in_coord, vec2 in_curvature){
	// default curvature is vec2(0.031, 0.041
	vec2 Distortion = in_curvature * 15.0;// * vec2(0.031, 0.041);

	vec2 curvedCoords = in_coord * 2.0 - 1.0;
	float curvedCoordsDistance = sqrt(curvedCoords.x*curvedCoords.x+curvedCoords.y*curvedCoords.y);

	curvedCoords = curvedCoords / curvedCoordsDistance;

	curvedCoords = curvedCoords * (1.0-pow(vec2(1.0-(curvedCoordsDistance/1.4142135623730950488016887242097)),(1.0/(1.0+Distortion*0.2))));

	curvedCoords = curvedCoords / (1.0-pow(vec2(0.29289321881345247559915563789515),(1.0/(vec2(1.0)+Distortion*0.2))));

	curvedCoords = curvedCoords * 0.5 + 0.5;
	return curvedCoords;
}
vec2 HSM_GetCrtPiCurvedCoord(vec2 in_coord, vec2 in_curvature)
{
	// Barrel distortion shrinks the display area a bit, this will allow us to counteract that.
	in_curvature *= 5.0;
	vec2 barrelScale = 1.0 - (0.23 * in_curvature);
    in_coord -= vec2(0.5);
    float rsq = in_coord.x * in_coord.x + (HSM_CURVATURE_MODE == 2.0 ? 0.0 : in_coord.y * in_coord.y);
    in_coord += in_coord * (in_curvature * rsq);
    in_coord *= barrelScale;
	in_coord += vec2(0.5);
    return in_coord;
}
vec2 HSM_Get2DCurvedCoord(vec2 in_coord, vec2 curvature_values)
{
	vec2 ctr_curved_coord = vec2(0.0) ;

	ctr_curved_coord = HSM_GetCrtPiCurvedCoord(in_coord, curvature_values) - 0.5;

	vec2 right_edge_curved_ctr_coord = HSM_GetCrtPiCurvedCoord(vec2(1.0, 0.5), curvature_values) - 0.5;
	ctr_curved_coord.x = ctr_curved_coord.x * 0.5 / right_edge_curved_ctr_coord.x;

	vec2 bottom_edge_curved_ctr_coord =  HSM_GetCrtPiCurvedCoord(vec2(0.5, 1.0), curvature_values) - 0.5;
	ctr_curved_coord.y = ctr_curved_coord.y * 0.5 / bottom_edge_curved_ctr_coord.y;

	return ctr_curved_coord + 0.5;
}
vec2 HSM_GetCRTShaderCurvedCoord(vec2 in_coord)
{	
	vec2 out_coord = HSM_GetCurvedCoord(in_coord, 1.0, SCREEN_ASPECT);
	
	if (HHLP_IsOutsideCoordSpace(out_coord))
{
		vec2 tube_scale_ratio = TUBE_SCALE / SCREEN_SCALE;
		out_coord = (out_coord - 0.5) / tube_scale_ratio + 0.5;
	}
	else if (HSM_CRT_CURVATURE_SCALE < 100.0)
		out_coord = HSM_GetCurvedCoord(in_coord, HSM_CRT_CURVATURE_SCALE, SCREEN_ASPECT);

	return out_coord;
}
vec2 HSM_GetMirrorWrappedCoord(vec2 in_coord)
{	
	vec2 ctr_coord = in_coord - 0.5;
	if (abs(ctr_coord.x) > 0.5 || abs(ctr_coord.y) > 0.5 )
		in_coord = ctr_coord / HSM_SCREEN_REFLECTION_SCALE + 0.5 + vec2(HSM_SCREEN_REFLECTION_POS_X, HSM_SCREEN_REFLECTION_POS_Y);

	in_coord = mod(in_coord, 2.0);
	vec2 ctr_mirror_coord = in_coord - 0.5;

	float mirror_x = clamp(clamp(abs(ctr_mirror_coord.x) - 0.5, 0.0, 1.0) * 100000.0, 0.0, 1.0);
	float mirror_y = clamp(clamp(abs(ctr_mirror_coord.y) - 0.5, 0.0, 1.0) * 100000.0, 0.0, 1.0);

	ctr_mirror_coord.x = ctr_mirror_coord.x - mirror_x * 2.0 * sign(ctr_mirror_coord.x) * (abs(ctr_mirror_coord.x) - 0.5);
	ctr_mirror_coord.y = ctr_mirror_coord.y - mirror_y * 2.0 * sign(ctr_mirror_coord.y) * (abs(ctr_mirror_coord.y) - 0.5);

	return ctr_mirror_coord + 0.5;
}
vec2 HSM_GetMirrorWrapCoord(vec2 in_coord)
{
	vec2 ctr_coord = in_coord - 0.5;
	vec2 ctr_mirror_coord = vec2(0.0, 0.0);

	float x_is_outside = clamp((clamp(abs(ctr_coord.x), 0.5, 1.0) - 0.5) * 100000.0, 0.0, 1.0);
	ctr_mirror_coord.x = (1.0 - x_is_outside) * ctr_coord.x + 
						x_is_outside * (ctr_coord.x - 2.0 * sign(ctr_coord.x) * (abs(ctr_coord.x) - 0.5));

	float y_is_outside = clamp((clamp(abs(ctr_coord.y), 0.5, 1.0) - 0.5) * 100000.0, 0.0, 1.0);
	ctr_mirror_coord.y = (1.0 - y_is_outside) * ctr_coord.y + 
						y_is_outside * (ctr_coord.y - 2.0 * sign(ctr_coord.y) * (abs(ctr_coord.y) - 0.5));

	return ctr_mirror_coord + 0.5;
}
vec2 HSM_GetTubeCurvedCoord(vec2 screen_coord, float curvature_scale, vec2 screen_scale, vec2 tube_scale, float screen_aspect, float apply_black_edge_offset)
{
	vec2 black_edge_scale_offset = tube_scale / screen_scale;

	// Get the curved coordinate
	vec2 tube_curved_coord = vec2(0.5, 0.5);

	if (HSM_BZL_USE_INDEPENDENT_CURVATURE == 1.0)
{
		vec2 curvature_values = screen_aspect < 1.0 ? vec2(2.0 * HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS * 2.0 / 100.0, HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS * 3.0 / 100.0)
											: vec2(HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS * 3.0 / 100.0, 2.0 * HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS * 2.0 / 100.0);
		curvature_values *= curvature_scale * HSM_BZL_INNER_CURVATURE_SCALE;
		tube_curved_coord = HSM_Get2DCurvedCoord(screen_coord, curvature_values);
	}
	else
	{
		tube_curved_coord = HSM_GetCurvedCoord(screen_coord, curvature_scale * HSM_BZL_INNER_CURVATURE_SCALE, screen_aspect);
	}
	if (apply_black_edge_offset == 1.0)
		tube_curved_coord = HSM_GetInverseScaledCoord(tube_curved_coord, black_edge_scale_offset);

	return tube_curved_coord;
}
vec3 evaluateLight(in vec3 pos)
{
    vec3 lightPos = LPOS;
    vec3 lightCol = LCOL;
    vec3 L = lightPos-pos;
    return lightCol * 1.0/dot(L,L);
}
float HSM_rand(inout float r)
{
	r = fract(3712.65 * r + 0.61432);
	return (r - 0.5) * 2.0;
}
vec4 HSM_GetStoichaicBlurredSample(sampler2D in_sampler, vec2 in_coord, float num_samples, float max_blur_size, float blur_ratio)
{
	if (num_samples < 1.0)
		return texture(in_sampler, in_coord);

	// Common value for max_blur_size is about 40.0
	float p = blur_ratio * max_blur_size / SourceSize.y;
	vec4 blurred_color = vec4(0.0);
	// srand
	float radius = sin(dot(in_coord, vec2(1233.224, 1743.335)));
	vec2 radius_vector;
	
	vec2 sample_coord = vec2(0.0);

	// The following are all unrolled otherwise they won't compile in D3D11
	if (num_samples < 1.5)
{
		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 1.0;
	}

	if (num_samples < 2.5)
{
		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 2.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 2.0;
	}

	if (num_samples > 2.5)
{
		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;

		radius_vector.x = HSM_rand(radius);
		radius_vector.y = HSM_rand(radius);
		sample_coord = in_coord + radius_vector * p;

		blurred_color += texture(in_sampler, abs(sample_coord)) / 12.0;
	}

	return blurred_color;
}
bool HSM_GetIsInABCompareArea(vec2 viewport_coord)
{
	float test_value = HSM_AB_COMPARE_AREA > 1.5 ? viewport_coord.y : viewport_coord.x;
	float position = mod(HSM_AB_COMPARE_AREA, 2.0) == 1.0 ? (1.0 - HSM_AB_COMPARE_SPLIT_POSITION) : HSM_AB_COMPARE_SPLIT_POSITION;
	return  mod(HSM_AB_COMPARE_AREA, 2.0) == 0.0 && test_value < position || 
			mod(HSM_AB_COMPARE_AREA, 2.0) == 1.0 && test_value > position;
}
vec4 HSM_GetMipmappedTexSample(sampler2D in_sampler, vec2 in_coord, vec2 in_scale, float in_blend_bias)
{
	vec2 tex_size = vec2(ivec2(1024, 1024));
	vec2 scaled_tex_size = in_scale * FinalViewportSize.xy;
	float mipmap_lod = log2(tex_size.y / scaled_tex_size.y);
	return textureLod(in_sampler, in_coord, mipmap_lod + in_blend_bias);
}
vec4 HSM_GetCroppedTexSample(sampler2D in_sampler, vec2 in_screen_coord)
{
	return HSM_GetTexSampleFromSampleStartAndSize(in_sampler, in_screen_coord, SAMPLE_AREA_START_PIXEL_COORD, CROPPED_ROTATED_SIZE);
}
float HSM_GetVignetteFactor(vec2 coord, float amount, float size)
{
	float orig_mamehlsl_amount = amount;
	vec2 ctr_coord = coord - 0.5;

	float vignette_length = length(ctr_coord * vec2(0.5 / size * OutputSize.x/OutputSize.y + 0.5, 1.0));
	float vignette_blur = (orig_mamehlsl_amount * 0.75) + 0.25;

	// 0.5 full screen fitting circle
	float vignette_radius = 1.0 - (orig_mamehlsl_amount * 0.25);
	float vignette = smoothstep(vignette_radius, vignette_radius - vignette_blur, vignette_length);

	float vignette_multiplier = smoothstep(0.0, 0.05, amount);
	return 1.0 - vignette_multiplier + vignette * vignette_multiplier;
}
bool HSM_GetUseOnCurrentScreenIndex(float dual_screen_vis_mode)
{
	return dual_screen_vis_mode == SHOW_ON_DUALSCREEN_MODE_BOTH || dual_screen_vis_mode == SCREEN_INDEX;
}
vec4 HSM_GetNightLightingMultiplyColor( vec2 in_coord, float hue, float saturation, float value, float contrast, float global_ambient_opacity, in sampler2D NightLightingImage )
{
	vec4 lighting_image = vec4(0.0);
	// if (HSM_AMBIENT1_DITHERING_SAMPLES > 0.5)
	// {
	// 	// Dithering if needed to reduce banding
	// 	float blur_max_size = 1.0;
	// 	float blur_amount = 0.2;
	// 	lighting_image = HSM_GetStoichaicBlurredSample(NightLightingImage, in_coord.xy, HSM_AMBIENT1_DITHERING_SAMPLES, blur_max_size, blur_amount);
	// }
	// else
	lighting_image = HSM_GetMipmappedTexSample(NightLightingImage, in_coord.xy, vec2(1.0), 0.0);
	lighting_image = HSM_Linearize(lighting_image, DEFAULT_SRGB_GAMMA);

	lighting_image = contrast * (lighting_image - 0.5) + 0.5;

	// Do HSV alterations on the night lighting image
	if (hue != 0.0 || saturation != 1.0 || value != 1.0)
{
		vec3 night_lighting_image_hsv = HSM_RGBtoHSV(lighting_image.rgb);
		night_lighting_image_hsv.x += hue;
		night_lighting_image_hsv.y *= saturation;
		night_lighting_image_hsv.z *= value;
		lighting_image = vec4(HSM_HSVtoRGB(night_lighting_image_hsv), lighting_image.a);
	}

	lighting_image.rgb = mix( vec3(1.0), lighting_image.rgb, global_ambient_opacity );

	return lighting_image;
}
bool HSM_Fill_Ambient_Images(vec2 in_viewport_coord, vec2 in_viewport_unscaled_coord, vec2 in_tube_coord, vec2 in_tube_scale, float in_swap_images, in sampler2D in_ambient_sampler, in sampler2D in_ambient2_sampler, inout vec4 ambient_lighting_image, inout vec4 ambient2_lighting_image)
{
		ambient_lighting_image = vec4(1.0);
		ambient2_lighting_image = vec4(1.0);

		if (HSM_AMBIENT1_OPACITY > 0.0)
{
			float ambient1_scale = HSM_AMBIENT1_SCALE;
			if (HSM_AMBIENT1_SCALE_INHERIT_MODE == 1.0 && HSM_AMBIENT1_SCALE * HSM_VIEWPORT_ZOOM < 1.0)
				ambient1_scale = 1.0 / HSM_VIEWPORT_ZOOM;

			vec2 lighting_coord = GetSimpleImageScaledCoord(in_viewport_coord, 
															in_viewport_unscaled_coord,
															in_tube_coord,
															in_tube_scale,
															in_ambient_sampler,
															vec2(HSM_AMBIENT1_POSITION_X, HSM_AMBIENT1_POSITION_Y),
															HSM_AMBIENT1_POS_INHERIT_MODE, 
															vec2(ambient1_scale * HSM_AMBIENT1_SCALE_X, ambient1_scale), 
															HSM_AMBIENT1_SCALE_INHERIT_MODE, 
															HSM_AMBIENT1_SCALE_KEEP_ASPECT,
															HSM_AMBIENT1_MIRROR_HORZ,
															HSM_AMBIENT1_ROTATE );

			ambient_lighting_image = HSM_GetNightLightingMultiplyColor( lighting_coord,
																		HSM_AMBIENT1_HUE,
																		HSM_AMBIENT1_SATURATION,
																		HSM_AMBIENT1_VALUE,
																		HSM_AMBIENT1_CONTRAST,
																		HSM_AMBIENT1_OPACITY,
																		in_ambient_sampler );
		}

		if (HSM_AMBIENT2_OPACITY > 0.0)
{
			float ambient2_scale = HSM_AMBIENT2_SCALE;
			if (HSM_AMBIENT2_SCALE_INHERIT_MODE == 1.0 && HSM_AMBIENT2_SCALE * HSM_VIEWPORT_ZOOM < 1.0)
				ambient2_scale = 1.0 / HSM_VIEWPORT_ZOOM;

			vec2 lighting2_coord = GetSimpleImageScaledCoord(in_viewport_coord, 
															in_viewport_unscaled_coord,
															in_tube_coord,
															in_tube_scale,
															in_ambient2_sampler,
															vec2(HSM_AMBIENT2_POSITION_X, HSM_AMBIENT2_POSITION_Y),
															HSM_AMBIENT2_POS_INHERIT_MODE, 
															vec2(ambient2_scale * HSM_AMBIENT2_SCALE_X, ambient2_scale), 
															HSM_AMBIENT2_SCALE_INHERIT_MODE, 
															HSM_AMBIENT2_SCALE_KEEP_ASPECT,
															HSM_AMBIENT2_MIRROR_HORZ,
															HSM_AMBIENT2_ROTATE );

			ambient2_lighting_image = HSM_GetNightLightingMultiplyColor( lighting2_coord,
																		HSM_AMBIENT2_HUE,
																		HSM_AMBIENT2_SATURATION,
																		HSM_AMBIENT2_VALUE,
																		HSM_AMBIENT2_CONTRAST,
																		HSM_AMBIENT2_OPACITY,
																		in_ambient2_sampler );
		}

	// if (in_swap_images == 1.0)
	// {
	// 	vec4 temp_image = ambient_lighting_image;
	// 	ambient_lighting_image = ambient2_lighting_image;
	// 	ambient2_lighting_image = temp_image;
	// }

	return true;
}
vec3 ApplyAmbientImages(vec3 base_image, vec3 ambient_image, vec3 ambient2_image, float blend_ambient, float blend_ambient2, float apply_in_add_mode, float layer_blend_mode, float swap_images)
{
	vec3 outImage = base_image;

	if (swap_images == 1.0)
		ambient2_image = ambient_image;
	if (swap_images == 2.0)
		ambient_image = ambient2_image;
	if (swap_images == 3.0)
{
		vec3 temp_image = ambient_image;
		ambient_image = ambient2_image;
		ambient2_image = temp_image;
	}

	if ( (HSM_AMBIENT1_OPACITY > 0.0 || HSM_AMBIENT2_OPACITY > 0.0) && (blend_ambient > 0.0 || blend_ambient2 > 0.0) )
{
		if(	apply_in_add_mode == 1.0 || layer_blend_mode != BLEND_MODE_ADD)
{
			if (blend_ambient > 0.0)
{
				outImage = (1.0 - blend_ambient) * outImage.rgb + blend_ambient * outImage.rgb * ambient_image.rgb;
			}
			if (blend_ambient2 > 0.0)
{
				outImage = (1.0 - blend_ambient2) * outImage.rgb + blend_ambient2 * outImage.rgb * ambient2_image.rgb;
			}
		}
	}

	return outImage;
}
float HSM_GetTubeOpacity()
{
	float tube_diffuse_opacity = HSM_TUBE_DIFFUSE_MODE < 1.5 ? HSM_TUBE_OPACITY : 0.0;

	// If CRT Blend Mode is Multiply(2.0) then the tube must be fully opaque
	if (HSM_CRT_BLEND_MODE == 2.0)
		tube_diffuse_opacity = 1.0;

	return tube_diffuse_opacity;
}
vec3 HSM_ApplyAmbientImage(vec3 base_image, vec3 ambient_image, float layer_blend_amount)
{
	if (layer_blend_amount > 0.0)
		return (1.0 - layer_blend_amount) * base_image.rgb + layer_blend_amount * base_image.rgb * ambient_image.rgb;
	else
		return base_image;
}
bool HSM_GetUseFakeScanlines()
{
	float scane_axis_core_res = USE_VERTICAL_SCANLINES * CROPPED_ROTATED_SIZE_WITH_RES_MULT.x + (1.0 - USE_VERTICAL_SCANLINES) * CROPPED_ROTATED_SIZE_WITH_RES_MULT.y;
	return HSM_FAKE_SCANLINE_OPACITY > 0.001 && (HSM_FAKE_SCANLINE_MODE == 1.0 || (HSM_FAKE_SCANLINE_MODE == 2.0 && scane_axis_core_res > HSM_INTERLACE_TRIGGER_RES));
}
float HSM_GetNoScanlineMode()
{
	// If Use Fake Scanlines is On then turn off Guest Scanlines as they will just look bad
	float scan_res = (1.0 - USE_VERTICAL_SCANLINES) * CROPPED_ROTATED_SIZE_WITH_RES_MULT.y + 
						USE_VERTICAL_SCANLINES *  CROPPED_ROTATED_SIZE_WITH_RES_MULT.x;

	return no_scanlines > 0.5 || HSM_GetUseFakeScanlines() || HSM_INTERLACE_MODE < 0.0 && HSM_INTERLACE_TRIGGER_RES <= scan_res ? 1.0 : 0.0;
}
vec4 HSM_ApplyScanlineMask(vec4 in_color, vec2 screen_scale, vec2 in_coord, vec2 in_screen_curved_coord, vec2 in_tube_curved_coord, float in_scanline_opacity)
{
	//   Stuff to try implementing
    //   Try mame hlsl darkening
    //   Check Lottes tone mapping

	in_coord = mix(in_coord, in_screen_curved_coord, HSM_FAKE_SCANLINE_CURVATURE);

    /* Scanlines */
	float scanline_roll_offset = float(mod(FrameCount, 1280.0)) / 1280.0 * HSM_FAKE_SCANLINE_ROLL; 

    // float scans = clamp( 0.35+0.18*sin(6.0*time-curved_uv.y*resolution.y*1.5), 0.0, 1.0);
    // float s = pow(scans,0.9);
    // col = col * vec3(s);

	float scan_axis_pos = USE_VERTICAL_SCANLINES > 0.5 ? in_coord.x : in_coord.y;
	scan_axis_pos += scanline_roll_offset;

	vec2 screen_size = OutputSize.xy * screen_scale;
	float scan_axis_screen_scale_res = USE_VERTICAL_SCANLINES > 0.5 ? screen_size.x : screen_size.y;
	
	float cropped_rotated_scan_res = USE_VERTICAL_SCANLINES > 0.5 ? CROPPED_ROTATED_SIZE.x : CROPPED_ROTATED_SIZE.y;
	float simulated_scanline_res = HSM_FAKE_SCANLINE_RES_MODE > 0.5 ? HSM_FAKE_SCANLINE_RES : cropped_rotated_scan_res;

	float scanline_size = scan_axis_screen_scale_res / simulated_scanline_res;

	if (HSM_FAKE_SCANLINE_INT_SCALE == 1.0)
		scanline_size = ceil(scanline_size);

	float scan = mod(scan_axis_pos * scan_axis_screen_scale_res + scanline_size, scanline_size) / scanline_size;

	// Alternate, modulating the scanline width depending on brightness
	//float scanline_mask = HHLP_EasePowerOut(1.0 - abs(scan - 0.5) * 2.0, 0.5 + 2.0 * smoothstep(0.4, 0.9, (in_color.r + in_color.g +  in_color.b) / 3.0));
	float color_brightness_modulation = HHLP_EasePowerOut(smoothstep(0.4, 0.99, (in_color.r + in_color.g +  in_color.b) / 3.0), 2.0);

	float scanline_mask = 1.0 - abs(scan - 0.5) * 2.0;
	scanline_mask = pow(1.0 - scanline_mask, 1.0);

	float final_scanline_mask = clamp(1.0 * scanline_mask, 0.0, 1.0);

	color_brightness_modulation = HHLP_EasePowerOut(smoothstep(0.4, HSM_FAKE_SCANLINE_BRIGHTNESS_CUTOFF + 1.5, (in_color.r + in_color.g +  in_color.b) / 3.0), 2.0);
	final_scanline_mask = clamp(mix(1.0, mix(final_scanline_mask, 1.0, color_brightness_modulation), in_scanline_opacity), 0.0, 1.0);

	vec4 masked_color = in_color;
	masked_color *= 1.0 + 0.5 * in_scanline_opacity;
	masked_color = clamp(final_scanline_mask * masked_color, 0.0, 1.0);
	masked_color.w = in_color.w;

	// Darken the outside image a bit
	vec4 crt_darkened_color = mix(in_color, in_color * 0.9, HSM_FAKE_SCANLINE_OPACITY);

	// Show scanlines only in the tube area
	float softened_tube_mask = HSM_GetCornerMask((in_tube_curved_coord - 0.5) * 0.995 + 0.5 , TUBE_DIFFUSE_ASPECT, HSM_BZL_INNER_CORNER_RADIUS_SCALE * HSM_GLOBAL_CORNER_RADIUS, 0.05);
	vec4 out_color = mix(crt_darkened_color, masked_color, softened_tube_mask);

	return clamp(out_color, 0.0, 1.0);
}
vec4 HSM_Apply_Sinden_Lightgun_Border(vec4 in_rgba, vec2 in_tube_diffuse_curved_coord, float in_tube_diffuse_mask, float in_black_edge_corner_radius)
{
	float sinden_gun_mask =  in_tube_diffuse_mask - HSM_GetCornerMask((in_tube_diffuse_curved_coord - 0.5) * (1.0 + vec2(1.0 / TUBE_DIFFUSE_ASPECT * HSM_SINDEN_BORDER_THICKNESS, HSM_SINDEN_BORDER_THICKNESS)) + 0.5, TUBE_DIFFUSE_ASPECT, in_black_edge_corner_radius, 0.99);
	vec4 out_rgba = in_rgba;

	vec3 base_rgb = vec3(1.0);
	out_rgba.rgb = base_rgb * HSM_SINDEN_BORDER_BRIGHTNESS * sinden_gun_mask + (1.0 - sinden_gun_mask) * out_rgba.rgb;

	// out_rgba.rgb += HSM_SINDEN_BORDER_OPACITY * sinden_gun_mask;
	return out_rgba;
}
vec2 HSM_ApplyOverscan(vec2 in_coord, float overscan_x, float overscan_y)
{
	vec2 ctr_coord = in_coord * 2.0 - 1.0;

	ctr_coord /= vec2(overscan_x, overscan_y) + 1.0;

	return ctr_coord * 0.5 + 0.5;
}
float HSM_GetRasterBloomScale(float raster_bloom_overscan_mode, float raster_bloom_mult, float screen_avg_luma)
{
	// Define the neutral range around the center
	float neutral_range = HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;

	// Calculate the bloom scale based on the neutral range
	float bloom_scale = 1.0;
	float neutral_center = HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
	float neutral_min = neutral_center - neutral_range;
	float neutral_max = neutral_center + neutral_range;
	float adjusted_luma = neutral_center;
	if (screen_avg_luma < 0.5 - neutral_range || screen_avg_luma > 0.5 + neutral_range)
{
		if (screen_avg_luma < neutral_min) 
			adjusted_luma = neutral_center * HHLP_EasePowerIn(smoothstep(0.0, neutral_min, screen_avg_luma), 2.0);

		if (screen_avg_luma > neutral_max) 
			adjusted_luma = neutral_center + (1.0 - neutral_center) * HHLP_EasePowerOut(smoothstep(neutral_max, 1.0, screen_avg_luma), 2.0);
	}
	bloom_scale = 1.00 + raster_bloom_mult * ((1.0 - 0.5 * raster_bloom_overscan_mode) - adjusted_luma);
	return bloom_scale;
}
vec2 HSM_ApplyRasterBloomOverscan(vec2 in_coord, float raster_bloom_overscan_mode, float raster_bloom_mult, float screen_avg_luma)
{
	//raster_bloom_overscan_mode can be 0.0, 1.0, or 2.0 to adjust if the bloom can only expand or shrink

	vec2 ctr_coord = in_coord * 2.0 - 1.0;

	float raster_bloom_factor = HSM_GetRasterBloomScale(raster_bloom_overscan_mode, raster_bloom_mult, screen_avg_luma);
	ctr_coord *= vec2(raster_bloom_factor, raster_bloom_factor);

	return ctr_coord * 0.5 + 0.5;
}
vec2 HSM_GetCrtShaderFinalCoord(vec2 screen_coord,
								vec2 screen_scale,
								float raster_bloom_avg_lum,
								inout vec2 screen_curved_coord
								)
{
	// -- START -- This section repeated in function below
	screen_curved_coord = HSM_GetCRTShaderCurvedCoord(screen_coord);

	// Get the Mirrored coord and then add overscan to it
	vec2 screen_curved_coord_with_overscan_and_mirror = HSM_GetMirrorWrappedCoord(screen_curved_coord);
	screen_curved_coord_with_overscan_and_mirror = HSM_ApplyOverscan(screen_curved_coord_with_overscan_and_mirror, HSM_OVERSCAN_X, HSM_OVERSCAN_Y);

	if (HSM_OVERSCAN_RASTER_BLOOM_ON > 0.5)
{
		screen_curved_coord_with_overscan_and_mirror = HSM_ApplyRasterBloomOverscan(screen_curved_coord_with_overscan_and_mirror, 
			HSM_OVERSCAN_RASTER_BLOOM_MODE, 
			HSM_OVERSCAN_RASTER_BLOOM_AMOUNT, 
			raster_bloom_avg_lum);
	}
	// -- END -- Repeated Section

	return screen_curved_coord_with_overscan_and_mirror;
}
vec2 HSM_GetCrtShaderFinalCoordExtraVariables(vec2 screen_coord,
	vec2 screen_scale,
	float raster_bloom_avg_lum,
	inout vec2 screen_curved_coord,
	inout vec2 screen_curved_coord_with_overscan,
	inout vec2 screen_coord_with_overscan,
	inout vec2 screen_scale_with_overscan)
{
	// -- START -- This section repeated from function above
	screen_curved_coord = HSM_GetCRTShaderCurvedCoord(screen_coord);

	// Get the Mirrored coord and then add overscan to it
	vec2 screen_curved_coord_with_overscan_and_mirror = HSM_GetMirrorWrappedCoord(screen_curved_coord);
	screen_curved_coord_with_overscan_and_mirror = HSM_ApplyOverscan(screen_curved_coord_with_overscan_and_mirror, HSM_OVERSCAN_X, HSM_OVERSCAN_Y);

	if (HSM_OVERSCAN_RASTER_BLOOM_ON > 0.5)
{
		screen_curved_coord_with_overscan_and_mirror = HSM_ApplyRasterBloomOverscan(screen_curved_coord_with_overscan_and_mirror, 
			HSM_OVERSCAN_RASTER_BLOOM_MODE, 
			HSM_OVERSCAN_RASTER_BLOOM_AMOUNT, 
			raster_bloom_avg_lum);
	}
	// -- END -- Repeated Section

	// Screen Coordinate overscan but without curvature 
	// Screen Curved Coordinate but not Mirrored
	screen_curved_coord_with_overscan = HSM_ApplyOverscan(screen_curved_coord, HSM_OVERSCAN_X, HSM_OVERSCAN_Y);
	screen_scale_with_overscan = screen_scale * (vec2(HSM_OVERSCAN_X, HSM_OVERSCAN_Y) + 1.0);

	if (HSM_OVERSCAN_RASTER_BLOOM_ON > 0.5)
{
		screen_curved_coord_with_overscan = HSM_ApplyRasterBloomOverscan(screen_curved_coord_with_overscan, 
			HSM_OVERSCAN_RASTER_BLOOM_MODE, 
			HSM_OVERSCAN_RASTER_BLOOM_AMOUNT, 
			raster_bloom_avg_lum);

		screen_coord_with_overscan = HSM_ApplyRasterBloomOverscan(screen_coord_with_overscan, 
			HSM_OVERSCAN_RASTER_BLOOM_MODE, 
			HSM_OVERSCAN_RASTER_BLOOM_AMOUNT, 
			raster_bloom_avg_lum);

		screen_scale_with_overscan *= HSM_GetRasterBloomScale(HSM_OVERSCAN_RASTER_BLOOM_MODE, 
			HSM_OVERSCAN_RASTER_BLOOM_AMOUNT, 
			raster_bloom_avg_lum);
	}

	screen_coord_with_overscan = HSM_ApplyOverscan(screen_coord, HSM_OVERSCAN_X, HSM_OVERSCAN_Y);

	return screen_curved_coord_with_overscan_and_mirror;
}
vec2 HSM_GetOuterBezelScale(vec2 tube_diffuse_scale, float screen_aspect)
{
	vec2 bezel_outer_scale_offset = vec2(HSM_BZL_WIDTH / screen_aspect + 1.0, HSM_BZL_HEIGHT + 1.0);
	return bezel_outer_scale_offset;
}
vec2 GetDefaultScreenScale()
{
	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;
	vec2 out_placement_scale = DEFAULT_UNCORRECTED_SCREEN_SCALE;
	out_placement_scale.x /= output_aspect;
	return out_placement_scale;
}
vec2 GetDefaultBezelScale()
{
	float output_aspect = FinalViewportSize.x / FinalViewportSize.y;
	vec2 out_placement_scale = DEFAULT_UNCORRECTED_BEZEL_SCALE;
	out_placement_scale.x /= output_aspect;
	return out_placement_scale;
}
float HSM_GetSimpleBezelCoords(vec2 tube_diffuse_coord, 
								vec2 tube_diffuse_scale, 
								vec2 tube_scale, 
								float screen_aspect,
								inout vec2 bezel_outside_coord, 
								inout vec2 frame_outside_coord)
{
	float output_aspect = OutputSize.x / OutputSize.y;

	vec2 bezel_outer_pos_offset = vec2(0.0, HSM_BZL_OUTER_POSITION_Y);
	vec2 bezel_outer_scale_offset = HSM_GetOuterBezelScale(tube_diffuse_scale, screen_aspect);

	bezel_outside_coord = tube_diffuse_coord + bezel_outer_pos_offset;

	vec2 black_edge_scale_offset = tube_scale / tube_diffuse_scale;

	bezel_outside_coord = HSM_GetInverseScaledCoord(bezel_outside_coord, black_edge_scale_offset * bezel_outer_scale_offset) + vec2(0.0, HSM_BZL_OUTER_POSITION_Y);
	frame_outside_coord = (bezel_outside_coord + 
							vec2(0.0, HSM_FRM_OUTER_POS_Y) - 0.5) / 
							vec2((HSM_FRM_THICKNESS * HSM_FRM_THICKNESS_SCALE_X) / 
							(tube_diffuse_scale.x / tube_diffuse_scale.y * output_aspect) + 1.0, 
							HSM_FRM_THICKNESS + 1.0) + 0.5;
	return 0.0;
}
bool HSM_GetUseTubeStaticReflection()
{
	return HSM_TUBE_STATIC_REFLECTION_IMAGE_ON > 0.5 && HSM_GetUseOnCurrentScreenIndex(HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE);
}
bool HSM_GetUseTubeDiffuseImage()
{
	return HSM_TUBE_DIFFUSE_MODE == 1.0 && HSM_GetUseOnCurrentScreenIndex(HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE);
}
bool HSM_GetUseTubeColoredGelImage()
{
	return HSM_TUBE_COLORED_GEL_IMAGE_ON > 0.5 && HSM_GetUseOnCurrentScreenIndex(HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE);
}
float GetMask(float mask_mode)
{
	float mask = 	(mask_mode == MASK_MODE_ALL) ? 1.0 :
					(mask_mode == MASK_MODE_SCREEN) ? TUBE_DIFFUSE_MASK :
					(mask_mode == MASK_MODE_TUBE) ? TUBE_MASK :
					(mask_mode == MASK_MODE_INSIDE_BEZEL) ? INSIDE_BEZEL_MASK :
					(mask_mode == MASK_MODE_BEZEL) ? BEZEL_MASK :
					(mask_mode == MASK_MODE_OUTSIDE_TUBE) ? OUTSIDE_TUBE_MASK_FOR_IMAGE :
					(mask_mode == MASK_MODE_FRAME) ? FRAME_MASK :
					(mask_mode == MASK_MODE_OUTSIDE_BEZEL) ? OUTSIDE_BEZEL_MASK :
					(mask_mode == MASK_MODE_OUTSIDE_FRAME) ? OUTSIDE_FRAME_MASK : 0.5;
	return mask;
}
vec4 BlendModeMaskLayerMix(vec4 color_under, vec4 color_over, float blend_mode, float mask_mode, float cutout_mode, float dualscreen_mode, float layer_opacity)
{
	if ( blend_mode == 0.0 || (dualscreen_mode != SHOW_ON_DUALSCREEN_MODE_BOTH && dualscreen_mode != SCREEN_INDEX) )
		return color_under;
	
	float cutout_mask = 1.0;
	if (cutout_mode == CUTOUT_MODE_INSIDE)
		cutout_mask = CUTOUT_MASK;
	if (cutout_mode == CUTOUT_MODE_OUTSIDE)
		cutout_mask = 1.0 - CUTOUT_MASK;

	if (blend_mode == BLEND_MODE_OFF)
		return color_under;
	
	color_over.a *= layer_opacity * GetMask(mask_mode) * cutout_mask;

	vec4 out_color = vec4(0.0);

	if (blend_mode == BLEND_MODE_NORMAL)
{
		color_over.rgb *= color_over.a;
		out_color = HSM_PreMultAlphaBlend(color_under, color_over);
	}
	else
	{
		vec4 blend_color = color_under; 
		if (blend_mode == BLEND_MODE_ADD)  	 		blend_color.rgb = color_under.rgb + color_over.rgb ;
		if (blend_mode == BLEND_MODE_MULTIPLY)  	blend_color.rgb = color_under.rgb * color_over.rgb ;

		out_color = vec4(clamp(mix(color_under.rgb, blend_color.rgb, color_over.a), 0.0, 1.0), color_under.a);
	}
	return out_color;
}
vec2 HSM_GetLayerCoord(vec2 in_viewport_coord, float layer_to_follow, float follow_mode, inout vec2 out_placement_scale)
{
	vec2 flat_coord = vec2(0.5);
	vec2 curved_coord = vec2(0.5);
	vec2 out_coord = vec2(0.5);

	if (layer_to_follow == FOLLOW_LAYER_VIEWPORT)
{
		flat_coord = in_viewport_coord;
		curved_coord = in_viewport_coord;
	}
	else if (layer_to_follow == FOLLOW_LAYER_TUBE_DIFFUSE)
{
		flat_coord = TUBE_DIFFUSE_COORD;
		curved_coord = TUBE_DIFFUSE_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_BEZEL_OUTSIDE)
{
		flat_coord = BEZEL_OUTSIDE_COORD;
		curved_coord = BEZEL_OUTSIDE_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_BG)
{
		flat_coord = BACKGROUND_COORD;
		curved_coord = BACKGROUND_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_DEVICE)
{
		flat_coord = DEVICE_COORD;
		curved_coord = DEVICE_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_DECAL)
{
		flat_coord = DECAL_COORD;
		curved_coord = DECAL_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_CAB_GLASS)
{
		flat_coord = CAB_GLASS_COORD;
		curved_coord = CAB_GLASS_CURVED_COORD;
	}
	else if (layer_to_follow == FOLLOW_LAYER_TOP)
{
		flat_coord = TOP_IMAGE_COORD;
		curved_coord = TOP_IMAGE_CURVED_COORD;
	}

	out_coord = follow_mode == FOLLOW_MODE_EXACT ? curved_coord : flat_coord;

	return  out_coord;
}
vec2 HSM_GetScaledCoord(vec2 in_viewport_coord,
						vec2 in_viewport_coord_unscaled,
						float texture_aspect_mode,
						float explicit_texture_aspect,
						vec2 offset_pos,
						vec2 offset_scale,
						float layer_to_follow,
						float follow_mode,
						float scale_full_with_zoom,
						float image_fill_mode,
						float split_preserve_center,
						float split_repeat_width,
						bool apply_default_scale_offset,
						// float image_rotation_mode,
						// float explicit_image_rotation,
						inout vec2 out_placement_coord,
						inout vec2 out_placement_scale)
{
	float texture_aspect = HSM_GetAspectRatioFromMode(texture_aspect_mode, explicit_texture_aspect);

	/*
	bool is_rotated = false;
	// float image_rotation_mode = 1.0; // Modes, 0.0: explicit, 1.0: Rotate To Vertical Core Aspect, 2.0: Rotate To Vertical Viewport Aspect
	// // vert core aspect rotation, vert vertical aspect rotation
	// // rotate with tube ?
	float explicit_image_rotation = 0.0;
	float image_rotation = explicit_image_rotation;

	// if (image_rotation_mode == 1.0)
	// 	image_rotation = SCREEN_ASPECT < 1.0 ? 1.0 : 0.0;
	
	if (min(abs(image_rotation), 1.0) > 0.5)
{
		texture_aspect = 1.0 / texture_aspect;
		offset_pos = vec2(offset_pos.y, -offset_pos.x);
		offset_scale = offset_scale.yx;
		is_rotated = true;
	}
	*/

	vec2 inherited_coord = in_viewport_coord / 0.5;
	vec2 inherited_placement_coord = in_viewport_coord / 0.5;
	vec2 inherited_final_coord = in_viewport_coord / 0.5;
	vec2 inherited_scale = vec2(0.5);
	vec2 default_offset_scale = vec2(0.5);

	if (layer_to_follow == FOLLOW_LAYER_VIEWPORT)
{
		if (scale_full_with_zoom > 0.5)
{
			inherited_coord = in_viewport_coord;
			inherited_placement_coord = in_viewport_coord;
		}
		else
		{
			inherited_coord = in_viewport_coord_unscaled;
			inherited_placement_coord = in_viewport_coord_unscaled;
		}

		inherited_final_coord = inherited_coord;

		inherited_scale = vec2(1.0, 1.0);
		default_offset_scale = vec2(1.0);
	}
	else if (layer_to_follow == FOLLOW_LAYER_TUBE_DIFFUSE)
{
/*
		if (is_rotated)
{
			inherited_coord = TUBE_DIFFUSE_COORD;
			inherited_placement_coord = TUBE_DIFFUSE_COORD;
			inherited_final_coord = TUBE_DIFFUSE_CURVED_COORD;

			inherited_scale = TUBE_DIFFUSE_SCALE;

			default_offset_scale = vec2(1.0) / DEFAULT_UNCORRECTED_SCREEN_SCALE.y;
			default_offset_scale.x *= texture_aspect / (1.0 / DEFAULT_SCREEN_ASPECT);
		}
		else
		{
*/
			inherited_coord = TUBE_DIFFUSE_COORD;
			inherited_placement_coord = TUBE_DIFFUSE_COORD;
			inherited_final_coord = TUBE_DIFFUSE_CURVED_COORD;

			inherited_scale = TUBE_DIFFUSE_SCALE;

			default_offset_scale = vec2(1.0) / (DEFAULT_UNCORRECTED_SCREEN_SCALE.y);
			default_offset_scale.x *= texture_aspect / DEFAULT_SCREEN_ASPECT;
		// }

	}
	else if (layer_to_follow == FOLLOW_LAYER_BEZEL_OUTSIDE)
{
/*
		if (is_rotated)
{
			inherited_coord = BEZEL_OUTSIDE_COORD;
			inherited_placement_coord = BEZEL_OUTSIDE_COORD;

			inherited_scale = BEZEL_OUTSIDE_SCALE;
			inherited_final_coord = BEZEL_OUTSIDE_CURVED_COORD;

			default_offset_scale = vec2(1.0) / DEFAULT_UNCORRECTED_BEZEL_SCALE.y;
			default_offset_scale.x *= texture_aspect / (1.0 / DEFAULT_BEZEL_ASPECT);
		}
		else
		{
*/
			inherited_coord = BEZEL_OUTSIDE_COORD;
			inherited_placement_coord = BEZEL_OUTSIDE_COORD;

			inherited_scale = BEZEL_OUTSIDE_SCALE;
			inherited_final_coord = BEZEL_OUTSIDE_CURVED_COORD;

			default_offset_scale = vec2(1.0) / (DEFAULT_UNCORRECTED_BEZEL_SCALE.y);
			default_offset_scale.x *= texture_aspect / DEFAULT_SCREEN_ASPECT;
		// }
	}
	else if (layer_to_follow == FOLLOW_LAYER_BG)
{
		inherited_coord = BACKGROUND_COORD;
		inherited_placement_coord = BACKGROUND_COORD;
		inherited_final_coord = BACKGROUND_CURVED_COORD;

		inherited_scale = BACKGROUND_SCALE;
		default_offset_scale = vec2(1.0);
	}
	else if (layer_to_follow == FOLLOW_LAYER_DEVICE)
{
		inherited_coord = DEVICE_COORD;
		inherited_placement_coord = DEVICE_COORD;
		inherited_final_coord = DEVICE_CURVED_COORD;

		inherited_scale = DEVICE_SCALE;
		default_offset_scale = vec2(1.0);
	}
	else if (layer_to_follow == FOLLOW_LAYER_DECAL)
{
		inherited_coord = DECAL_COORD;
		inherited_placement_coord = DECAL_COORD;
		inherited_final_coord = DECAL_CURVED_COORD;

		inherited_scale = DECAL_SCALE;
		default_offset_scale = vec2(1.0);
	}

	//--------------------------------
	// RETURN if we want to use the exact same coordinate of the layer we follow
	//--------------------------------
	if (follow_mode == FOLLOW_MODE_EXACT)
{
		out_placement_coord = HSM_AddPosScaleToCoord(inherited_placement_coord, offset_pos, offset_scale);
		out_placement_scale = inherited_scale * offset_scale;
		return HSM_AddPosScaleToCoord(inherited_final_coord, offset_pos, offset_scale);
	}

	if (apply_default_scale_offset)
{
		offset_scale *= default_offset_scale;
	}

	float output_aspect = OutputSize.x / OutputSize.y;
	float inherited_aspect = (inherited_scale.x / inherited_scale.y) * (default_offset_scale.x / default_offset_scale.y) * output_aspect;
	
	// Find the aspect difference so the image can be shown without distortion
	// This is before the user edited scale offset
	float inherited_aspect_difference = texture_aspect / inherited_aspect;

	// Get the overall scale for the placement of the texture (No Split/Fill Yet)
	out_placement_scale = inherited_scale;
	if ( image_fill_mode == FILL_MODE_KEEP_TEXTURE_ASPECT )
		out_placement_scale.x *= inherited_aspect_difference;
	out_placement_scale = out_placement_scale * offset_scale;

	// inherited_coord = out_placement_coord;
	out_placement_coord = HSM_AddPosScaleToCoord(inherited_placement_coord, offset_pos, out_placement_scale / inherited_scale);

	vec2 out_coord = vec2(0.5);

	vec2 drawing_scale = out_placement_scale;
	float slide_x = 0.0;

	if ( image_fill_mode == FILL_MODE_SPLIT )
{
		float abs_ctr_coord_x = abs(out_placement_coord.x - 0.5);
		// Correct the aspect so it matches the texture and is never stretched
		float placement_aspect = out_placement_scale.x / out_placement_scale.y * output_aspect;
		float placement_aspect_difference = texture_aspect / placement_aspect;
		drawing_scale.x *= placement_aspect_difference;

		float center_width = split_preserve_center * placement_aspect_difference;
		if ( abs_ctr_coord_x > center_width)
{
			slide_x = ((placement_aspect - texture_aspect) / placement_aspect) / 2.0;
		}

		float repeat_width = split_repeat_width * placement_aspect_difference;
		if (abs_ctr_coord_x > center_width && 
			abs_ctr_coord_x < center_width + slide_x && 
			repeat_width > 0.0)
{
			if (clamp(split_repeat_width - 0.001, 0.0, 1.0) == 0.0)
				slide_x = (abs_ctr_coord_x - center_width);
			else
				slide_x = (abs_ctr_coord_x - 0.001 - center_width) - mod(clamp(abs_ctr_coord_x - 0.01 - center_width, 0.0, 1.0), repeat_width);
		}

		if ( out_placement_coord.x < 0.5 )
			slide_x *= -1.0;
		inherited_coord.x -= slide_x;
	}

	// The inherited_coord is already the coord from the inherited space
	// We only need to apply an offset from this
	out_coord = HSM_AddPosScaleToCoord(inherited_coord, offset_pos, drawing_scale / inherited_scale);

/*
	if (is_rotated)
		out_coord = HSM_RotateCoordinate(out_coord, image_rotation);
*/

	return out_coord;
}

precision highp int;

in vec2 vTexCoord;
in vec2 UNFLIPPED_VIEWPORT_COORD;
in vec3 BEZEL_FRAME_ORIGINAL_COLOR_RGB;

out vec4 FragColor;

// Pass Framebuffer Textures
uniform sampler2D InfoCachePass;

uniform sampler2D BackgroundImage;
uniform sampler2D BackgroundVertImage;
uniform sampler2D NightLightingImage;
uniform sampler2D NightLighting2Image;

uniform sampler2D LEDImage;
uniform sampler2D FrameTextureImage;
uniform sampler2D DeviceImage;
uniform sampler2D DeviceVertImage;
uniform sampler2D DeviceLEDImage;
uniform sampler2D DecalImage;
uniform sampler2D CabinetGlassImage;
uniform sampler2D TopLayerImage;
uniform sampler2D ReflectionMaskImage;

#ifdef LAYERS_OVER_CRT
uniform sampler2D BR_LayersOverCRTPassFeedback;
#define PassFeedback BR_LayersOverCRTPassFeedback
#else
uniform sampler2D BR_LayersUnderCRTPassFeedback;
#endif

//////////////////////////////////////////////////////////////////////////////////////////////////
void main()
{
  // Initialize global variables (WebGL doesn't support initialized non-const globals)
  SCREEN_INDEX = 1.0;
  CURVATURE_MODE_OFF = 0.0;
  CURVATURE_MODE_2D = 1.0;
  CURVATURE_MODE_2D_CYLINDER = 2.0;
  CURVATURE_MODE_3D_1 = 3.0;
  CURVATURE_MODE_3D_2 = 4.0;
  CURVATURE_MODE_3D_CYLINDER = 5.0;
  MAX_LAYER_ORDER = 12.0;
  FILL_MODE_SPLIT = 1.0;
  FILL_MODE_STRETCH = 2.0;

	if (HSM_AB_COMPARE_FREEZE_GRAPHICS == 1.0 && HSM_GetIsInABCompareArea(vTexCoord))
	{
		FragColor = texture(PassFeedback, vTexCoord);
		return;
	}

	VIEWPORT_UNSCALED_COORD = HSM_GetViewportCoordWithFlip(vTexCoord);
	VIEWPORT_COORD = HSM_GetViewportCoordWithZoomAndPan(vTexCoord);

	HSM_UpdateGlobalScreenValuesFromCache(InfoCachePass, vTexCoord);

	vec4 feedback_color_test = texture(PassFeedback, vec2(0.0, 0.0));
	if (HSM_CACHE_GRAPHICS_ON > 0.5 && feedback_color_test.a < 0.0 && !CACHE_INFO_CHANGED)
	{
		FragColor = texture(PassFeedback, UNFLIPPED_VIEWPORT_COORD);
		return;
	}

	// AMBIENT LIGHTING IMAGES
	vec4 ambient_image = vec4(1.0);
	vec4 ambient2_image = vec4(1.0);
	HSM_Fill_Ambient_Images(VIEWPORT_COORD, VIEWPORT_UNSCALED_COORD, TUBE_DIFFUSE_COORD, TUBE_DIFFUSE_SCALE, HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE, NightLightingImage, NightLighting2Image, ambient_image, ambient2_image);

	TUBE_DIFFUSE_CURVED_COORD = HSM_GetCurvedCoord(SCREEN_COORD, HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE, TUBE_DIFFUSE_ASPECT);

	// TODO this should probably just use TUBE_COORD
	// TODO should probably use TUBE_ASPECT
	vec2 tube_curved_coord = HSM_GetTubeCurvedCoord(TUBE_DIFFUSE_COORD, 1.0, TUBE_DIFFUSE_SCALE, TUBE_SCALE, TUBE_DIFFUSE_ASPECT, 1.0);
	vec2 tube_curved_coord_ctr = tube_curved_coord - 0.5;
	vec2 edge_mask_coord = tube_curved_coord_ctr * (1.0 - (HSM_BZL_INNER_EDGE_THICKNESS / vec2(TUBE_DIFFUSE_ASPECT, 1.0))) + 0.5;

	float bezel_corner_radius = HSM_BZL_INNER_CORNER_RADIUS_SCALE * HSM_GLOBAL_CORNER_RADIUS;
	if(HSM_BZL_USE_INDEPENDENT_CURVATURE > 0.0)
		bezel_corner_radius = HSM_BZL_INNER_CORNER_RADIUS_SCALE * DEFAULT_SCREEN_CORNER_RADIUS;
	
	float edge_mask =  HSM_GetCornerMask(edge_mask_coord, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, HSM_BZL_INNER_EDGE_SHARPNESS);

	TUBE_MASK = HSM_GetCornerMask(tube_curved_coord, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, 0.99);

	// Shrink the mask by 0.001 to clip off outer edge
	TUBE_DIFFUSE_MASK = HSM_GetCornerMask(((TUBE_DIFFUSE_CURVED_COORD - 0.5) * 1.001) + 0.5, TUBE_DIFFUSE_ASPECT, HSM_GLOBAL_CORNER_RADIUS * HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE, HSM_TUBE_BLACK_EDGE_SHARPNESS);

	//----------------------------------------------------
	//  Calculate Outside mapping Coords
	//----------------------------------------------------

	/* This first big chunk is to get a mapping of the space outside of the screen which is continuous
	This is more complicated than you would expect because since we are using curved coordinates 
	there are discontinuities outside the normal screen corners, e.g. where x > 1.0 and y > 1.0
	So instead of trying to use the coordinates from the screen/tube we use a larger space 
	and subtract the screen space to see how far we are outside of the sreen
	*/

	// Additional scale to be applied to the tube scale to create an expanded mapping area 
	float outermap_scale = 2.3;

	// Get a range width from the outer tube edge to the outer edge of the outermap
	float outermap_range = 0.5 * outermap_scale * 0.7;
	vec2 outermap_screen_size_from_center = vec2(0.5, 0.5);
	vec2 outermap_warped_outside_screen_vector = (tube_curved_coord_ctr - clamp(tube_curved_coord_ctr, -0.490, 0.490)) * vec2(1.0 / TUBE_DIFFUSE_ASPECT, 1.0);
	float output_aspect = OutputSize.x / OutputSize.y;
	float outside_ratio_warped = clamp(length(outermap_warped_outside_screen_vector) / outermap_range, 0.0, 1.0);
	vec2 outermap_screen_corner_ctr_coord = vec2(0.5, -0.5);

	// Get a coordinate offset so it is centered around the corner
	vec2 outermap_coord_warped_ctr_at_screen_corner = abs(tube_curved_coord_ctr) - vec2(0.5);

	// Have to get the scale of the coordinates so we can figure out the size of the onscreen rectangle of the area 
	HSM_GetBezelCoords(TUBE_DIFFUSE_COORD, 
						TUBE_DIFFUSE_SCALE, 
						TUBE_SCALE, 
						TUBE_DIFFUSE_ASPECT, 
						true,
						BEZEL_OUTSIDE_SCALE,
						BEZEL_OUTSIDE_COORD, 
						BEZEL_OUTSIDE_CURVED_COORD, 
						FRAME_OUTSIDE_CURVED_COORD);

	OUTSIDE_BEZEL_MASK = 1.0 - HSM_GetCornerMask(BEZEL_OUTSIDE_CURVED_COORD, TUBE_DIFFUSE_ASPECT, HSM_GLOBAL_CORNER_RADIUS * HSM_BZL_OUTER_CORNER_RADIUS_SCALE, 0.9);

	// Get color for the frame area outside of the bezel
	vec2 frame_outside_coord_ctr = FRAME_OUTSIDE_CURVED_COORD - 0.5;
	float SHADOW_OUTSIDE_FRAME_MASK = 1.0 - HSM_GetCornerMask(frame_outside_coord_ctr * 1.01 + 0.5, TUBE_DIFFUSE_ASPECT, HSM_FRM_OUTER_CORNER_RADIUS, 1.0);
	OUTSIDE_FRAME_MASK = 1.0 - HSM_GetCornerMask(frame_outside_coord_ctr + 0.5, TUBE_DIFFUSE_ASPECT, HSM_FRM_OUTER_CORNER_RADIUS, 1.0);
	OUTSIDE_FRAME_MASK_FOR_IMAGE = 1.0 - HSM_GetCornerMask(frame_outside_coord_ctr * 0.999 + 0.5, TUBE_DIFFUSE_ASPECT, HSM_FRM_OUTER_CORNER_RADIUS, 1.0);
	// Get masks for shadows, from frame as well as sides and top and bottom of viewport
	INSIDE_BEZEL_MASK = 1.0 - OUTSIDE_BEZEL_MASK;
	BEZEL_MASK = INSIDE_BEZEL_MASK * (1.0 - TUBE_MASK);
	FRAME_MASK = OUTSIDE_BEZEL_MASK * (1.0 - OUTSIDE_FRAME_MASK);

#ifdef LAYERS_UNDER_CRT
	//----------------------------------------------------
	//  Calculate Corner Highlight Mask
	//----------------------------------------------------
	const float pi = 3.1415;

	// Get amount to shift the point at the outer corner to match the overall position offset
	vec2 pos_shift_offset = vec2(0.0, HSM_BZL_OUTER_POSITION_Y) * TUBE_DIFFUSE_SCALE.y / outermap_scale;
	pos_shift_offset *= tube_curved_coord.y > 0.5 ? 1.0 : -1.0;

	// Get the direction vector from the inner corner of the bezel pointing at the outer corner 
	vec2 corner_crease_dir = (outermap_screen_corner_ctr_coord + pos_shift_offset) / vec2(HSM_BZL_HEIGHT + 1.0, HSM_BZL_WIDTH + 1.0) - (outermap_screen_corner_ctr_coord) ;
	corner_crease_dir *= vec2(TUBE_DIFFUSE_ASPECT, 1.0);

	float aspect_corner_length_scale_offset = TUBE_DIFFUSE_ASPECT > 1.0 ? 0.9 : 1.5;
	float corner_crease_length = length(corner_crease_dir * aspect_corner_length_scale_offset);

	// A hack to adjust the angle offset, because without it the corner angle isn't pointing exactly at the corner
	// This offset is the opposite direction for vertical and horizontal aspect ratio
	float corner_rotation_offset = (SCREEN_COORD.y < 0.5) ? -HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP : -HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;

	if (HSM_CURVATURE_MODE == 0.0)
		// If we are using a 3d Curvature no offset is necessary
		corner_rotation_offset += (TUBE_DIFFUSE_ASPECT > 1.0) ? 2.0 : 3.0;

	// Convert direction vector to an angle so we can rotate the corner crease direction
	float corner_angle_degrees = atan(corner_crease_dir.y / corner_crease_dir.x) / (2.0 * pi) * 360.0;

	corner_angle_degrees += corner_rotation_offset;
	float corner_angle_radians = corner_angle_degrees / 360.0 * 2.0 * pi;
	corner_crease_dir = vec2(cos(corner_angle_radians), sin(corner_angle_radians));

	// Get the distance perpendicular to the crease direction so we can use it to fade later
	float distance_from_crease = HHLP_GetDistanceToLine(outermap_coord_warped_ctr_at_screen_corner.x, outermap_coord_warped_ctr_at_screen_corner.y, 1.0, corner_crease_dir.y / corner_crease_dir.x, 0.0 );

	float fade_out_to_corner = HHLP_QuadraticBezier(clamp(length(outermap_warped_outside_screen_vector) / (corner_crease_length * 2.0), 0.0, 1.0), vec2(0.5, HSM_REFLECT_CORNER_SPREAD_FALLOFF / 100.0));

	float corner_fade_width_inner = HSM_REFLECT_CORNER_INNER_SPREAD * (TUBE_DIFFUSE_SCALE.x + TUBE_DIFFUSE_SCALE.y) * bezel_corner_radius / 10.0 / 250.0 * 1.2;
	float corner_fade_width_outer = HSM_REFLECT_CORNER_OUTER_SPREAD * (TUBE_DIFFUSE_SCALE.x + TUBE_DIFFUSE_SCALE.y) * HSM_GLOBAL_CORNER_RADIUS * HSM_BZL_OUTER_CORNER_RADIUS_SCALE / 10.0 / 250.0 * 1.6;
	float corner_fade_width = (corner_fade_width_inner + fade_out_to_corner * (corner_fade_width_outer - corner_fade_width_inner));

	// Get a vector perpendicular to the crease that we can shift the crease to blend between bottom/top and sides
	vec2 corner_crease_perp_dir = normalize(vec2(corner_crease_dir.y, corner_crease_dir.x));
	vec2 corner_coord_shifted = outermap_coord_warped_ctr_at_screen_corner - corner_crease_perp_dir * corner_fade_width / 2.0;
	vec2 corner_crease_dir_shifted = corner_crease_dir - corner_crease_perp_dir * corner_fade_width / 2.0;

	// Get the distance to this shifted crease
	float distance_from_crease_shifted = HHLP_GetDistanceToLine(corner_coord_shifted.x, corner_coord_shifted.y, 1.0, corner_crease_dir_shifted.y / corner_crease_dir_shifted.x, 0.0 );

	float top_half_mask = smoothstep(0.55, 0.5, tube_curved_coord.y);
	float left_half_mask = smoothstep(0.55, 0.5, tube_curved_coord.x);

	// Get a mask which transitions between sides and top/bottom at the corner crease  
	float top_bottom_vs_sides_mask = dot(normalize(corner_coord_shifted), normalize(corner_crease_dir_shifted)) > 0.0 ? 1.0 - smoothstep(0.0, corner_fade_width / 2.0, distance_from_crease_shifted) : 1.0;

	// Masks isolating specific parts
	float sides_mask = 1.0 - top_bottom_vs_sides_mask;
	float top_mask = top_half_mask * top_bottom_vs_sides_mask;
	float bottom_mask = (1.0 - top_half_mask) * top_bottom_vs_sides_mask;

	float corner_mask = smoothstep(corner_fade_width / 2.0, 0.0, distance_from_crease);

	float top_corner_mask = corner_mask * top_half_mask;
	float bottom_corner_mask = corner_mask * (1.0 - top_half_mask);

	float frame_inner_edge_mask = (HSM_FRM_INNER_EDGE_THICKNESS == 0.0) ? 0.0 : 1.0 - HSM_GetCornerMask(	(BEZEL_OUTSIDE_CURVED_COORD - 0.5) * (1.0 + (HSM_FRM_INNER_EDGE_THICKNESS / vec2(TUBE_DIFFUSE_ASPECT, 1.0))) + 0.5, 
																										TUBE_DIFFUSE_ASPECT, 
																										HSM_BZL_OUTER_CORNER_RADIUS_SCALE * HSM_GLOBAL_CORNER_RADIUS, 
																										0.9);
	float outside_tube_mask_wider = 1.0 - HSM_GetCornerMask(tube_curved_coord_ctr * 0.996 + 0.5, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, 0.9);
	float tube_shadow_mask = HSM_GetCornerMask(tube_curved_coord_ctr + 0.5, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, 0.0);
	float tube_edge_shadow_mult = HSM_BZL_INNER_EDGE_SHADOW * (tube_shadow_mask) + (1.0 - HSM_BZL_INNER_EDGE_SHADOW);

	float edge_highlight_mask = 0.0;

	// ----------------------------------------------------
	// Generated Bezel
	// ----------------------------------------------------

	/* This first bit is to get a mapping of the space outside of the screen which is continuous
	This is more complicated than you would expect because since we are using curved coordinates 
	there are discontinuities outside the normal screen corners, e.g. where x > 1.0 and y > 1.0
	So instead of trying to use the coordinates from the screen/tube we use a larger space 
	and subtract the screen space to see how far we are outside of the sreen
	*/

	float hmbz_bezel_highlight_edge = 0.9;
	float hmbz_bezel_highlight_top = 0.2;
	float hmbz_bezel_highlight_bottom = 0.3;
	float hmbz_bezel_highlight_sides = 0.2;
	
	float hmbz_bezel_highlight_falloff_speed = 0.5;
	float hmbz_bezel_highlight_width = 0.25;

	float hmbz_bezel_edge_highlight_width = 0.8;
	
	float hmbz_bezel_brightness_frame_outer_edge = 0.0;
	float hmbz_brightness_shadow = 0.0;
	float hmbz_frame_brightness = 100.0;

	// Not sure why we need linearize this but it seems to have a smoother range this way
	vec3 base_color = HSM_Linearize(vec4(HSM_HSVtoRGB(vec3(HSM_BZL_COLOR_HUE, HSM_BZL_COLOR_SATURATION, HSM_BZL_COLOR_VALUE)), 1.0), DEFAULT_SRGB_GAMMA).rgb;
	float noise_mask = clamp(fract(sin(dot(tube_curved_coord_ctr + vec2(0.5, 0.5) + 1.0, vec2(12.9898, 78.233))) * 43758.5453), 0.0, 1.0);
	vec3 base_color_with_noise = mix(base_color, 1.5 * base_color * noise_mask, HSM_BZL_NOISE);
	vec3 top_color = HSM_BZL_BRIGHTNESS_MULT_TOP * HSM_BZL_BRIGHTNESS * base_color_with_noise;
	vec3 bottom_color = HSM_BZL_BRIGHTNESS_MULT_BOTTOM * HSM_BZL_BRIGHTNESS * base_color_with_noise;
	vec3 sides_color = mix(HSM_BZL_BRIGHTNESS_MULT_SIDES * HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT * HSM_BZL_BRIGHTNESS * base_color_with_noise,
							HSM_BZL_BRIGHTNESS_MULT_SIDES * HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT * HSM_BZL_BRIGHTNESS * base_color_with_noise,
							left_half_mask);

	vec3 frame_base_color = base_color;
	vec3 frame_base_color_with_noise = base_color_with_noise;
	if (HSM_FRM_USE_INDEPENDENT_COLOR > 0.0)
	{
		frame_base_color = HSM_Linearize(vec4(HSM_HSVtoRGB(vec3(HSM_FRM_COLOR_HUE, HSM_FRM_COLOR_SATURATION, HSM_FRM_COLOR_VALUE)), 1.0), DEFAULT_SRGB_GAMMA).rgb;
		frame_base_color_with_noise = mix(frame_base_color, 1.5 * frame_base_color * noise_mask, HSM_FRM_NOISE);
	}

	vec3 frame_color = hmbz_frame_brightness / 100.0 * mix(frame_base_color, 1.5 * frame_base_color * noise_mask, 0.6 * HSM_FRM_NOISE);
	vec3 outside_frame_color = hmbz_brightness_shadow * base_color_with_noise;

	vec3 bezel_diffuse_color = mix(sides_color, top_color, top_mask);
	bezel_diffuse_color = mix(bezel_diffuse_color, bottom_color, bottom_mask);

	float top_center_highlight_mask 	= hmbz_bezel_highlight_top * top_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_highlight_width, 0.0, abs(tube_curved_coord_ctr.x)), vec2(0.5, hmbz_bezel_highlight_falloff_speed));
	float bottom_center_highlight_mask 	= hmbz_bezel_highlight_bottom * bottom_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_highlight_width, 0.0, abs(tube_curved_coord_ctr.x)), vec2(0.5, hmbz_bezel_highlight_falloff_speed));
	float sides_highlight_mask 			= hmbz_bezel_highlight_sides * sides_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_highlight_width, 0.0, abs(tube_curved_coord_ctr.y)), vec2(0.5, hmbz_bezel_highlight_falloff_speed));

	float edge_top_center_highlight_mask 		= hmbz_bezel_highlight_top * top_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_edge_highlight_width, 0.0, abs(tube_curved_coord_ctr.x)), vec2(0.8, 0.0));
	float edge_bottom_center_highlight_mask 	= hmbz_bezel_highlight_bottom * bottom_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_edge_highlight_width, 0.0, abs(tube_curved_coord_ctr.x)), vec2(0.8, 0.0));
	float edge_sides_highlight_mask 			= hmbz_bezel_highlight_sides * sides_mask * HHLP_QuadraticBezier(smoothstep(hmbz_bezel_edge_highlight_width, 0.0, abs(tube_curved_coord_ctr.y)), vec2(0.8, 0.0));

	edge_highlight_mask = hmbz_bezel_highlight_edge * edge_mask * (edge_top_center_highlight_mask + edge_bottom_center_highlight_mask + edge_sides_highlight_mask);
	edge_highlight_mask *= HSM_BZL_INNER_EDGE_HIGHLIGHT;

	// Combine all the individual highlights into one mask
	float combined_highlight_mask = (1.0 + 2.5 * HSM_BZL_NOISE) * (1.0 - noise_mask * 2.5 * HSM_BZL_NOISE) * (top_center_highlight_mask + bottom_center_highlight_mask + sides_highlight_mask);
	float bezel_highlight_multiplier = HSM_BZL_HIGHLIGHT * combined_highlight_mask + HSM_BZL_HIGHLIGHT * edge_highlight_mask;
	vec3 bezel_color = bezel_diffuse_color * (1.0 + 15.0 * bezel_highlight_multiplier) + 1.0 * bezel_highlight_multiplier;

	// Add the inner edge highlight on top of the bezel color which has it's own highlight
	float inner_edge_highlight_multiplier = HSM_FRM_INNER_EDGE_HIGHLIGHT + HSM_BZL_HIGHLIGHT * 10.0 * HSM_FRM_INNER_EDGE_HIGHLIGHT;
	vec3 frame_inner_edge_color = frame_base_color * (1.0 + 15.0 * inner_edge_highlight_multiplier) +	0.5 * inner_edge_highlight_multiplier;

	bezel_color = mix(bezel_color, frame_inner_edge_color, frame_inner_edge_mask);

	float dist_inside_outer_edge = min(0.50 - abs(frame_outside_coord_ctr.x), 0.50 - abs(frame_outside_coord_ctr.y));
	float frame_outer_edge_width = HSM_FRM_OUTER_EDGE_THICKNESS;
	vec3 frame_diffuse_color = mix(frame_color, 0.2 * frame_color, HSM_FRM_OUTER_EDGE_SHADING * smoothstep(frame_outer_edge_width, 0.0, dist_inside_outer_edge));

	if (HSM_FRM_TEXTURE_OPACITY > 0.0)
	{
		// TODO need to do Mipmapping sample?
		vec4 frame_texture_color = HSM_Linearize(texture(FrameTextureImage, FRAME_OUTSIDE_CURVED_COORD), DEFAULT_SRGB_GAMMA);
		frame_diffuse_color = HSM_BlendModeLayerMix(vec4(frame_diffuse_color, 1.0), frame_texture_color, HSM_FRM_TEXTURE_BLEND_MODE, HSM_FRM_TEXTURE_OPACITY).rgb;
	}

	// Composite in color from outside the bezel
	vec3 bezel_and_frame_rgb = mix(bezel_color, frame_diffuse_color, OUTSIDE_BEZEL_MASK);

	// Get masks on side of frame to multiply together to get a shadow around the frame
	// Get vector from the screen edge outward
	float frame_edge = 0.495;
	float dist_outside_frame = length(clamp(abs(frame_outside_coord_ctr * 1.01) - frame_edge, 0.0, 1.0) * vec2(TUBE_DIFFUSE_ASPECT, 1.0));

	vec4 frame_shadow_layer = vec4(0.0);
	if (HSM_FRM_OPACITY > 0.001)
		frame_shadow_layer.a = SHADOW_OUTSIDE_FRAME_MASK * HHLP_QuadraticBezier(smoothstep(HSM_FRM_SHADOW_WIDTH, 0.0, dist_outside_frame), vec2(1.0, 0.0));

	//----------------------------------------------------
	// Generated Bezel
	//----------------------------------------------------

	vec4 bezel_layer = vec4(0.0);
	vec4 frame_layer = vec4(0.0);

	if (HSM_BZL_OPACITY > 0.0 || HSM_FRM_OPACITY > 0.0)
	{
		// Create image of bezel & frame with outside of frame transparent
		vec4 bezel_and_frame_rgba = vec4(bezel_and_frame_rgb, 1.0);

		// Cut out Tube Area
		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			bezel_and_frame_rgba = HSM_ApplyGamma(bezel_and_frame_rgba, HSM_STATIC_LAYERS_GAMMA);

		bezel_and_frame_rgba.rgb = ApplyAmbientImages(bezel_and_frame_rgba.rgb,
															ambient_image.rgb,
															ambient2_image.rgb,
															HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER,
															HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER, 1.0,
															HSM_BZL_BLEND_MODE,
															HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);

		// Contract the tube mask to leave a little extra black ring at the edge of the bezel
		// otherwise this will show slivers of the background otherwise
		float tube_mask_contracted = HSM_GetCornerMask((tube_curved_coord - 0.5) * 1.004 + 0.5, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, 0.99);
		float FRAME_AND_BEZEL_MASK = (1.0 - tube_mask_contracted) * (1.0 - OUTSIDE_FRAME_MASK);

		if (HSM_BZL_OPACITY > 0.0 || HSM_FRM_OPACITY > 0.0)
			bezel_layer = clamp(bezel_and_frame_rgba * FRAME_AND_BEZEL_MASK, 0.0, 1.0);

		frame_shadow_layer *= HSM_FRM_SHADOW_OPACITY;

		if (HSM_FRM_SHADOW_OPACITY > 0.0)
			bezel_layer = BlendModeMaskLayerMix(frame_shadow_layer,
													bezel_layer, 
													BLEND_MODE_NORMAL, 
													MASK_MODE_ALL, 0.0, 
													SHOW_ON_DUALSCREEN_MODE_BOTH, 1.0);


		float bezel_opacity_mult = HSM_BZL_OPACITY + OUTSIDE_BEZEL_MASK * (1.0 - HSM_BZL_OPACITY);
		float frame_opacity_mult = HSM_FRM_OPACITY + (1.0 - OUTSIDE_BEZEL_MASK) * (1.0 - HSM_FRM_OPACITY);

		bezel_layer *= bezel_opacity_mult * frame_opacity_mult;
	}

	float TUBE_MASK_EXPAND = HSM_GetCornerMask((tube_curved_coord - 0.5) * 0.997 + 0.5, TUBE_DIFFUSE_ASPECT, bezel_corner_radius, 0.99);
	
	// vec4 tube_bg_layer = vec4(0.0, 0.0, 0.0, TUBE_MASK_EXPAND * HSM_GetTubeOpacity());
	vec4 tube_bg_layer = vec4(0.0, 0.0, 0.0, 0.0);

// end of ifndef LAYERS_UNDER_CRT
#endif

	//-----------------------------------------------------------------------------------------
	// Background
	//-----------------------------------------------------------------------------------------
	bool bg_use_vert_image = SCREEN_ASPECT < 1.0 && vec2(ivec2(1024, 1024)).y > 16.0 ? true : false; 
	vec2 bg_size = bg_use_vert_image ? vec2(ivec2(1024, 1024)) : vec2(ivec2(1024, 1024));
	BACKGROUND_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
												VIEWPORT_UNSCALED_COORD,
												TEXTURE_ASPECT_MODE_EXPLICIT,
												bg_size.x / bg_size.y,
												vec2(HSM_BG_POS_X, HSM_BG_POS_Y),
												vec2(HSM_BG_SCALE * HSM_BG_SCALE_X, HSM_BG_SCALE),
												HSM_BG_FOLLOW_LAYER,
												HSM_BG_FOLLOW_MODE,
												HSM_BG_FOLLOW_FULL_USES_ZOOM,
												HSM_BG_FILL_MODE,
												HSM_BG_SPLIT_PRESERVE_CENTER,
												HSM_BG_SPLIT_REPEAT_WIDTH,
												true,
												BACKGROUND_COORD,
												BACKGROUND_SCALE);

	// Tile Wrap the background
	if (HSM_BG_WRAP_MODE == 1.0)
		BACKGROUND_CURVED_COORD = mod(BACKGROUND_CURVED_COORD, 1.0);
	
	// Mirror Wrap the bBackground
	if (HSM_BG_WRAP_MODE == 2.0)
		BACKGROUND_CURVED_COORD = HSM_GetMirrorWrapCoord(BACKGROUND_CURVED_COORD);

	vec4 bg_image = vec4(0.0);
	if (HSM_BG_OPACITY > 0.0 && bg_size.y > 16.0)
	{
		if (bg_use_vert_image)
			bg_image = HSM_GetMipmappedTexSample(BackgroundVertImage, BACKGROUND_CURVED_COORD, BACKGROUND_SCALE, HSM_BG_MIPMAPPING_BLEND_BIAS);
		else
			bg_image = HSM_GetMipmappedTexSample(BackgroundImage, BACKGROUND_CURVED_COORD, BACKGROUND_SCALE, HSM_BG_MIPMAPPING_BLEND_BIAS);

		// Premultiply Alpha
		bg_image = HSM_GetPreMultipliedColorLinear(bg_image, HSM_BG_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

		// HSV Adjustments
		bg_image.rgb = HSM_ApplyHSVAdjustment(bg_image.rgb, HSM_BG_HUE, HSM_BG_SATURATION, HSM_BG_BRIGHTNESS, HSM_BG_COLORIZE_ON, HSM_BG_GAMMA);

		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			bg_image = HSM_ApplyGamma(bg_image, HSM_STATIC_LAYERS_GAMMA);

		bg_image.rgb = ApplyAmbientImages(bg_image.rgb, 
												ambient_image.rgb,
												ambient2_image.rgb,
												HSM_BG_AMBIENT_LIGHTING_MULTIPLIER,
												HSM_BG_AMBIENT2_LIGHTING_MULTIPLIER,
												HSM_BG_APPLY_AMBIENT_IN_ADD_MODE,
												HSM_BG_BLEND_MODE,
												HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
	}

	//----------------------------------------------------
	// Device Image
	//----------------------------------------------------
	bool device_use_vert_image = SCREEN_ASPECT < 1.0 && vec2(ivec2(1024, 1024)).y > 16.0 ? true : false; 
	vec2 device_size = device_use_vert_image ? vec2(ivec2(1024, 1024)) : vec2(ivec2(1024, 1024));
	DEVICE_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
											VIEWPORT_UNSCALED_COORD,
											TEXTURE_ASPECT_MODE_EXPLICIT,
											device_size.x / device_size.y,
											vec2(HSM_DEVICE_POS_X, HSM_DEVICE_POS_Y),
											vec2(HSM_DEVICE_SCALE * HSM_DEVICE_SCALE_X, HSM_DEVICE_SCALE),
											HSM_DEVICE_FOLLOW_LAYER,
											HSM_DEVICE_FOLLOW_MODE,
											HSM_DEVICE_FOLLOW_FULL_USES_ZOOM,
											HSM_DEVICE_FILL_MODE,
											HSM_DEVICE_SPLIT_PRESERVE_CENTER,
											HSM_DEVICE_SPLIT_REPEAT_WIDTH,
											true,
											DEVICE_COORD,
											DEVICE_SCALE);

	vec4 device_image = vec4(0.0);
	if (HSM_DEVICE_OPACITY > 0.0 && device_size.y > 16.0)
	{
		device_image = device_use_vert_image ? 	HSM_GetMipmappedTexSample(DeviceVertImage, DEVICE_CURVED_COORD, DEVICE_SCALE, HSM_DEVICE_MIPMAPPING_BLEND_BIAS) :
												HSM_GetMipmappedTexSample(DeviceImage, DEVICE_CURVED_COORD, DEVICE_SCALE, HSM_DEVICE_MIPMAPPING_BLEND_BIAS);

		// Premultiply Alpha
		device_image = HSM_GetPreMultipliedColorLinear(device_image, HSM_DEVICE_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

		// HSV Adjustments
		device_image.rgb = HSM_ApplyHSVAdjustment(device_image.rgb, HSM_DEVICE_HUE, HSM_DEVICE_SATURATION, HSM_DEVICE_BRIGHTNESS, HSM_DEVICE_COLORIZE_ON, HSM_DEVICE_GAMMA);

		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			device_image = HSM_ApplyGamma(device_image, HSM_STATIC_LAYERS_GAMMA);

		device_image.rgb = ApplyAmbientImages(device_image.rgb, 
													ambient_image.rgb,
													ambient2_image.rgb,
													HSM_DEVICE_AMBIENT_LIGHTING_MULTIPLIER,
													HSM_DEVICE_AMBIENT2_LIGHTING_MULTIPLIER,
													HSM_DEVICE_APPLY_AMBIENT_IN_ADD_MODE,
													HSM_DEVICE_BLEND_MODE,
													HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
	}

	//----------------------------------------------------
	// DeviceLED Image
	//----------------------------------------------------
	vec2 deviceled_size = vec2(ivec2(1024, 1024));
	DEVICELED_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
											VIEWPORT_UNSCALED_COORD,
											TEXTURE_ASPECT_MODE_EXPLICIT,
											deviceled_size.x / deviceled_size.y,
											vec2(HSM_DEVICELED_POS_X, HSM_DEVICELED_POS_Y),
											vec2(HSM_DEVICELED_SCALE * HSM_DEVICELED_SCALE_X, HSM_DEVICELED_SCALE),
											HSM_DEVICELED_FOLLOW_LAYER,
											HSM_DEVICELED_FOLLOW_MODE,
											HSM_DEVICELED_FOLLOW_FULL_USES_ZOOM,
											HSM_DEVICELED_FILL_MODE,
											HSM_DEVICELED_SPLIT_PRESERVE_CENTER,
											HSM_DEVICELED_SPLIT_REPEAT_WIDTH,
											true,
											DEVICELED_COORD,
											DEVICELED_SCALE);

	vec4 deviceled_image = vec4(0.0);
	if (HSM_DEVICELED_OPACITY > 0.0 && deviceled_size.y > 16.0)
	{
		deviceled_image = HSM_GetMipmappedTexSample(DeviceLEDImage, DEVICELED_CURVED_COORD, DEVICELED_SCALE, HSM_DEVICELED_MIPMAPPING_BLEND_BIAS);

		// Premultiply Alpha
		deviceled_image = HSM_GetPreMultipliedColorLinear(deviceled_image, HSM_DEVICELED_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

		// HSV Adjustments
		deviceled_image.rgb = HSM_ApplyHSVAdjustment(deviceled_image.rgb, HSM_DEVICELED_HUE, HSM_DEVICELED_SATURATION, HSM_DEVICELED_BRIGHTNESS, HSM_DEVICELED_COLORIZE_ON, HSM_DEVICELED_GAMMA);

		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			deviceled_image = HSM_ApplyGamma(deviceled_image, HSM_STATIC_LAYERS_GAMMA);

		deviceled_image.rgb = ApplyAmbientImages(deviceled_image.rgb, 
													ambient_image.rgb,
													ambient2_image.rgb,
													HSM_DEVICELED_AMBIENT_LIGHTING_MULTIPLIER,
													HSM_DEVICELED_AMBIENT2_LIGHTING_MULTIPLIER,
													HSM_DEVICELED_APPLY_AMBIENT_IN_ADD_MODE,
													HSM_DEVICELED_BLEND_MODE,
													HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
	}

	//----------------------------------------------------
	// LED Image
	//----------------------------------------------------
	vec4 led_image = vec4(0.0);
	if (HSM_LED_OPACITY > 0.0)
	{
		vec2 led_size = vec2(ivec2(1024, 1024));
		LED_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
											VIEWPORT_UNSCALED_COORD,
											TEXTURE_ASPECT_MODE_EXPLICIT,
											led_size.x / led_size.y, 
											vec2(HSM_LED_POS_X, HSM_LED_POS_Y), 
											vec2(HSM_LED_SCALE * HSM_LED_SCALE_X, HSM_LED_SCALE),
											HSM_LED_FOLLOW_LAYER,
											HSM_LED_FOLLOW_MODE,
											HSM_LED_FOLLOW_FULL_USES_ZOOM,
											HSM_LED_FILL_MODE,
											HSM_LED_SPLIT_PRESERVE_CENTER,
											HSM_LED_SPLIT_REPEAT_WIDTH,
											true,
											LED_COORD,
											LED_SCALE);

		if (HSM_LED_OPACITY > 0.0 && led_size.y > 16.0)
		{
			led_image = HSM_GetMipmappedTexSample(LEDImage, LED_CURVED_COORD, LED_SCALE, HSM_LED_MIPMAPPING_BLEND_BIAS);

			// Premultiply Alpha
			led_image = HSM_GetPreMultipliedColorLinear(led_image, HSM_LED_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

			// HSV Adjustments
			led_image.rgb = HSM_ApplyHSVAdjustment(led_image.rgb, HSM_LED_HUE, HSM_LED_SATURATION, HSM_LED_BRIGHTNESS, HSM_LED_COLORIZE_ON, HSM_LED_GAMMA);

			// STATIC GAMMA
			if (HSM_STATIC_LAYERS_GAMMA != 1.0)
				led_image = HSM_ApplyGamma(led_image, HSM_STATIC_LAYERS_GAMMA);

			led_image.rgb = ApplyAmbientImages(led_image.rgb, 
													ambient_image.rgb,
													ambient2_image.rgb,
													HSM_LED_AMBIENT_LIGHTING_MULTIPLIER,
													HSM_LED_AMBIENT2_LIGHTING_MULTIPLIER,
													HSM_LED_APPLY_AMBIENT_IN_ADD_MODE,
													HSM_LED_BLEND_MODE,
													HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
		}
	}

	//----------------------------------------------------
	// Decal Image
	//----------------------------------------------------
	vec2 decal_size = vec2(ivec2(1024, 1024));
	DECAL_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
											VIEWPORT_UNSCALED_COORD,
											TEXTURE_ASPECT_MODE_EXPLICIT,
											decal_size.x / decal_size.y,
											vec2(HSM_DECAL_POS_X, HSM_DECAL_POS_Y), 
											vec2(HSM_DECAL_SCALE * HSM_DECAL_SCALE_X, HSM_DECAL_SCALE),
											HSM_DECAL_FOLLOW_LAYER,
											HSM_DECAL_FOLLOW_MODE,
											HSM_DECAL_FOLLOW_FULL_USES_ZOOM,
											HSM_DECAL_FILL_MODE,
											HSM_DECAL_SPLIT_PRESERVE_CENTER,
											HSM_DECAL_SPLIT_REPEAT_WIDTH,
											true,
											DECAL_COORD,
											DECAL_SCALE);
	vec4 decal_image = vec4(0.0);
	if (HSM_DECAL_OPACITY > 0.0 && decal_size.y > 16.0)
	{
		decal_image = HSM_GetMipmappedTexSample(DecalImage, DECAL_CURVED_COORD, DECAL_SCALE, HSM_DECAL_MIPMAPPING_BLEND_BIAS);
		
		// Premultiply Alpha
		decal_image = HSM_GetPreMultipliedColorLinear(decal_image, HSM_DECAL_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

		// HSV Adjustments
		decal_image.rgb = HSM_ApplyHSVAdjustment(decal_image.rgb, HSM_DECAL_HUE, HSM_DECAL_SATURATION, HSM_DECAL_BRIGHTNESS, HSM_DECAL_COLORIZE_ON, HSM_DECAL_GAMMA);

		// STATIC GAMMA
		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			decal_image = HSM_ApplyGamma(decal_image, HSM_STATIC_LAYERS_GAMMA);

		decal_image.rgb = ApplyAmbientImages(decal_image.rgb, 
												ambient_image.rgb,
												ambient2_image.rgb,
												HSM_DECAL_AMBIENT_LIGHTING_MULTIPLIER,
												HSM_DECAL_AMBIENT2_LIGHTING_MULTIPLIER,
												HSM_DECAL_APPLY_AMBIENT_IN_ADD_MODE,
												HSM_DECAL_BLEND_MODE,
												HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
	}

//----------------------------------------------------
//  ADV Get Additional Layers and Composite 
//----------------------------------------------------
	vec2 top_size = vec2(ivec2(1024, 1024));
	TOP_IMAGE_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
												VIEWPORT_UNSCALED_COORD,
												TEXTURE_ASPECT_MODE_EXPLICIT,
												top_size.x / top_size.y,
												vec2(HSM_TOP_POS_X, HSM_TOP_POS_Y), 
												vec2(HSM_TOP_SCALE * HSM_TOP_SCALE_X, HSM_TOP_SCALE),
												HSM_TOP_FOLLOW_LAYER,
												HSM_TOP_FOLLOW_MODE,
												HSM_TOP_FOLLOW_FULL_USES_ZOOM,
												HSM_TOP_FILL_MODE,
												HSM_TOP_SPLIT_PRESERVE_CENTER,
												HSM_TOP_SPLIT_REPEAT_WIDTH,
												true,
												TOP_IMAGE_COORD,
												TOP_IMAGE_SCALE);

	if (HSM_TOP_MIRROR_WRAP == 1.0)
		TOP_IMAGE_CURVED_COORD = HSM_GetMirrorWrapCoord(TOP_IMAGE_CURVED_COORD);

	vec4 top_image = vec4(0.0);
	if (HSM_TOP_OPACITY > 0.0 && top_size.y > 16.0)
	{
		// Get the top image color and masking values if needed
		top_image = HSM_GetMipmappedTexSample(TopLayerImage, TOP_IMAGE_CURVED_COORD, TOP_IMAGE_SCALE, HSM_TOP_MIPMAPPING_BLEND_BIAS);

		// Premultiply Alpha
		top_image = HSM_GetPreMultipliedColorLinear(top_image, HSM_TOP_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

		// HSV Adjustments
		top_image.rgb = HSM_ApplyHSVAdjustment(top_image.rgb, HSM_TOP_HUE, HSM_TOP_SATURATION, HSM_TOP_BRIGHTNESS, HSM_TOP_COLORIZE_ON, HSM_TOP_GAMMA);

		// STATIC GAMMA
		if (HSM_STATIC_LAYERS_GAMMA != 1.0)
			top_image = HSM_ApplyGamma(top_image, HSM_STATIC_LAYERS_GAMMA);

		top_image.rgb = ApplyAmbientImages(top_image.rgb, 
											ambient_image.rgb,
											ambient2_image.rgb,
											HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER,
											HSM_TOP_AMBIENT2_LIGHTING_MULTIPLIER,
											HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE,
											HSM_TOP_BLEND_MODE,
											HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
	}

	//----------------------------------------------------
	// Cabinet Glass Image
	//----------------------------------------------------
	vec4 cab_glass_image = vec4(0.0);

	if (HSM_CAB_GLASS_OPACITY > 0.0)
	{


		vec2 cab_glass_size = vec2(ivec2(1024, 1024));
		CAB_GLASS_CURVED_COORD = HSM_GetScaledCoord(VIEWPORT_COORD,
													VIEWPORT_UNSCALED_COORD,
													TEXTURE_ASPECT_MODE_EXPLICIT,
													cab_glass_size.x / cab_glass_size.y,
													vec2(HSM_CAB_GLASS_POS_X, HSM_CAB_GLASS_POS_Y), 
													vec2(HSM_CAB_GLASS_SCALE * HSM_CAB_GLASS_SCALE_X, HSM_CAB_GLASS_SCALE),
													HSM_CAB_GLASS_FOLLOW_LAYER,
													HSM_CAB_GLASS_FOLLOW_MODE,
													HSM_CAB_GLASS_FOLLOW_FULL_USES_ZOOM,
													HSM_CAB_GLASS_FILL_MODE,
													HSM_CAB_GLASS_SPLIT_PRESERVE_CENTER,
													HSM_CAB_GLASS_SPLIT_REPEAT_WIDTH,
													true,
													CAB_GLASS_COORD,
													CAB_GLASS_SCALE);

		if (HSM_CAB_GLASS_OPACITY > 0.0 && cab_glass_size.y > 16.0)
		{
			// Sample Texture
			cab_glass_image = HSM_GetMipmappedTexSample(CabinetGlassImage, CAB_GLASS_CURVED_COORD, CAB_GLASS_SCALE, HSM_CAB_GLASS_MIPMAPPING_BLEND_BIAS);

			// Premultiply Alpha
			cab_glass_image = HSM_GetPreMultipliedColorLinear(cab_glass_image, HSM_CAB_GLASS_SOURCE_MATTE_TYPE, DEFAULT_SRGB_GAMMA);

			// HSV Adjustments
			cab_glass_image.rgb = HSM_ApplyHSVAdjustment(cab_glass_image.rgb, HSM_CAB_GLASS_HUE, HSM_CAB_GLASS_SATURATION, HSM_CAB_GLASS_BRIGHTNESS, HSM_CAB_GLASS_COLORIZE_ON, HSM_CAB_GLASS_GAMMA);

			// STATIC GAMMA
			if (HSM_STATIC_LAYERS_GAMMA != 1.0)
				cab_glass_image = HSM_ApplyGamma(cab_glass_image, HSM_STATIC_LAYERS_GAMMA);

			cab_glass_image.rgb = ApplyAmbientImages(cab_glass_image.rgb, 
														ambient_image.rgb,
														ambient2_image.rgb,
														HSM_CAB_GLASS_AMBIENT_LIGHTING_MULTIPLIER,
														HSM_CAB_GLASS_AMBIENT2_LIGHTING_MULTIPLIER,
														HSM_CAB_GLASS_APPLY_AMBIENT_IN_ADD_MODE,
														HSM_CAB_GLASS_BLEND_MODE,
														HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE);
		}
	}


	//-----------------------------------------------------------------------------------------
	// CUTOUT MASK
	//-----------------------------------------------------------------------------------------
	CUTOUT_MASK = 1.0;

	vec2 temp_scale = vec2(0.5);
	vec2 temp_coord = vec2(0.5);

	vec2 cutout_base_scale_offset = vec2(0.5);

	if ( HSM_CUTOUT_FOLLOW_LAYER == FOLLOW_LAYER_VIEWPORT )
		cutout_base_scale_offset *= vec2(DEFAULT_UNCORRECTED_BEZEL_SCALE.y * TUBE_DIFFUSE_ASPECT / output_aspect, DEFAULT_BEZEL_SCALE.y);

	vec2 cutout_coord = HSM_GetScaledCoord(VIEWPORT_COORD,
											VIEWPORT_UNSCALED_COORD,
										  	HSM_CUTOUT_ASPECT_MODE,
											HSM_CUTOUT_EXPLICIT_ASPECT,
											vec2(HSM_CUTOUT_POS_X, HSM_CUTOUT_POS_Y),
											vec2(vec2(HSM_CUTOUT_SCALE * HSM_CUTOUT_SCALE_X, HSM_CUTOUT_SCALE) * cutout_base_scale_offset),
											HSM_CUTOUT_FOLLOW_LAYER,
											FOLLOW_MODE_SCALE_AND_POS,
											HSM_CUTOUT_FOLLOW_FULL_USES_ZOOM,
											FILL_MODE_STRETCH, 0.0, 0.0,
											false,
											temp_coord,
											temp_scale);
	
	CUTOUT_MASK = 1.0 - HSM_GetCornerMask(cutout_coord, TUBE_DIFFUSE_ASPECT, HSM_CUTOUT_CORNER_RADIUS, 0.8);

	//-----------------------------------------------------------------------------------------
	// Full Viewport Vignette
	//-----------------------------------------------------------------------------------------
	vec4 vignette_layer = vec4(0.0);
	if (HSM_VIEWPORT_VIGNETTE_OPACITY > 0.0)
	{
		vec2 vignette_coord = HSM_GetScaledCoord(VIEWPORT_COORD,
												VIEWPORT_UNSCALED_COORD,
												TEXTURE_ASPECT_MODE_VIEWPORT, 1.0,
												vec2(HSM_VIEWPORT_VIGNETTE_POS_X, HSM_VIEWPORT_VIGNETTE_POS_Y), 
												vec2(vec2(HSM_VIEWPORT_VIGNETTE_SCALE * HSM_VIEWPORT_VIGNETTE_SCALE_X, HSM_VIEWPORT_VIGNETTE_SCALE)), 
												HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER,
												FOLLOW_MODE_SCALE_AND_POS,
												FOLLOW_LAYER_VIEWPORT,
												FILL_MODE_STRETCH, 0.0, 0.0,
												false,
												temp_coord,
												temp_scale);

		vignette_layer.a += 0.75 * HHLP_QuadraticBezier(1.0 - HSM_GetVignetteFactor(vignette_coord, HSM_VIEWPORT_VIGNETTE_OPACITY, 1.0), vec2(1.0, 0.5));
	}


	//-----------------------------------------------------------------------------------------
	// COMPOSITE ALL LAYERS
	//-----------------------------------------------------------------------------------------

	vec4 frag_color_linear = vec4(0.0);

	float start_layer = 0.0;
	int end_layer = int(MAX_LAYER_ORDER);

#ifdef LAYERS_OVER_CRT
	start_layer = int(HSM_CRT_LAYER_ORDER);
	end_layer = int(MAX_LAYER_ORDER);
#else
	start_layer = 0.0;
	end_layer = int(HSM_CRT_LAYER_ORDER - 1.0);
#endif

	OUTSIDE_TUBE_MASK_FOR_IMAGE = 1.0 - HSM_GetCornerMask(tube_curved_coord_ctr * 1.003 + 0.5, TUBE_DIFFUSE_ASPECT, HSM_FRM_OUTER_CORNER_RADIUS, 1.0);

	for(int i=start_layer; i <= end_layer; i++)
	{
		// BACKGROUND
		if (HSM_BG_LAYER_ORDER == i)
			frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
													bg_image, 
													HSM_BG_BLEND_MODE, 
													HSM_BG_MASK_MODE, 
													HSM_BG_CUTOUT_MODE,
													HSM_BG_DUALSCREEN_VIS_MODE,
													HSM_BG_OPACITY);

		// VIGNETTE
		if (HSM_VIEWPORT_VIGNETTE_LAYER_ORDER == i)
			frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
													vignette_layer, 
													BLEND_MODE_NORMAL, 
													HSM_VIEWPORT_VIGNETTE_MASK_MODE, 
													HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE,
													SHOW_ON_DUALSCREEN_MODE_BOTH,
													HSM_VIEWPORT_VIGNETTE_OPACITY);
		// LED IMAGE
		if (HSM_LED_LAYER_ORDER == i && HSM_LED_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														led_image, 
														HSM_LED_BLEND_MODE, 
														HSM_LED_MASK_MODE, 
														HSM_LED_CUTOUT_MODE, 
														HSM_LED_DUALSCREEN_VIS_MODE,
														HSM_LED_OPACITY);

		// DEVICE IMAGE
		if (HSM_DEVICE_LAYER_ORDER == i && HSM_DEVICE_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														device_image, 
														HSM_DEVICE_BLEND_MODE, 
														HSM_DEVICE_MASK_MODE, 
														HSM_DEVICE_CUTOUT_MODE, 
														HSM_DEVICE_DUALSCREEN_VIS_MODE,
														HSM_DEVICE_OPACITY);

		// DEVICELED IMAGE
		if (HSM_DEVICELED_LAYER_ORDER == i && HSM_DEVICELED_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														deviceled_image, 
														HSM_DEVICELED_BLEND_MODE, 
														HSM_DEVICELED_MASK_MODE, 
														HSM_DEVICELED_CUTOUT_MODE, 
														HSM_DEVICELED_DUALSCREEN_VIS_MODE,
														HSM_DEVICELED_OPACITY);

		// DECAL IMAGE
		if (HSM_DECAL_LAYER_ORDER == i && HSM_DECAL_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														decal_image, 
														HSM_DECAL_BLEND_MODE, 
														HSM_DECAL_MASK_MODE, 
														HSM_DECAL_CUTOUT_MODE, 
														HSM_DECAL_DUALSCREEN_VIS_MODE,
														HSM_DECAL_OPACITY);

		// CABINET GLASS
		if (HSM_CAB_GLASS_LAYER_ORDER == i && HSM_CAB_GLASS_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														cab_glass_image, 
														HSM_CAB_GLASS_BLEND_MODE, 
														HSM_CAB_GLASS_MASK_MODE, 
														HSM_CAB_GLASS_CUTOUT_MODE, 
														HSM_CAB_GLASS_DUALSCREEN_VIS_MODE,
														HSM_CAB_GLASS_OPACITY);


		// Top Layer
		if (HSM_TOP_LAYER_ORDER == i && HSM_TOP_OPACITY > 0.0)
				frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
														top_image, 
														HSM_TOP_BLEND_MODE, 
														HSM_TOP_MASK_MODE, 
														HSM_TOP_CUTOUT_MODE, 
														HSM_TOP_DUALSCREEN_VIS_MODE,
														HSM_TOP_OPACITY);
	}

#ifdef LAYERS_UNDER_CRT

	// Add background behind tube
	frag_color_linear = HSM_PreMultAlphaBlend(frag_color_linear, tube_bg_layer);
	// GENERATED BEZEL LAYER
	if (HSM_BZL_OPACITY > 0.0 || HSM_FRM_OPACITY > 0.0)
		frag_color_linear = BlendModeMaskLayerMix(frag_color_linear, 
												bezel_layer, 
												HSM_BZL_BLEND_MODE, 
												MASK_MODE_ALL, 0.0, 
												SHOW_ON_DUALSCREEN_MODE_BOTH, 1.0);
#endif

	//-----------------------------------------------------------------------------------------
	// MASK DEBUG DISPLAY
	//-----------------------------------------------------------------------------------------
	// Show a red overlay on the screen showing the mask for each mask mode
	if (HSM_LAYERING_DEBUG_MASK_MODE != -1.0)
	{
		float debug_mask = 1.0;
		if (HSM_LAYERING_DEBUG_MASK_MODE == -2.0)
			debug_mask = CUTOUT_MASK;
		else
			debug_mask = GetMask(HSM_LAYERING_DEBUG_MASK_MODE);

		frag_color_linear = HSM_PreMultAlphaBlend(frag_color_linear, vec4(1.0, 0.0, 0.0, 1.0) * 0.15 * debug_mask);
		frag_color_linear = HSM_PreMultAlphaBlend(frag_color_linear, vec4(0.05, 0.05, 0.05, 1.0) * 0.15 * (1.0 - debug_mask));
		frag_color_linear = clamp(frag_color_linear, 0.0, 1.0);
	}

	#ifdef LAYERS_UNDER_CRT
	// Store reflection mask in the alpha channel
	// Usually used to show the uneven brightness of a bumpy surface
	if (HSM_REFLECT_MASK_IMAGE_AMOUNT > 0.0)
	{
		vec2 reflect_mask_scale = vec2(0.5);
		vec2 reflect_mask_coord = HSM_GetLayerCoord(VIEWPORT_COORD, HSM_REFLECT_MASK_FOLLOW_LAYER, HSM_REFLECT_MASK_FOLLOW_MODE, reflect_mask_scale);
		float reflect_mask = HSM_GetMipmappedTexSample(ReflectionMaskImage, reflect_mask_coord, reflect_mask_scale, HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS).r;
		reflect_mask = clamp(HSM_REFLECT_MASK_BLACK_LEVEL * (reflect_mask - 1.0) + 1.0, 0.0, 1.0);
		reflect_mask *= HSM_REFLECT_MASK_BRIGHTNESS;

		frag_color_linear.a = HSM_REFLECT_MASK_IMAGE_AMOUNT * reflect_mask + (1.0 - HSM_REFLECT_MASK_IMAGE_AMOUNT);
	}
	else
		frag_color_linear.a = 1.0;

	#endif

	FragColor = frag_color_linear;

	// If we have calculated an image then set - 1.0 as a flag to show that we have
	if (UNFLIPPED_VIEWPORT_COORD.x < (2.0 / OutputSize.x) && UNFLIPPED_VIEWPORT_COORD.y < (2.0 / OutputSize.y))
		FragColor.a = -1.0;

	return;
}

// End include: bezel-images.inc
