/**
 * SlangPresetParser - Parses RetroArch .slangp preset files
 *
 * Specification: https://github.com/libretro/slang-shaders
 * Format: INI-like configuration defining multi-pass shader pipelines
 */

export interface SlangShaderPass {
  // Shader file path (relative to preset file)
  shader: string;

  // Filtering
  filterLinear: boolean;

  // Scaling
  scaleType: 'source' | 'viewport' | 'absolute';
  scale?: number;
  scaleX?: number;
  scaleY?: number;

  // Aliasing (for referencing in other shaders)
  alias?: string;

  // Framebuffer format
  srgbFramebuffer?: boolean;
  floatFramebuffer?: boolean;
  format?: string; // e.g., "R16G16B16A16_SFLOAT"

  // Texture options
  mipmapInput?: boolean;
  wrapMode?: 'clamp_to_edge' | 'repeat' | 'mirrored_repeat';

  // Frame delay (for temporal effects)
  frameCountMod?: number;
}

export interface SlangTexture {
  name: string;
  path: string;
  linear: boolean;
  wrapMode: 'clamp_to_edge' | 'repeat' | 'mirrored_repeat';
  mipmap: boolean;
}

export interface SlangParameter {
  name: string;
  value: number;
}

export interface SlangPreset {
  // Shader passes
  passes: SlangShaderPass[];

  // External textures (LUTs, bezel images, etc.)
  textures: SlangTexture[];

  // Parameter overrides
  parameters: SlangParameter[];

  // Reference to parent preset (if using #reference)
  reference?: string;

  // Original file path (for resolving relative paths)
  basePath?: string;
}

export class SlangPresetParser {
  /**
   * Parse a .slangp preset file from string content
   */
  public static parse(content: string, basePath: string = ''): SlangPreset {
    const lines = content.split('\n');
    const preset: SlangPreset = {
      passes: [],
      textures: [],
      parameters: [],
      basePath
    };

    // First pass: extract basic structure
    const config = this.parseINI(lines);

    // Check for #reference directive
    if (config['#reference']) {
      preset.reference = config['#reference'];
    }

    // Parse shader passes
    const shaderCount = parseInt(config['shaders'] || '0', 10);

    for (let i = 0; i < shaderCount; i++) {
      const pass = this.parseShaderPass(config, i);
      if (pass) {
        preset.passes.push(pass);
      }
    }

    // Parse textures
    const textureNames = this.parseList(config['textures']);
    for (const texName of textureNames) {
      const texture = this.parseTexture(config, texName);
      if (texture) {
        preset.textures.push(texture);
      }
    }

    // Parse parameters
    const paramNames = this.parseList(config['parameters']);
    for (const paramName of paramNames) {
      if (config[paramName] !== undefined) {
        preset.parameters.push({
          name: paramName,
          value: parseFloat(config[paramName])
        });
      }
    }

    return preset;
  }

  /**
   * Parse INI-style content into key-value pairs
   */
  private static parseINI(lines: string[]): Record<string, string> {
    const config: Record<string, string> = {};

    for (let line of lines) {
      // Remove comments
      const commentIndex = line.indexOf('//');
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex);
      }

      const hashCommentIndex = line.indexOf('#');
      if (hashCommentIndex !== -1 && !line.trim().startsWith('#reference')) {
        line = line.substring(0, hashCommentIndex);
      }

      line = line.trim();

      // Skip empty lines
      if (!line) continue;

      // Handle #reference directive
      if (line.startsWith('#reference')) {
        const match = line.match(/#reference\s+"([^"]+)"/);
        if (match) {
          config['#reference'] = match[1];
        }
        continue;
      }

      // Parse key = value
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) continue;

      const key = line.substring(0, equalIndex).trim();
      let value = line.substring(equalIndex + 1).trim();

