/**
 * Semantic Mapping System for Shader Parameters
 *
 * Implements RetroArch-style semantic mapping for automatic shader parameter binding.
 * Maps semantic names to runtime uniforms and textures, enabling robust shader compatibility.
 *
 * Based on RetroArch's slang_semantic and slang_texture_semantic structures.
 */

export interface SemanticDefinition {
  /** The semantic name (e.g., 'HSM_FAKE_SCANLINE_OPACITY') */
  semantic: string;
  /** Possible uniform names this semantic can map to */
  uniformNames: string[];
  /** Default value if not specified */
  defaultValue?: number;
  /** Data type */
  type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'uint' | 'bool';
  /** Description for documentation */
  description?: string;
}

export interface TextureSemanticDefinition {
  /** The texture semantic name (e.g., 'Original', 'Source') */
  semantic: string;
  /** Possible uniform names this texture semantic can map to */
  uniformNames: string[];
  /** Texture unit index (0-15) */
  textureUnit?: number;
  /** Description for documentation */
  description?: string;
}

export interface SemanticMappingResult {
  /** Successfully mapped parameters */
  mappedParameters: Map<string, { uniformName: string; value: any }>;
  /** Parameters that couldn't be mapped */
  unmappedParameters: string[];
  /** Successfully mapped textures */
  mappedTextures: Map<string, { uniformName: string; textureUnit: number }>;
  /** Textures that couldn't be mapped */
  unmappedTextures: string[];
}

export class SemanticMapper {
  private parameterSemantics: Map<string, SemanticDefinition> = new Map();
  private textureSemantics: Map<string, TextureSemanticDefinition> = new Map();

  constructor() {
    this.initializeParameterSemantics();
    this.initializeTextureSemantics();
  }

