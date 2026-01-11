/**
 * Mega Bezel Shader Compilation Pipeline
 *
 * Builds on the enhanced SlangShaderCompiler to provide:
 * - Complete preset compilation and validation
 * - Multi-pass shader pipeline creation
 * - Render target management
 * - Parameter binding and uniform setup
 * - Performance optimization
 */

import * as THREE from 'three';
import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';
import { BezelGraphicsManager } from './BezelGraphicsManager';

export interface ShaderPass {
  name: string;
  index: number;
  shader: CompiledShader;
  material: THREE.ShaderMaterial;
  renderTarget: THREE.WebGLRenderTarget | null;
  uniforms: Record<string, any>;
  parameters: string[]; // Parameters used by this pass
  inputs: string[]; // Input texture aliases
  outputs: string[]; // Output texture aliases
  alias?: string; // Output alias for this pass
}

export interface MegaBezelPreset {
  name: string;
  description: string;
  version: string;
  passes: ShaderPass[];
  parameters: Record<string, number>;
  textures: Record<string, string>;
  metadata: {
    author?: string;
    license?: string;
    requires?: string[];
  };
}

export interface CompilationOptions {
  webgl2: boolean;
  optimize: boolean;
  debug: boolean;
  maxPasses: number;
}

export interface CacheKey {
  presetPath: string;
  options: CompilationOptions;
}

export class ShaderCache {
  private cache: Map<string, { preset: MegaBezelPreset; timestamp: number }> = new Map();
  private maxAge: number = 5 * 60 * 1000; // 5 minutes
  private maxSize: number = 10; // Maximum cached presets

  /**
   * Generate cache key from preset path and options
   */
  private generateKey(cacheKey: CacheKey): string {
    return `${cacheKey.presetPath}:${JSON.stringify(cacheKey.options)}`;
  }

  /**
   * Check if preset is cached and valid
   */
  get(cacheKey: CacheKey): MegaBezelPreset | null {
    const key = this.generateKey(cacheKey);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.preset;
  }

  /**
   * Store preset in cache
   */
  set(cacheKey: CacheKey, preset: MegaBezelPreset): void {
    const key = this.generateKey(cacheKey);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      let oldestKey = '';
      let oldestTime = Date.now();

      for (const [k, v] of this.cache) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      preset,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; maxAge: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      maxAge: this.maxAge
    };
  }
}

export class MegaBezelCompiler {
  private shaderCompiler: SlangShaderCompiler;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;
  private bezelGraphics: BezelGraphicsManager;
  private cache: ShaderCache;

  constructor() {
    this.shaderCompiler = new SlangShaderCompiler();
    this.parameterManager = new ParameterManager();
    this.coordinateSystem = new MegaBezelCoordinateSystem(800, 600); // Default viewport
    this.bezelGraphics = new BezelGraphicsManager();
    this.cache = new ShaderCache();
  }

  /**
   * Compile a complete Mega Bezel preset
   */
  async compilePreset(
    presetPath: string,
    options: Partial<CompilationOptions> = {}
  ): Promise<MegaBezelPreset> {
    const opts: CompilationOptions = {
      webgl2: true,
      optimize: true,
      debug: false,
      maxPasses: 16,
      ...options
    };

    // Check cache first
    const cacheKey: CacheKey = { presetPath, options: opts };
    const cachedPreset = this.cache.get(cacheKey);
    if (cachedPreset) {
      console.log(`[MegaBezelCompiler] Using cached preset: ${presetPath}`);
      return cachedPreset;
    }

    console.log(`[MegaBezelCompiler] Compiling preset: ${presetPath}`);

    // Reset the global varying cache at the start of a new compilation session
    const { GlobalToVaryingConverter } = await import('./GlobalToVaryingConverter');
    GlobalToVaryingConverter.resetGlobalCache();

    // Load and parse preset file
    const presetContent = await this.loadPresetFile(presetPath);
    const presetData = this.parsePresetFile(presetContent, presetPath);

    // Load and compile all shaders
    const passes: ShaderPass[] = [];
    const totalPassesToCompile = Math.min(presetData.shaders.length, opts.maxPasses);
    for (let i = 0; i < totalPassesToCompile; i++) {
      const pass = await this.compileShaderPass(presetData, i, opts, totalPassesToCompile);
      passes.push(pass);

      if (opts.debug) {
        console.log(`[MegaBezelCompiler] Compiled pass ${i}: ${pass.name}`);
      }
    }

    // Load textures
    await this.loadPresetTextures(presetData);

    // Create parameter bindings
    const parameters = this.createParameterBindings(presetData, passes);

    const preset: MegaBezelPreset = {
      name: presetData.name || 'Unnamed Preset',
      description: presetData.description || '',
      version: presetData.version || '1.0',
      passes,
      parameters,
      textures: presetData.textures || {},
      metadata: presetData.metadata || {}
    };

    // Cache the compiled preset
    this.cache.set(cacheKey, preset);

    console.log(`[MegaBezelCompiler] Successfully compiled and cached preset with ${passes.length} passes`);
    return preset;
  }