      // Remove quotes
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }

      config[key] = value;
    }

    return config;
  }

  /**
   * Parse a shader pass configuration
   */
  private static parseShaderPass(
    config: Record<string, string>,
    index: number
  ): SlangShaderPass | null {
    const shaderPath = config[`shader${index}`];
    if (!shaderPath) return null;

    const pass: SlangShaderPass = {
      shader: shaderPath,
      filterLinear: this.parseBool(config[`filter_linear${index}`], true),
      scaleType: this.parseScaleType(config[`scale_type${index}`])
    };

    // Parse scale
    if (config[`scale${index}`]) {
      pass.scale = parseFloat(config[`scale${index}`]);
    }
    if (config[`scale_x${index}`]) {
      pass.scaleX = parseFloat(config[`scale_x${index}`]);
    }
    if (config[`scale_y${index}`]) {
      pass.scaleY = parseFloat(config[`scale_y${index}`]);
    }

    // Parse alias
    if (config[`alias${index}`]) {
      pass.alias = config[`alias${index}`];
    }

    // Parse framebuffer options
    if (config[`srgb_framebuffer${index}`]) {
      pass.srgbFramebuffer = this.parseBool(config[`srgb_framebuffer${index}`]);
    }
    if (config[`float_framebuffer${index}`]) {
      pass.floatFramebuffer = this.parseBool(config[`float_framebuffer${index}`]);
    }
    if (config[`format${index}`]) {
      pass.format = config[`format${index}`];
    }

    // Parse texture options
    if (config[`mipmap_input${index}`]) {
      pass.mipmapInput = this.parseBool(config[`mipmap_input${index}`]);
    }
    if (config[`wrap_mode${index}`]) {
      pass.wrapMode = this.parseWrapMode(config[`wrap_mode${index}`]);
    }

    // Parse frame count mod (for temporal effects)
    if (config[`frame_count_mod${index}`]) {
      pass.frameCountMod = parseInt(config[`frame_count_mod${index}`], 10);
    }

    return pass;
  }

  /**
   * Parse a texture configuration
   */
  private static parseTexture(
    config: Record<string, string>,
    name: string
  ): SlangTexture | null {
    const path = config[name];
    if (!path) return null;

    return {
      name,
      path,
      linear: this.parseBool(config[`${name}_linear`], true),
      wrapMode: this.parseWrapMode(config[`${name}_wrap_mode`] || 'clamp_to_edge'),
      mipmap: this.parseBool(config[`${name}_mipmap`], false)
    };
  }

  /**
   * Parse semicolon-separated list
   */
  private static parseList(value: string | undefined): string[] {
    if (!value) return [];
    return value.split(';').map(s => s.trim()).filter(s => s);
  }

  /**
   * Parse boolean value (true/false or 1/0)
   */
  private static parseBool(value: string | undefined, defaultValue = false): boolean {
    if (value === undefined) return defaultValue;
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1';
  }

  /**
   * Parse scale type
   */
  private static parseScaleType(value: string | undefined): 'source' | 'viewport' | 'absolute' {
    if (!value) return 'source';
    const lower = value.toLowerCase();
    if (lower === 'viewport') return 'viewport';
    if (lower === 'absolute') return 'absolute';
    return 'source';
  }

  /**
   * Parse wrap mode
   */
  private static parseWrapMode(value: string): 'clamp_to_edge' | 'repeat' | 'mirrored_repeat' {
    const lower = value.toLowerCase();
    if (lower === 'repeat') return 'repeat';
    if (lower === 'mirrored_repeat') return 'mirrored_repeat';
    return 'clamp_to_edge';
  }

  /**
   * Resolve relative path based on preset base path
   */
  public static resolvePath(basePath: string, relativePath: string): string {
    if (!basePath) return relativePath;

    // Simple path resolution (assumes Unix-style paths)
    const parts = basePath.split('/');
    parts.pop(); // Remove filename

    const relParts = relativePath.split('/');
    for (const part of relParts) {
      if (part === '..') {
        parts.pop();
      } else if (part !== '.') {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  /**
   * Load and parse preset from URL
   */
  public static async loadFromURL(url: string): Promise<SlangPreset> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load preset: ${response.statusText}`);
    }

    const content = await response.text();
    return this.parse(content, url);
  }

  /**
   * Serialize preset back to .slangp format
   */
  public static serialize(preset: SlangPreset): string {
    const lines: string[] = [];

    // Reference
    if (preset.reference) {
      lines.push(`#reference "${preset.reference}"`);
      lines.push('');
    }

    // Shader passes
    lines.push(`shaders = ${preset.passes.length}`);
    lines.push('');

    preset.passes.forEach((pass, i) => {
      lines.push(`shader${i} = "${pass.shader}"`);
      lines.push(`filter_linear${i} = ${pass.filterLinear}`);
      lines.push(`scale_type${i} = ${pass.scaleType}`);

      if (pass.scale !== undefined) {
        lines.push(`scale${i} = ${pass.scale}`);
      }
      if (pass.scaleX !== undefined) {
        lines.push(`scale_x${i} = ${pass.scaleX}`);
      }
      if (pass.scaleY !== undefined) {
        lines.push(`scale_y${i} = ${pass.scaleY}`);
      }
      if (pass.alias) {
        lines.push(`alias${i} = "${pass.alias}"`);
      }
      if (pass.srgbFramebuffer !== undefined) {
        lines.push(`srgb_framebuffer${i} = ${pass.srgbFramebuffer}`);
      }
      if (pass.floatFramebuffer !== undefined) {
        lines.push(`float_framebuffer${i} = ${pass.floatFramebuffer}`);
      }
      if (pass.format) {
        lines.push(`format${i} = ${pass.format}`);
      }
      if (pass.mipmapInput !== undefined) {
        lines.push(`mipmap_input${i} = ${pass.mipmapInput}`);
      }
      if (pass.wrapMode) {
        lines.push(`wrap_mode${i} = ${pass.wrapMode}`);
      }

      lines.push('');
    });

    // Textures
    if (preset.textures.length > 0) {
      const texNames = preset.textures.map(t => t.name).join(';');
      lines.push(`textures = "${texNames}"`);
      lines.push('');

      preset.textures.forEach(tex => {
        lines.push(`${tex.name} = "${tex.path}"`);
        lines.push(`${tex.name}_linear = ${tex.linear}`);
        lines.push(`${tex.name}_wrap_mode = ${tex.wrapMode}`);
        lines.push(`${tex.name}_mipmap = ${tex.mipmap}`);
        lines.push('');
      });
    }

    // Parameters
    if (preset.parameters.length > 0) {
      const paramNames = preset.parameters.map(p => p.name).join(';');
      lines.push(`parameters = "${paramNames}"`);
      lines.push('');

      preset.parameters.forEach(param => {
        lines.push(`${param.name} = ${param.value}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}