  /**
   * Initialize parameter semantic definitions
   * Based on RetroArch's slang_semantic and Mega Bezel parameter conventions
   */
  private initializeParameterSemantics(): void {
    // Screen Layout Parameters
    this.addParameterSemantic({
      semantic: 'HSM_SCREEN_POSITION_X',
      uniformNames: ['HSM_SCREEN_POSITION_X', 'screen_pos_x', 'ScreenPosX'],
      defaultValue: 0,
      type: 'float',
      description: 'Horizontal screen position offset'
    });

    this.addParameterSemantic({
      semantic: 'HSM_SCREEN_POSITION_Y',
      uniformNames: ['HSM_SCREEN_POSITION_Y', 'screen_pos_y', 'ScreenPosY'],
      defaultValue: 0,
      type: 'float',
      description: 'Vertical screen position offset'
    });

    this.addParameterSemantic({
      semantic: 'HSM_NON_INTEGER_SCALE',
      uniformNames: ['HSM_NON_INTEGER_SCALE', 'non_integer_scale', 'NonIntegerScale'],
      defaultValue: 0.8,
      type: 'float',
      description: 'Screen scaling factor'
    });

    // CRT Effects Parameters
    this.addParameterSemantic({
      semantic: 'HSM_FAKE_SCANLINE_OPACITY',
      uniformNames: ['HSM_FAKE_SCANLINE_OPACITY', 'scanline_opacity', 'ScanlineOpacity'],
      defaultValue: 30,
      type: 'float',
      description: 'Opacity of simulated scanlines'
    });

    this.addParameterSemantic({
      semantic: 'HSM_SCREEN_SCALE_GSHARP_MODE',
      uniformNames: ['HSM_SCREEN_SCALE_GSHARP_MODE', 'gsharp_mode', 'GSharpMode'],
      defaultValue: 1,
      type: 'int',
      description: 'G-Sharp sharpening mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_SCREEN_SCALE_HSHARP0',
      uniformNames: ['HSM_SCREEN_SCALE_HSHARP0', 'hsharp_range', 'HSharpRange'],
      defaultValue: 2.0,
      type: 'float',
      description: 'Sharpening filter range'
    });

    // Color Grading Parameters
    this.addParameterSemantic({
      semantic: 'g_sat',
      uniformNames: ['g_sat', 'saturation', 'Saturation'],
      defaultValue: 0.2,
      type: 'float',
      description: 'Color saturation adjustment'
    });

    this.addParameterSemantic({
      semantic: 'g_cntrst',
      uniformNames: ['g_cntrst', 'contrast', 'Contrast'],
      defaultValue: 0.2,
      type: 'float',
      description: 'Contrast adjustment'
    });

    this.addParameterSemantic({
      semantic: 'g_lum',
      uniformNames: ['g_lum', 'brightness', 'Brightness'],
      defaultValue: 0.0,
      type: 'float',
      description: 'Brightness adjustment'
    });

    // Bezel Settings Parameters
    this.addParameterSemantic({
      semantic: 'HSM_BZL_INDEPENDENT_SCALE',
      uniformNames: ['HSM_BZL_INDEPENDENT_SCALE', 'bezel_independent_scale', 'BezelIndependentScale'],
      defaultValue: 0,
      type: 'int',
      description: 'Use independent scaling for bezel'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BZL_INNER_CORNER_RADIUS_SCALE',
      uniformNames: ['HSM_BZL_INNER_CORNER_RADIUS_SCALE', 'bezel_inner_corner_radius', 'BezelInnerCornerRadius'],
      defaultValue: 1.0,
      type: 'float',
      description: 'Scale factor for inner bezel corner radius'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BZL_BRIGHTNESS',
      uniformNames: ['HSM_BZL_BRIGHTNESS', 'bezel_brightness', 'BezelBrightness'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Brightness of bezel areas'
    });

    // Performance Parameters
    this.addParameterSemantic({
      semantic: 'HSM_MOTION_BLUR_SAMPLES',
      uniformNames: ['HSM_MOTION_BLUR_SAMPLES', 'motion_blur_samples', 'MotionBlurSamples'],
      defaultValue: 16,
      type: 'int',
      description: 'Number of samples for motion blur effect'
    });

    this.addParameterSemantic({
      semantic: 'HSM_TAA_ENABLED',
      uniformNames: ['HSM_TAA_ENABLED', 'taa_enabled', 'TAAEnabled'],
      defaultValue: 0,
      type: 'int',
      description: 'Enable temporal anti-aliasing'
    });

    this.addParameterSemantic({
      semantic: 'HSM_RENDER_SCALE',
      uniformNames: ['HSM_RENDER_SCALE', 'render_scale', 'RenderScale'],
      defaultValue: 1.0,
      type: 'float',
      description: 'Internal render resolution scale'
    });

    // Advanced Effects Parameters
    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT_LIGHTING_OPACITY',
      uniformNames: ['HSM_AMBIENT_LIGHTING_OPACITY', 'ambient_opacity', 'AmbientOpacity'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Opacity of ambient lighting effects'
    });

    // Common RetroArch Parameters
    this.addParameterSemantic({
      semantic: 'SCREEN_ASPECT',
      uniformNames: ['SCREEN_ASPECT', 'screen_aspect', 'ScreenAspect'],
      defaultValue: 1.0,
      type: 'float',
      description: 'Screen aspect ratio'
    });

    this.addParameterSemantic({
      semantic: 'SCREEN_COORD',
      uniformNames: ['SCREEN_COORD', 'screen_coord', 'ScreenCoord'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Screen coordinate vector (X component)'
    });

    this.addParameterSemantic({
      semantic: 'DEFAULT_SRGB_GAMMA',
      uniformNames: ['DEFAULT_SRGB_GAMMA', 'srgb_gamma', 'SRGBGamma'],
      defaultValue: 2.4,
      type: 'float',
      description: 'Default gamma value for sRGB color space'
    });

    // Bezel Parameters
    this.addParameterSemantic({
      semantic: 'HSM_BZL_USE_INDEPENDENT_SCALE',
      uniformNames: ['HSM_BZL_USE_INDEPENDENT_SCALE'],
      defaultValue: 0,
      type: 'float',
      description: 'Use independent scaling for bezel'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BZL_INNER_EDGE_THICKNESS',
      uniformNames: ['HSM_BZL_INNER_EDGE_THICKNESS'],
      defaultValue: 50,
      type: 'float',
      description: 'Thickness of inner bezel edge'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BZL_OUTER_EDGE_THICKNESS',
      uniformNames: ['HSM_BZL_OUTER_EDGE_THICKNESS'],
      defaultValue: 50,
      type: 'float',
      description: 'Thickness of outer bezel edge'
    });

    // Reflection Parameters
    this.addParameterSemantic({
      semantic: 'HSM_BEZEL_REFLECTION_ROUGHNESS',
      uniformNames: ['HSM_BEZEL_REFLECTION_ROUGHNESS'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Roughness of bezel reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BEZEL_REFLECTION_METALLIC',
      uniformNames: ['HSM_BEZEL_REFLECTION_METALLIC'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Metallic property of bezel'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BEZEL_REFLECTION_SPECULAR_POWER',
      uniformNames: ['HSM_BEZEL_REFLECTION_SPECULAR_POWER'],
      defaultValue: 32,
      type: 'float',
      description: 'Specular power for bezel reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BEZEL_REFLECTION_FRESNEL',
      uniformNames: ['HSM_BEZEL_REFLECTION_FRESNEL'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Fresnel effect strength for bezel'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BEZEL_REFLECTION_STRENGTH',
      uniformNames: ['HSM_BEZEL_REFLECTION_STRENGTH'],
      defaultValue: 0.5,
      type: 'float',
      description: 'Overall reflection strength on bezel'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_GLOBAL_AMOUNT',
      uniformNames: ['HSM_REFLECT_GLOBAL_AMOUNT'],
      defaultValue: 100,
      type: 'float',
      description: 'Global reflection amount'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_DIRECT_AMOUNT',
      uniformNames: ['HSM_REFLECT_DIRECT_AMOUNT'],
      defaultValue: 100,
      type: 'float',
      description: 'Direct reflection amount'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_DIFFUSED_AMOUNT',
      uniformNames: ['HSM_REFLECT_DIFFUSED_AMOUNT'],
      defaultValue: 25,
      type: 'float',
      description: 'Diffused reflection amount'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_FULLSCREEN_GLOW',
      uniformNames: ['HSM_REFLECT_FULLSCREEN_GLOW'],
      defaultValue: 50,
      type: 'float',
      description: 'Fullscreen glow reflection'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_GLOBAL_GAMMA_ADJUST',
      uniformNames: ['HSM_REFLECT_GLOBAL_GAMMA_ADJUST'],
      defaultValue: 0.9,
      type: 'float',
      description: 'Global gamma adjustment for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_BLUR_NUM_SAMPLES',
      uniformNames: ['HSM_REFLECT_BLUR_NUM_SAMPLES'],
      defaultValue: 16,
      type: 'int',
      description: 'Number of blur samples for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_BLUR_MIN',
      uniformNames: ['HSM_REFLECT_BLUR_MIN'],
      defaultValue: 0,
      type: 'float',
      description: 'Minimum blur amount for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_BLUR_MAX',
      uniformNames: ['HSM_REFLECT_BLUR_MAX'],
      defaultValue: 50,
      type: 'float',
      description: 'Maximum blur amount for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_BLUR_FALLOFF_DISTANCE',
      uniformNames: ['HSM_REFLECT_BLUR_FALLOFF_DISTANCE'],
      defaultValue: 100,
      type: 'float',
      description: 'Blur falloff distance for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_FADE_AMOUNT',
      uniformNames: ['HSM_REFLECT_FADE_AMOUNT'],
      defaultValue: 20,
      type: 'float',
      description: 'Reflection fade amount'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_RADIAL_FADE_WIDTH',
      uniformNames: ['HSM_REFLECT_RADIAL_FADE_WIDTH'],
      defaultValue: 100,
      type: 'float',
      description: 'Radial fade width for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_RADIAL_FADE_HEIGHT',
      uniformNames: ['HSM_REFLECT_RADIAL_FADE_HEIGHT'],
      defaultValue: 100,
      type: 'float',
      description: 'Radial fade height for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_NOISE_AMOUNT',
      uniformNames: ['HSM_REFLECT_NOISE_AMOUNT'],
      defaultValue: 0,
      type: 'float',
      description: 'Noise amount in reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_NOISE_SAMPLES',
      uniformNames: ['HSM_REFLECT_NOISE_SAMPLES'],
      defaultValue: 4,
      type: 'int',
      description: 'Number of noise samples for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_VIGNETTE_AMOUNT',
      uniformNames: ['HSM_REFLECT_VIGNETTE_AMOUNT'],
      defaultValue: 50,
      type: 'float',
      description: 'Vignette amount in reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_VIGNETTE_SIZE',
      uniformNames: ['HSM_REFLECT_VIGNETTE_SIZE'],
      defaultValue: 100,
      type: 'float',
      description: 'Vignette size in reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_MASK_IMAGE_AMOUNT',
      uniformNames: ['HSM_REFLECT_MASK_IMAGE_AMOUNT'],
      defaultValue: 100,
      type: 'float',
      description: 'Reflection mask image amount'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_MASK_BRIGHTNESS',
      uniformNames: ['HSM_REFLECT_MASK_BRIGHTNESS'],
      defaultValue: 100,
      type: 'float',
      description: 'Reflection mask brightness'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_MASK_BLACK_LEVEL',
      uniformNames: ['HSM_REFLECT_MASK_BLACK_LEVEL'],
      defaultValue: 0,
      type: 'float',
      description: 'Reflection mask black level'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS',
      uniformNames: ['HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS'],
      defaultValue: 0,
      type: 'float',
      description: 'Reflection mask mipmapping blend bias'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_FADE',
      uniformNames: ['HSM_REFLECT_CORNER_FADE'],
      defaultValue: 0,
      type: 'float',
      description: 'Corner fade for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_FADE_DISTANCE',
      uniformNames: ['HSM_REFLECT_CORNER_FADE_DISTANCE'],
      defaultValue: 100,
      type: 'float',
      description: 'Corner fade distance for reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_INNER_SPREAD',
      uniformNames: ['HSM_REFLECT_CORNER_INNER_SPREAD'],
      defaultValue: 100,
      type: 'float',
      description: 'Inner spread of corner reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_OUTER_SPREAD',
      uniformNames: ['HSM_REFLECT_CORNER_OUTER_SPREAD'],
      defaultValue: 100,
      type: 'float',
      description: 'Outer spread of corner reflections'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP',
      uniformNames: ['HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP'],
      defaultValue: 0,
      type: 'float',
      description: 'Top corner rotation offset'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM',
      uniformNames: ['HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM'],
      defaultValue: 0,
      type: 'float',
      description: 'Bottom corner rotation offset'
    });

    this.addParameterSemantic({
      semantic: 'HSM_REFLECT_CORNER_SPREAD_FALLOFF',
      uniformNames: ['HSM_REFLECT_CORNER_SPREAD_FALLOFF'],
      defaultValue: 100,
      type: 'float',
      description: 'Corner spread falloff'
    });

    // CRT Parameters
    this.addParameterSemantic({
      semantic: 'HSM_GLOBAL_CORNER_RADIUS',
      uniformNames: ['HSM_GLOBAL_CORNER_RADIUS'],
      defaultValue: 15,
      type: 'float',
      description: 'Global corner radius for CRT'
    });

    this.addParameterSemantic({
      semantic: 'HSM_MONOCHROME_MODE',
      uniformNames: ['HSM_MONOCHROME_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Monochrome display mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_MONOCHROME_DUALSCREEN_VIS_MODE',
      uniformNames: ['HSM_MONOCHROME_DUALSCREEN_VIS_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Dual screen visibility mode for monochrome'
    });

    this.addParameterSemantic({
      semantic: 'HSM_POST_CRT_BRIGHTNESS',
      uniformNames: ['HSM_POST_CRT_BRIGHTNESS'],
      defaultValue: 100,
      type: 'float',
      description: 'Post-CRT brightness adjustment'
    });

    this.addParameterSemantic({
      semantic: 'HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE',
      uniformNames: ['HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE'],
      defaultValue: 100,
      type: 'float',
      description: 'CRT tube black edge corner radius scale'
    });

    this.addParameterSemantic({
      semantic: 'HSM_CRT_CURVATURE_SCALE',
      uniformNames: ['HSM_CRT_CURVATURE_SCALE'],
      defaultValue: 100,
      type: 'float',
      description: 'CRT curvature scale'
    });

    // Background Parameters
    this.addParameterSemantic({
      semantic: 'HSM_BG_OPACITY',
      uniformNames: ['HSM_BG_OPACITY'],
      defaultValue: 100,
      type: 'float',
      description: 'Background opacity'
    });

    this.addParameterSemantic({
      semantic: 'HSM_POTATO_COLORIZE_CRT_WITH_BG',
      uniformNames: ['HSM_POTATO_COLORIZE_CRT_WITH_BG'],
      defaultValue: 0,
      type: 'float',
      description: 'Colorize CRT with background (potato preset)'
    });

    this.addParameterSemantic({
      semantic: 'HSM_POTATO_COLORIZE_BRIGHTNESS',
      uniformNames: ['HSM_POTATO_COLORIZE_BRIGHTNESS'],
      defaultValue: 100,
      type: 'float',
      description: 'Colorize brightness (potato preset)'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BG_BRIGHTNESS',
      uniformNames: ['HSM_BG_BRIGHTNESS'],
      defaultValue: 100,
      type: 'float',
      description: 'Background brightness'
    });

    this.addParameterSemantic({
      semantic: 'HSM_POTATO_SHOW_BG_OVER_SCREEN',
      uniformNames: ['HSM_POTATO_SHOW_BG_OVER_SCREEN'],
      defaultValue: 0,
      type: 'float',
      description: 'Show background over screen (potato preset)'
    });

    this.addParameterSemantic({
      semantic: 'HSM_BG_BLEND_MODE',
      uniformNames: ['HSM_BG_BLEND_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Background blend mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_CRT_SCREEN_BLEND_MODE',
      uniformNames: ['HSM_CRT_SCREEN_BLEND_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'CRT screen blend mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_SCREEN_VIGNETTE_IN_REFLECTION',
      uniformNames: ['HSM_SCREEN_VIGNETTE_IN_REFLECTION'],
      defaultValue: 0,
      type: 'float',
      description: 'Screen vignette in reflection'
    });

    // A/B Comparison Parameters
    this.addParameterSemantic({
      semantic: 'HSM_AB_COMPARE_AREA',
      uniformNames: ['HSM_AB_COMPARE_AREA'],
      defaultValue: 0,
      type: 'int',
      description: 'A/B comparison area'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AB_COMPARE_FREEZE_CRT_TUBE',
      uniformNames: ['HSM_AB_COMPARE_FREEZE_CRT_TUBE'],
      defaultValue: 0,
      type: 'int',
      description: 'Freeze CRT tube for A/B comparison'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AB_COMPARE_FREEZE_GRAPHICS',
      uniformNames: ['HSM_AB_COMPARE_FREEZE_GRAPHICS'],
      defaultValue: 0,
      type: 'int',
      description: 'Freeze graphics for A/B comparison'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AB_COMPARE_SHOW_MODE',
      uniformNames: ['HSM_AB_COMPARE_SHOW_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'A/B comparison show mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AB_COMPARE_SPLIT_POSITION',
      uniformNames: ['HSM_AB_COMPARE_SPLIT_POSITION'],
      defaultValue: 50,
      type: 'float',
      description: 'A/B comparison split position'
    });

    // Ambient Lighting Parameters
    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE',
      uniformNames: ['HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Ambient lighting image swap mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_CONTRAST',
      uniformNames: ['HSM_AMBIENT1_CONTRAST'],
      defaultValue: 100,
      type: 'float',
      description: 'Ambient light 1 contrast'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_DITHERING_SAMPLES',
      uniformNames: ['HSM_AMBIENT1_DITHERING_SAMPLES'],
      defaultValue: 0,
      type: 'int',
      description: 'Ambient light 1 dithering samples'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_HUE',
      uniformNames: ['HSM_AMBIENT1_HUE'],
      defaultValue: 0,
      type: 'float',
      description: 'Ambient light 1 hue'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_MIRROR_HORZ',
      uniformNames: ['HSM_AMBIENT1_MIRROR_HORZ'],
      defaultValue: 0,
      type: 'int',
      description: 'Ambient light 1 horizontal mirror'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_POSITION_X',
      uniformNames: ['HSM_AMBIENT1_POSITION_X'],
      defaultValue: 0,
      type: 'float',
      description: 'Ambient light 1 X position'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_POSITION_Y',
      uniformNames: ['HSM_AMBIENT1_POSITION_Y'],
      defaultValue: 0,
      type: 'float',
      description: 'Ambient light 1 Y position'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_POS_INHERIT_MODE',
      uniformNames: ['HSM_AMBIENT1_POS_INHERIT_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Ambient light 1 position inherit mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_ROTATE',
      uniformNames: ['HSM_AMBIENT1_ROTATE'],
      defaultValue: 0,
      type: 'float',
      description: 'Ambient light 1 rotation'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_SATURATION',
      uniformNames: ['HSM_AMBIENT1_SATURATION'],
      defaultValue: 100,
      type: 'float',
      description: 'Ambient light 1 saturation'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_SCALE',
      uniformNames: ['HSM_AMBIENT1_SCALE'],
      defaultValue: 100,
      type: 'float',
      description: 'Ambient light 1 scale'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_SCALE_INHERIT_MODE',
      uniformNames: ['HSM_AMBIENT1_SCALE_INHERIT_MODE'],
      defaultValue: 0,
      type: 'int',
      description: 'Ambient light 1 scale inherit mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_SCALE_KEEP_ASPECT',
      uniformNames: ['HSM_AMBIENT1_SCALE_KEEP_ASPECT'],
      defaultValue: 1,
      type: 'int',
      description: 'Ambient light 1 keep aspect ratio'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_SCALE_X',
      uniformNames: ['HSM_AMBIENT1_SCALE_X'],
      defaultValue: 100,
      type: 'float',
      description: 'Ambient light 1 X scale'
    });

    this.addParameterSemantic({
      semantic: 'HSM_AMBIENT1_VALUE',
      uniformNames: ['HSM_AMBIENT1_VALUE'],
      defaultValue: 100,
      type: 'float',
      description: 'Ambient light 1 value'
    });

    // Aspect Ratio Parameters
    this.addParameterSemantic({
      semantic: 'HSM_ASPECT_RATIO_EXPLICIT',
      uniformNames: ['HSM_ASPECT_RATIO_EXPLICIT'],
      defaultValue: 1.33,
      type: 'float',
      description: 'Explicit aspect ratio value'
    });

    this.addParameterSemantic({
      semantic: 'HSM_ASPECT_RATIO_MODE',
      uniformNames: ['HSM_ASPECT_RATIO_MODE'],
      defaultValue: 1,
      type: 'int',
      description: 'Aspect ratio mode'
    });

    this.addParameterSemantic({
      semantic: 'HSM_ASPECT_RATIO_ORIENTATION',
      uniformNames: ['HSM_ASPECT_RATIO_ORIENTATION'],
      defaultValue: 0,
      type: 'int',
      description: 'Aspect ratio orientation'
    });

    // Add more Mega Bezel parameters as needed...
    // This now covers the majority of commonly used parameters
  }

  /**
   * Initialize texture semantic definitions
   * Based on RetroArch's slang_texture_semantic
   */
  private initializeTextureSemantics(): void {
    // Core RetroArch texture semantics
    this.addTextureSemantic({
      semantic: 'Original',
      uniformNames: ['Original', 'ORIGINALTEXTURE', 'original'],
      textureUnit: 0,
      description: 'Original input texture'
    });

    this.addTextureSemantic({
      semantic: 'Source',
      uniformNames: ['Source', 'SOURCETEXTURE', 'source'],
      textureUnit: 1,
      description: 'Source texture (processed input)'
    });

    this.addTextureSemantic({
      semantic: 'OriginalHistory1',
      uniformNames: ['OriginalHistory1', 'PREVIOUSFRAME', 'originalHistory1'],
      textureUnit: 2,
      description: 'Previous frame for motion blur/TAA'
    });

    this.addTextureSemantic({
      semantic: 'OriginalHistory2',
      uniformNames: ['OriginalHistory2', 'originalHistory2'],
      textureUnit: 3,
      description: 'Second previous frame'
    });

    this.addTextureSemantic({
      semantic: 'OriginalHistory3',
      uniformNames: ['OriginalHistory3', 'originalHistory3'],
      textureUnit: 4,
      description: 'Third previous frame'
    });

    this.addTextureSemantic({
      semantic: 'OriginalHistory4',
      uniformNames: ['OriginalHistory4', 'originalHistory4'],
      textureUnit: 5,
      description: 'Fourth previous frame'
    });

    // Mega Bezel specific texture semantics
    this.addTextureSemantic({
      semantic: 'DerezedPass',
      uniformNames: ['DerezedPass', 'derezedPass'],
      textureUnit: 6,
      description: 'Derezed pass output'
    });

    this.addTextureSemantic({
      semantic: 'OriginalFeedback',
      uniformNames: ['OriginalFeedback', 'originalFeedback'],
      textureUnit: 7,
      description: 'Feedback texture for temporal effects'
    });

    this.addTextureSemantic({
      semantic: 'FinalViewportSize',
      uniformNames: ['FinalViewportSize', 'finalViewportSize'],
      textureUnit: 8,
      description: 'Final viewport size texture'
    });

    // LUT textures
    this.addTextureSemantic({
      semantic: 'LUT1',
      uniformNames: ['LUT1', 'lut1', 'LUT'],
      textureUnit: 9,
      description: 'Color lookup table 1'
    });

    this.addTextureSemantic({
      semantic: 'LUT2',
      uniformNames: ['LUT2', 'lut2'],
      textureUnit: 10,
      description: 'Color lookup table 2'
    });

    // Bezel graphics textures
    this.addTextureSemantic({
      semantic: 'BezelGraphics',
      uniformNames: ['BezelGraphics', 'bezelGraphics', 'BEZEL'],
      textureUnit: 11,
      description: 'Bezel graphics texture'
    });

    this.addTextureSemantic({
      semantic: 'ReflectionMask',
      uniformNames: ['ReflectionMask', 'reflectionMask'],
      textureUnit: 12,
      description: 'Reflection mask texture'
    });

    this.addTextureSemantic({
      semantic: 'AmbientLight1',
      uniformNames: ['AmbientLight1', 'ambientLight1'],
      textureUnit: 13,
      description: 'Ambient lighting texture 1'
    });

    this.addTextureSemantic({
      semantic: 'AmbientLight2',
      uniformNames: ['AmbientLight2', 'ambientLight2'],
      textureUnit: 14,
      description: 'Ambient lighting texture 2'
    });
  }

  /**
   * Add a parameter semantic definition
   */
  private addParameterSemantic(def: SemanticDefinition): void {
    this.parameterSemantics.set(def.semantic, def);
  }

  /**
   * Add a texture semantic definition
   */
  private addTextureSemantic(def: TextureSemanticDefinition): void {
    this.textureSemantics.set(def.semantic, def);
  }

  /**
   * Map parameter values to shader uniforms using semantic matching
   */
  mapParameters(
    parameterValues: Record<string, number>,
    availableUniforms: string[]
  ): SemanticMappingResult {
    const mappedParameters = new Map<string, { uniformName: string; value: any }>();
    const unmappedParameters: string[] = [];

    // Create a set of available uniforms for fast lookup
    const uniformSet = new Set(availableUniforms);

    // Try to map each parameter
    for (const [paramName, paramValue] of Object.entries(parameterValues)) {
      const semanticDef = this.parameterSemantics.get(paramName);

      if (semanticDef) {
        // Try to find a matching uniform name
        let mappedUniform: string | null = null;

        for (const uniformName of semanticDef.uniformNames) {
          if (uniformSet.has(uniformName)) {
            mappedUniform = uniformName;
            break;
          }
        }

        if (mappedUniform) {
          mappedParameters.set(paramName, {
            uniformName: mappedUniform,
            value: paramValue
          });
        } else {
          unmappedParameters.push(paramName);
        }
      } else {
        // No semantic definition found - try direct name matching
        if (uniformSet.has(paramName)) {
          mappedParameters.set(paramName, {
            uniformName: paramName,
            value: paramValue
          });
        } else {
          unmappedParameters.push(paramName);
        }
      }
    }

    return {
      mappedParameters,
      unmappedParameters,
      mappedTextures: new Map(),
      unmappedTextures: []
    };
  }

  /**
   * Map texture semantics to shader uniforms
   */
  mapTextures(
    availableTextures: Record<string, any>,
    availableUniforms: string[]
  ): { mappedTextures: Map<string, { uniformName: string; textureUnit: number }>; unmappedTextures: string[] } {
    const mappedTextures = new Map<string, { uniformName: string; textureUnit: number }>();
    const unmappedTextures: string[] = [];

    // Create a set of available uniforms for fast lookup
    const uniformSet = new Set(availableUniforms);

    // Try to map each texture
    for (const [textureSemantic, texture] of Object.entries(availableTextures)) {
      const semanticDef = this.textureSemantics.get(textureSemantic);

      if (semanticDef) {
        // Try to find a matching uniform name
        let mappedUniform: string | null = null;

        for (const uniformName of semanticDef.uniformNames) {
          if (uniformSet.has(uniformName)) {
            mappedUniform = uniformName;
            break;
          }
        }

        if (mappedUniform) {
          mappedTextures.set(textureSemantic, {
            uniformName: mappedUniform,
            textureUnit: semanticDef.textureUnit || 0
          });
        } else {
          unmappedTextures.push(textureSemantic);
        }
      } else {
        // No semantic definition found - try direct name matching
        if (uniformSet.has(textureSemantic)) {
          mappedTextures.set(textureSemantic, {
            uniformName: textureSemantic,
            textureUnit: 0 // Default texture unit
          });
        } else {
          unmappedTextures.push(textureSemantic);
        }
      }
    }

    return { mappedTextures, unmappedTextures };
  }

  /**
   * Get all parameter semantic definitions
   */
  getParameterSemantics(): Map<string, SemanticDefinition> {
    return new Map(this.parameterSemantics);
  }

  /**
   * Get all texture semantic definitions
   */
  getTextureSemantics(): Map<string, TextureSemanticDefinition> {
    return new Map(this.textureSemantics);
  }

  /**
   * Get a specific parameter semantic definition
   */
  getParameterSemantic(semantic: string): SemanticDefinition | undefined {
    return this.parameterSemantics.get(semantic);
  }

  /**
   * Get a specific texture semantic definition
   */
  getTextureSemantic(semantic: string): TextureSemanticDefinition | undefined {
    return this.textureSemantics.get(semantic);
  }

  /**
   * Add a custom parameter semantic definition
   */
  addCustomParameterSemantic(def: SemanticDefinition): void {
    this.parameterSemantics.set(def.semantic, def);
  }

  /**
   * Add a custom texture semantic definition
   */
  addCustomTextureSemantic(def: TextureSemanticDefinition): void {
    this.textureSemantics.set(def.semantic, def);
  }

  /**
   * Get semantic mapping statistics
   */
  getMappingStats(): {
    parameterSemantics: number;
    textureSemantics: number;
    totalUniformVariants: number;
  } {
    let totalUniformVariants = 0;

    for (const def of this.parameterSemantics.values()) {
      totalUniformVariants += def.uniformNames.length;
    }

    for (const def of this.textureSemantics.values()) {
      totalUniformVariants += def.uniformNames.length;
    }

    return {
      parameterSemantics: this.parameterSemantics.size,
      textureSemantics: this.textureSemantics.size,
      totalUniformVariants
    };
  }
}