  /**
   * Load preset file from URL or filesystem
   */
  private async loadPresetFile(presetPath: string): Promise<string> {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      // Browser environment - use fetch
      const response = await fetch(presetPath);
      if (!response.ok) {
        throw new Error(`Failed to load preset: ${response.statusText}`);
      }
      return await response.text();
    } else {
      // Node.js environment - read from filesystem
      const fs = await import('fs');
      const path = await import('path');

      // Convert web path to filesystem path
      let filePath = presetPath;
      if (filePath.startsWith('/')) {
        // Remove leading slash and assume it's relative to public directory
        filePath = path.join(process.cwd(), 'public', filePath.substring(1));
      } else {
        // Assume it's relative to the current working directory
        filePath = path.join(process.cwd(), filePath);
      }

      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch (error) {
        throw new Error(`Failed to read preset file ${filePath}: ${error}`);
      }
    }
  }

  /**
   * Parse .slangp preset file
   */
  private parsePresetFile(content: string, basePath: string): any {
    const lines = content.split('\n');
    const preset: any = {
      shaders: [],
      textures: {},
      parameters: {},
      metadata: {}
    };

    let currentSection = '';
    let shaderIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Section headers
      if (trimmed.includes('=')) {
        const [key, value] = trimmed.split('=', 2).map(s => s.trim());

        if (key.startsWith('shader')) {
          // Shader definition: shader0=shaders/guest/extras/hsm-drez-g-sharp_resampler.slang
          const index = parseInt(key.replace('shader', ''));
          preset.shaders[index] = {
            path: value,
            index,
            parameters: {}
          };
          shaderIndex = index;
        } else if (key.startsWith('filter_linear')) {
          // Filter mode: filter_linear0=false
          const index = parseInt(key.replace('filter_linear', ''));
          if (preset.shaders[index]) {
            preset.shaders[index].filterLinear = value === 'true';
          }
        } else if (key.startsWith('scale')) {
          // Scale parameters
          const index = this.extractScaleIndex(key);
          if (preset.shaders[index]) {
            this.parseScaleParameter(preset.shaders[index], key, value);
          }
        } else if (key.startsWith('wrap_mode')) {
          // Wrap mode
          const index = parseInt(key.replace('wrap_mode', ''));
          if (preset.shaders[index]) {
            preset.shaders[index].wrapMode = value;
          }
        } else if (key.startsWith('alias')) {
          // Output alias
          const index = parseInt(key.replace('alias', ''));
          if (preset.shaders[index]) {
            preset.shaders[index].alias = value;
          }
        } else if (key === 'textures') {
          // Texture list
          currentSection = 'textures';
        } else {
          // Parameter or texture definition
          if (currentSection === 'textures') {
            // Check if this is a texture setting (ends with known suffixes)
            const textureSettingSuffixes = ['_linear', '_mipmap', '_wrap', '_filter'];
            const isTextureSetting = textureSettingSuffixes.some(suffix => key.endsWith(suffix));

            if (isTextureSetting) {
              // Texture setting: SamplerLUT1_linear=true
              const textureName = key.substring(0, key.lastIndexOf('_'));
              if (!preset.textureSettings) {
                preset.textureSettings = {};
              }
              if (!preset.textureSettings[textureName]) {
                preset.textureSettings[textureName] = {};
              }
              const settingName = key.substring(key.lastIndexOf('_') + 1);
              preset.textureSettings[textureName][settingName] = value === 'true' || value === '1';
            } else if (key.includes('_')) {
              // This might be a texture name with underscore that's not a setting
              // For now, treat it as a texture path if it doesn't match known patterns
              preset.textures[key] = value;
            } else {
              // Texture list: "SamplerLUT1;SamplerLUT2;SamplerLUT3;SamplerLUT4;ScreenPlacementImage;BackgroundImage;BackgroundVertImage"
              const textureNames = value.replace(/"/g, '').split(';');
              preset.textureList = textureNames;
            }
          } else {
            // Global parameter
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              preset.parameters[key] = numValue;
            } else {
              preset.parameters[key] = value;
            }
          }
        }
      }
    }

    // Set base path for relative shader loading
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    preset.basePath = baseDir;

    return preset;
  }

  /**
   * Extract scale parameter index
   */
  private extractScaleIndex(key: string): number {
    const match = key.match(/scale(?:_type)?(?:_x|_y)?(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Parse scale parameter
   */
  private parseScaleParameter(shader: any, key: string, value: string): void {
    if (key.includes('scale_type')) {
      shader.scaleType = value;
    } else if (key.includes('scale_x')) {
      shader.scaleX = parseFloat(value);
    } else if (key.includes('scale_y')) {
      shader.scaleY = parseFloat(value);
    } else if (key.includes('scale') && !key.includes('_x') && !key.includes('_y')) {
      shader.scale = parseFloat(value);
    }
  }

  /**
   * Compile a single shader pass
   */
  private async compileShaderPass(
    presetData: any,
    passIndex: number,
    options: CompilationOptions,
    totalPasses: number
  ): Promise<ShaderPass> {
    const shaderData = presetData.shaders[passIndex];
    if (!shaderData) {
      throw new Error(`No shader data for pass ${passIndex}`);
    }

    // Construct full shader path
    const shaderPath = presetData.basePath
      ? `${presetData.basePath}${shaderData.path}`
      : shaderData.path;

    console.log(`[MegaBezelCompiler] Compiling shader pass ${passIndex}: ${shaderPath}`);

    // Compile shader - disable UBO preservation for WebGL compatibility
    const compiledShader = await SlangShaderCompiler.loadFromURL(shaderPath, options.webgl2, {});

    // Create Three.js material
    const material = this.createShaderMaterial(compiledShader, shaderData, passIndex);

    // Create render target (null for final pass)
    const renderTarget = passIndex < totalPasses - 1
      ? this.createRenderTarget(shaderData, 800, 600) // Use viewport size
      : null;

    // Extract parameter and texture dependencies
    const parameters = this.extractPassParameters(compiledShader);
    const inputs = this.extractPassInputs(compiledShader);
    const outputs = shaderData.alias ? [shaderData.alias] : [];

    const pass: ShaderPass = {
      name: shaderData.path.split('/').pop() || `pass_${passIndex}`,
      index: passIndex,
      shader: compiledShader,
      material,
      renderTarget,
      uniforms: material.uniforms,
      parameters,
      inputs,
      outputs,
      alias: shaderData.alias
    };

    return pass;
  }

  /**
   * Create Three.js shader material
   */
  private createShaderMaterial(
    compiledShader: CompiledShader,
    shaderData: any,
    passIndex: number
  ): THREE.ShaderMaterial {
    // Build uniforms object
    const uniforms: Record<string, THREE.IUniform> = {};

    // Add compiled shader uniforms
    compiledShader.uniforms.forEach(uniformName => {
      uniforms[uniformName] = { value: null };
    });

    // Add parameter uniforms
    compiledShader.parameters.forEach(param => {
      uniforms[param.name] = { value: param.default };
    });

    // Add standard Mega Bezel uniforms
    this.addStandardUniforms(uniforms);

    // Apply preset overrides
    if (shaderData.parameters) {
      Object.entries(shaderData.parameters).forEach(([key, value]) => {
        if (uniforms[key]) {
          uniforms[key].value = value;
        }
      });
    }

    // Strip #version directive from shaders since THREE.js adds it automatically with glslVersion: THREE.GLSL3
    let vertexShader = compiledShader.vertex.replace(/#version\s+[\d.]+\s*(?:es)?[\r\n]+/g, '');
    let fragmentShader = compiledShader.fragment.replace(/#version\s+[\d.]+\s*(?:es)?[\r\n]+/g, '');

    // Strip conflicting THREE.js attribute declarations (THREE.js provides these)
    // Remove: in vec4 Position; / in vec2 TexCoord; / in vec4 position; / in vec2 uv;
    vertexShader = vertexShader.replace(/^\s*in\s+vec[234]\s+(Position|position)\s*;.*$/gm, '');
    vertexShader = vertexShader.replace(/^\s*in\s+vec2\s+(TexCoord|uv)\s*;.*$/gm, '');

    // No FXAA injection needed - preprocessor handles it correctly

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      glslVersion: THREE.GLSL3,  // CRITICAL: Enable GLSL ES 3.0 / WebGL2
      depthTest: false,
      depthWrite: false
    });

    // Add error handling to catch shader compilation issues
    material.onBeforeCompile = (shader, renderer) => {
      console.log(`[MegaBezelCompiler] Compiling shader material for pass:`, passIndex);
    };

    // Listen for compilation errors (if supported)
    (material as any).needsUpdate = true;

    return material;
  }

  /**
   * Add standard Mega Bezel uniforms
   */
  private addStandardUniforms(uniforms: Record<string, THREE.IUniform>): void {
    // RetroArch standard uniforms
    uniforms['MVP'] = { value: new THREE.Matrix4() };
    uniforms['OutputSize'] = { value: new THREE.Vector4(800, 600, 1/800, 1/600) };
    uniforms['OriginalSize'] = { value: new THREE.Vector4(800, 600, 1/800, 1/600) };
    uniforms['SourceSize'] = { value: new THREE.Vector4(800, 600, 1/800, 1/600) };
    uniforms['FrameCount'] = { value: 0 };
    uniforms['FrameDirection'] = { value: 1.0 };

    // Source textures
    uniforms['Source'] = { value: null };
    uniforms['Original'] = { value: null };

    // History textures for temporal effects
    for (let i = 0; i < 4; i++) {
      uniforms[`OriginalHistory${i + 1}`] = { value: null };
    }
  }

  /**
   * Create render target for pass
   */
  private createRenderTarget(
    shaderData: any,
    width: number,
    height: number
  ): THREE.WebGLRenderTarget {
    // Calculate target size based on scale parameters
    let targetWidth = width;
    let targetHeight = height;

    if (shaderData.scaleType === 'source') {
      const scale = shaderData.scale || 1.0;
      const scaleX = shaderData.scaleX || scale;
      const scaleY = shaderData.scaleY || scale;
      targetWidth = Math.floor(width * scaleX);
      targetHeight = Math.floor(height * scaleY);
    }

    const renderTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
      minFilter: shaderData.filterLinear ? THREE.LinearFilter : THREE.NearestFilter,
      magFilter: shaderData.filterLinear ? THREE.LinearFilter : THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Set wrap mode
    const wrapMode = this.getWrapMode(shaderData.wrapMode || 'clamp_to_edge');
    renderTarget.texture.wrapS = wrapMode;
    renderTarget.texture.wrapT = wrapMode;

    return renderTarget;
  }

  /**
   * Get Three.js wrap mode
   */
  private getWrapMode(mode: string): THREE.Wrapping {
    switch (mode) {
      case 'repeat': return THREE.RepeatWrapping;
      case 'mirrored_repeat': return THREE.MirroredRepeatWrapping;
      case 'clamp_to_edge':
      default: return THREE.ClampToEdgeWrapping;
    }
  }

  /**
   * Extract parameters used by this pass
   */
  private extractPassParameters(compiledShader: CompiledShader): string[] {
    return compiledShader.parameters.map(p => p.name);
  }

  /**
   * Extract input texture names
   */
  private extractPassInputs(compiledShader: CompiledShader): string[] {
    const inputs: string[] = [];

    // Check for sampler uniforms
    compiledShader.samplers.forEach(sampler => {
      if (sampler !== 'Source' && sampler !== 'Original') {
        inputs.push(sampler);
      }
    });

    return inputs;
  }

  /**
   * Load preset textures
   */
  private async loadPresetTextures(presetData: any): Promise<void> {
    if (!presetData.textures) return;

    const textureConfigs: any[] = [];

    // Convert preset texture definitions to BezelGraphicsManager format
    Object.entries(presetData.textures).forEach(([name, path]) => {
      // Only process if it's a string AND looks like a valid file path
      if (typeof path === 'string' && this.isValidTexturePath(path)) {
        // Texture path definition
        const settings = this.getTextureSettings(name, path, presetData.textureSettings);
        textureConfigs.push({
          name,
          path: presetData.basePath ? `${presetData.basePath}${path}` : path,
          settings
        });
      } else {
        // Skip parameter values (like "1", "0", "2.5", etc.)
        console.log(`[MegaBezelCompiler] Skipping non-texture value for ${name}: ${path}`);
      }
    });

    // Load textures through BezelGraphicsManager
    console.log(`[MegaBezelCompiler] Loading ${textureConfigs.length} textures:`, textureConfigs.map(c => ({ name: c.name, path: c.path, settings: c.settings })));
    for (const config of textureConfigs) {
      try {
        await this.bezelGraphics.loadTextureFromPath(config.path, config.settings);
        console.log(`[MegaBezelCompiler] Successfully loaded texture: ${config.name} from ${config.path}`);
      } catch (error) {
        console.warn(`[MegaBezelCompiler] Failed to load texture ${config.name}:`, error);
      }
    }
  }

  /**
   * Check if a string looks like a valid texture path (not a parameter value)
   */
  private isValidTexturePath(path: string): boolean {
    // Parameter values are typically simple numbers like "0", "1", "2.5"
    // or parameter expressions like "= 1"
    if (path.includes('=')) return false; // Parameter assignment
    if (/^-?\d+(\.\d+)?$/.test(path)) return false; // Just a number
    if (path.length < 3) return false; // Too short to be a file path

    // Valid texture paths should contain file extensions or directory separators
    const hasFileExtension = /\.(png|jpg|jpeg|bmp|tga|dds)$/i.test(path);
    const hasPathSeparator = path.includes('/') || path.includes('\\');

    return hasFileExtension || hasPathSeparator;
  }

  /**
   * Get texture settings from parsed data or infer from name/path
   */
  private getTextureSettings(name: string, path: string, textureSettings?: any): any {
    // Start with inferred settings as defaults
    const settings = this.inferTextureSettings(name, path);

    // Override with parsed settings if available
    if (textureSettings && textureSettings[name]) {
      const parsed = textureSettings[name];
      if (parsed.linear !== undefined) {
        settings.filterMode = parsed.linear ? 'linear' : 'nearest';
      }
      if (parsed.mipmap !== undefined) {
        settings.mipmap = parsed.mipmap;
      }
      // Note: wrap and colorSpace settings would need additional parsing if present
    }

    return settings;
  }

  /**
   * Infer texture settings from name/path
   */
  private inferTextureSettings(name: string, path: string): any {
    // LUT textures
    if (name.includes('LUT') || path.includes('lut')) {
      return {
        wrapMode: 'clamp',
        filterMode: 'linear',
        mipmap: false,
        colorSpace: 'linear'
      };
    }

    // Background textures
    if (name.includes('Background') || path.includes('background')) {
      return {
        wrapMode: 'repeat',
        filterMode: 'linear',
        mipmap: true,
        colorSpace: 'srgb'
      };
    }

    // Screen placement masks
    if (name.includes('ScreenPlacement') || path.includes('placeholder')) {
      return {
        wrapMode: 'clamp',
        filterMode: 'nearest',
        mipmap: false,
        colorSpace: 'linear'
      };
    }

    // Default settings
    return {
      wrapMode: 'clamp',
      filterMode: 'linear',
      mipmap: false,
      colorSpace: 'srgb'
    };
  }

  /**
   * Create parameter bindings for the preset
   */
  private createParameterBindings(presetData: any, passes: ShaderPass[]): Record<string, number> {
    const parameters: Record<string, number> = {};

    // Collect all parameters from all passes
    passes.forEach(pass => {
      pass.parameters.forEach(paramName => {
        if (presetData.parameters && presetData.parameters[paramName] !== undefined) {
          parameters[paramName] = presetData.parameters[paramName];
        } else {
          // Use parameter default
          const param = pass.shader.parameters.find(p => p.name === paramName);
          if (param) {
            parameters[paramName] = param.default;
          }
        }
      });
    });

    return parameters;
  }

  /**
   * Update preset parameters
   */
  updateParameters(preset: MegaBezelPreset, parameters: Record<string, number>): void {
    // Update parameter manager
    Object.entries(parameters).forEach(([name, value]) => {
      this.parameterManager.setValue(name, value);
    });

    // Update pass uniforms
    preset.passes.forEach(pass => {
      Object.entries(parameters).forEach(([name, value]) => {
        if (pass.uniforms[name]) {
          pass.uniforms[name].value = value;
        }
      });
    });
  }

  /**
   * Get compilation statistics
   */
  getCompilationStats(preset: MegaBezelPreset): any {
    const totalParameters = Object.keys(preset.parameters).length;
    const totalTextures = Object.keys(preset.textures).length;
    const totalPasses = preset.passes.length;

    const parameterCategories = this.categorizeParameters(preset.parameters);

    return {
      passes: totalPasses,
      parameters: totalParameters,
      textures: totalTextures,
      parameterCategories,
      estimatedVRAM: this.estimateVRAMUsage(preset)
    };
  }

  /**
   * Categorize parameters by type
   */
  private categorizeParameters(parameters: Record<string, number>): Record<string, number> {
    const categories: Record<string, number> = {};

    Object.keys(parameters).forEach(name => {
      let category = 'other';

      if (name.startsWith('HSM_SCREEN_')) category = 'screen_layout';
      else if (name.startsWith('HSM_FAKE_') || name.startsWith('HSM_CRT_')) category = 'crt_effects';
      else if (name.includes('sat') || name.includes('cntrst') || name.includes('lum')) category = 'color_grading';
      else if (name.startsWith('HSM_BZL_')) category = 'bezel_settings';
      else if (name.startsWith('g_')) category = 'color_grading';

      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  /**
   * Estimate VRAM usage
   */
  private estimateVRAMUsage(preset: MegaBezelPreset): number {
    let vramBytes = 0;

    // Render targets (RGBA8)
    preset.passes.forEach(pass => {
      if (pass.renderTarget) {
        const width = pass.renderTarget.width;
        const height = pass.renderTarget.height;
        vramBytes += width * height * 4; // RGBA8
      }
    });

    // Loaded textures
    this.bezelGraphics.getAllTextures().forEach(texture => {
      const tex = texture.texture;
      const width = tex.image?.width || 512;
      const height = tex.image?.height || 512;
      const mipmaps = tex.generateMipmaps ? Math.log2(Math.max(width, height)) + 1 : 1;
      vramBytes += width * height * 4 * (1 / (1 - 1/4)) * mipmaps; // Rough mipmap estimate
    });

    return Math.round(vramBytes / (1024 * 1024)); // MB
  }

  /**
   * Dispose of compiled preset resources
   */
  disposePreset(preset: MegaBezelPreset): void {
    preset.passes.forEach(pass => {
      if (pass.renderTarget) {
        pass.renderTarget.dispose();
      }
      pass.material.dispose();
    });
  }

  /**
   * Clear shader cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; maxAge: number; hitRate?: number } {
    return this.cache.getStats();
  }

  /**
   * Set cache configuration
   */
  setCacheConfig(maxSize: number, maxAgeMs: number): void {
    this.cache = new ShaderCache();
    // Note: In a full implementation, we'd modify the cache instance properties
    // For now, we'll recreate with new settings
  }
}