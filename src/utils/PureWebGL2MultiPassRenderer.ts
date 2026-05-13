/**
 * Pure WebGL2 Multi-Pass Shader Renderer
 *
 * NO THREE.JS - Direct WebGL2 implementation
 * Executes Slang shader pipelines with zero abstraction overhead
 */

import { PureWebGL2Renderer } from './PureWebGL2Renderer';
import { SlangShaderCompiler, CompiledShader } from '../shaders/SlangShaderCompiler';

export interface ShaderPassConfig {
  name: string;
  shaderPath: string;
  filter: 'linear' | 'nearest';
  scale?: number;
  scaleType?: 'source' | 'viewport' | 'absolute';
  scaleX?: number;
  scaleY?: number;
  scaleTypeX?: 'source' | 'viewport' | 'absolute';
  scaleTypeY?: 'source' | 'viewport' | 'absolute';
  alias?: string;
  floatFramebuffer?: boolean;
  srgbFramebuffer?: boolean;  // Use sRGB framebuffer for gamma-correct blending
  mipmapInput?: boolean;  // Generate mipmaps for this pass's output
}

export interface PresetConfig {
  passes: ShaderPassConfig[];
  parameters?: Record<string, number>;
}

export class PureWebGL2MultiPassRenderer {
  private renderer: PureWebGL2Renderer;
  private passes: Map<string, CompiledShader> = new Map();
  private frameCount: number = 0;
  private width: number;
  private height: number;
  private presetParameters: Record<string, number> = {}; // Store parameters from preset
  private passAliases: Map<string, string> = new Map(); // Maps alias name to pass output texture name (e.g., "LinearizePass" -> "pass_11_output")
  private passConfigs: ShaderPassConfig[] = []; // Store pass configurations for alias lookup
  private pragmaDefaults: Record<string, number> = {}; // AUTO-EXTRACTED defaults from #pragma parameter lines
  private lutTextures: Map<string, string> = new Map(); // Maps LUT name to texture name (e.g., "SamplerLUT1" -> "lut_texture_1")

  // Feedback buffers: Store previous frame's output for temporal effects
  // Maps pass alias to feedback texture name (e.g., "DerezedPass" -> "DerezedPass_feedback")
  private feedbackBuffers: Map<string, string> = new Map();
  private feedbackPasses: Set<string> = new Set(); // Passes that need feedback buffers

  // Debug: limit passes for step-by-step debugging (0 = all passes)
  public maxPasses: number = 0;

  // Track if passthrough shader is compiled (separate from passes map)
  private _passthroughCompiled: boolean = false;

  // Dynamic shader parameters that can be set at runtime
  private _scanlinePulse: number = 0;  // 0.0 = normal, 1.0 = full pulse (used in Detroit mode)

  constructor(canvasOrContext: HTMLCanvasElement | WebGL2RenderingContext, width: number = 800, height: number = 600) {
    this.renderer = new PureWebGL2Renderer(canvasOrContext);
    this.width = width;
    this.height = height;

    // Create a 1x1 transparent dummy texture for unresolved samplers
    this.createDummyTexture();

    // console.log(`[PureWebGL2MultiPass] Initialized (${width}x${height})`);
  }

  /**
   * Set the scanline pulse intensity (0.0 = normal, 1.0 = full pulse)
   * Used for beat-reactive CRT effects in Detroit mode
   */
  setScanlinePulse(value: number): void {
    this._scanlinePulse = Math.max(0, Math.min(1, value));
  }

  /**
   * Create a 1x1 transparent dummy texture for unresolved samplers
   * This prevents WebGL errors when a shader samples from an unbound texture
   */
  private createDummyTexture(): void {
    const gl = this.renderer.getContext();
    const dummyTexture = gl.createTexture();
    if (dummyTexture) {
      gl.bindTexture(gl.TEXTURE_2D, dummyTexture);
      // 1x1 transparent pixel
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.renderer.registerTexture('__dummy_texture__', dummyTexture);
      console.log('[PureWebGL2MultiPass] Created dummy texture for unresolved samplers');
    }
  }

  /**
   * Load a single shader pass
   * Returns {success: boolean, pragmaName: string | undefined}
   */
  async loadShaderPass(name: string, shaderPath: string): Promise<{success: boolean, pragmaName?: string}> {
    try {
      // console.log(`[LoadShader] Loading ${name} from ${shaderPath}`);

      // Use loadFromURL which processes #include directives AND compiles
      const compiled = await SlangShaderCompiler.loadFromURL(
        shaderPath,
        true, // webgl2 = true
        this.presetParameters // Pass parameters for compile-time injection
      );

      // console.log(`[LoadShader] ${name} compiled: vertex=${compiled.vertex.length}chars, fragment=${compiled.fragment.length}chars, samplers=${compiled.samplerBindings?.length || 0}`);

      // Store compiled shader
      this.passes.set(name, compiled);

      // AUTO-EXTRACT pragma parameter defaults from compiled shader
      if (compiled.parameters && compiled.parameters.length > 0) {
        for (const param of compiled.parameters) {
          if (!(param.name in this.pragmaDefaults)) {
            this.pragmaDefaults[param.name] = param.default;
          }
        }
      }

      // Compile WebGL program
      const success = this.renderer.compileProgram(
        name,
        compiled.vertex,
        compiled.fragment
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] Failed to compile WebGL program for ${name}`);
        console.error(`[PureWebGL2MultiPass] Vertex shader (first 500 chars):`, compiled.vertex.substring(0, 500));
        console.error(`[PureWebGL2MultiPass] Fragment shader (first 500 chars):`, compiled.fragment.substring(0, 500));
        return {success: false};
      }

      // Debug: Log first pass shader source
      if (name === 'pass_0') {
        console.log('[DEBUG] pass_0 compiled vertex shader (first 800 chars):');
        console.log(compiled.vertex.substring(0, 800));
        console.log('[DEBUG] pass_0 compiled fragment shader (first 800 chars):');
        console.log(compiled.fragment.substring(0, 800));
      }

      // Return success and the shader's #pragma name if it has one
      return {success: true, pragmaName: compiled.name};
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading shader pass ${name} from ${shaderPath}:`, error);
      if (error instanceof Error) {
        console.error(`[PureWebGL2MultiPass] Error stack:`, error.stack);
      }
      return {success: false};
    }
  }

  /**
   * Load a preset (multiple passes)
   */
  async loadPreset(presetPath: string): Promise<boolean> {
    try {
      // console.log(`[PureWebGL2MultiPass] Loading preset: ${presetPath}`);

      // Fetch preset file (.slangp)
      const response = await fetch(presetPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.statusText}`);
      }

      const presetContent = await response.text();

      // Parse preset (simple .slangp parser)
      const config = this.parseSlangPreset(presetContent, presetPath);

      // Store parameters for use during rendering
      this.presetParameters = config.parameters || {};

      // Store pass configurations for alias lookup
      this.passConfigs = config.passes;

      // console.log(`[PureWebGL2MultiPass] Preset has ${config.passes.length} passes and ${Object.keys(this.presetParameters).length} parameters`);

      // Build alias map: alias name → pass output texture name
      for (let i = 0; i < config.passes.length; i++) {
        const pass = config.passes[i];
        if (pass.alias) {
          // Map alias to the pass's output texture (e.g., "LinearizePass" → "pass_11_output")
          this.passAliases.set(pass.alias, `${pass.name}_output`);
          // console.log(`[PureWebGL2MultiPass] Registered alias: ${pass.alias} → ${pass.name}_output`);
        }
      }

      // Load each shader pass and register pragma names as aliases
      for (const pass of config.passes) {
        const basePath = presetPath.substring(0, presetPath.lastIndexOf('/'));
        const fullPath = `${basePath}/${pass.shaderPath}`;

        const result = await this.loadShaderPass(pass.name, fullPath);
        if (!result.success) {
          console.error(`[PureWebGL2MultiPass] Failed to load pass: ${pass.name}`);
          return false;
        }

        // Register #pragma name as an alias (e.g., "DerezedPass" -> "pass_0_output")
        if (result.pragmaName) {
          this.passAliases.set(result.pragmaName, `${pass.name}_output`);
          console.log(`[ALIAS] Registered #pragma name: ${result.pragmaName} → ${pass.name}_output`);
        } else {
          console.log(`[ALIAS] Pass ${pass.name} has no #pragma name`);
        }
      }

      // Load LUT textures defined in preset
      await this.loadLUTTextures(presetContent, presetPath);

      // Create render targets for passes with proper sizing
      for (let i = 0; i < config.passes.length - 1; i++) {
        const pass = config.passes[i];
        const passName = pass.name;
        const useFloatFramebuffer = pass.floatFramebuffer || false;
        const useSrgbFramebuffer = pass.srgbFramebuffer || false;

        // Calculate dimensions based on scale parameters
        const { width, height } = this.calculatePassDimensions(pass, this.width, this.height);
        // console.log(`[PureWebGL2MultiPass] Creating ${passName}_output (${width}x${height}) float=${useFloatFramebuffer} srgb=${useSrgbFramebuffer}`);

        this.renderer.createRenderTarget(`${passName}_output`, width, height, useFloatFramebuffer, useSrgbFramebuffer);
      }

      // Detect and create feedback buffers for temporal effects
      // Scan all shaders for *Feedback samplers and create corresponding buffers
      this.createFeedbackBuffers(config.passes);

      // console.log(`✅ [PureWebGL2MultiPass] Preset loaded successfully`);
      return true;
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading preset:`, error);
      return false;
    }
  }

  /**
   * Parse .slangp preset file
   */
  private parseSlangPreset(content: string, basePath: string): PresetConfig {
    const lines = content.split('\n');
    const passes: ShaderPassConfig[] = [];
    const parameters: Record<string, number> = {};
    let shaderCount = 0;

    // Extract directory from preset path
    const presetDir = basePath.substring(0, basePath.lastIndexOf('/'));

    // Find number of shaders
    for (const line of lines) {
      if (line.startsWith('shaders')) {
        const match = line.match(/shaders\s*=\s*"?(\d+)"?/);
        if (match) {
          shaderCount = parseInt(match[1]);
        }
      }
    }

    // Parse each shader and its alias
    for (let i = 0; i < shaderCount; i++) {
      const shaderLine = lines.find(l => l.startsWith(`shader${i}`));
      if (!shaderLine) continue;

      // Match both quoted and unquoted paths: shader0 = "path" OR shader0 = path
      const match = shaderLine.match(/shader\d+\s*=\s*"?([^"\s]+)"?/);
      if (!match) continue;

      // Look for alias directive: alias0 = "AliasName" or alias0 = AliasName
      const aliasLine = lines.find(l => l.startsWith(`alias${i}`));
      let alias: string | undefined;
      if (aliasLine) {
        const aliasMatch = aliasLine.match(/alias\d+\s*=\s*"?([^"\s]+)"?/);
        if (aliasMatch) {
          alias = aliasMatch[1];
        }
      }

      // Look for float_framebuffer directive: float_framebuffer0 = "true"
      // IMPORTANT: Use word boundary to match EXACT number (e.g., float_framebuffer1 should NOT match float_framebuffer11)
      const floatFbRegex = new RegExp(`^float_framebuffer${i}\\s*=\\s*"?(true|false|1|0)"?`, 'i');
      let floatFramebuffer: boolean = false;
      for (const line of lines) {
        const match = line.match(floatFbRegex);
        if (match) {
          floatFramebuffer = match[1] === 'true' || match[1] === '1';
          break;
        }
      }

      // Look for srgb_framebuffer directive: srgb_framebuffer0 = "true"
      const srgbFbRegex = new RegExp(`^srgb_framebuffer${i}\\s*=\\s*"?(true|false|1|0)"?`, 'i');
      let srgbFramebuffer: boolean = false;
      for (const line of lines) {
        const match = line.match(srgbFbRegex);
        if (match) {
          srgbFramebuffer = match[1] === 'true' || match[1] === '1';
          break;
        }
      }

      // Look for mipmap_input directive: mipmap_input5 = true
      const mipmapRegex = new RegExp(`^mipmap_input${i}\\s*=\\s*"?(true|false|1|0)"?`, 'i');
      let mipmapInput: boolean = false;
      for (const line of lines) {
        const match = line.match(mipmapRegex);
        if (match) {
          mipmapInput = match[1] === 'true' || match[1] === '1';
          break;
        }
      }

      // Parse scale parameters
      const parseScaleValue = (str: string | undefined) => str ? parseFloat(str) : undefined;
      const scaleTypeRegex = new RegExp(`^scale_type${i}\\s*=\\s*"?([^"\\s]+)"?`);
      const scaleTypeXRegex = new RegExp(`^scale_type_x${i}\\s*=\\s*"?([^"\\s]+)"?`);
      const scaleTypeYRegex = new RegExp(`^scale_type_y${i}\\s*=\\s*"?([^"\\s]+)"?`);
      const scaleRegex = new RegExp(`^scale${i}\\s*=\\s*"?([\\d.]+)"?`);
      const scaleXRegex = new RegExp(`^scale_x${i}\\s*=\\s*"?([\\d.]+)"?`);
      const scaleYRegex = new RegExp(`^scale_y${i}\\s*=\\s*"?([\\d.]+)"?`);

      let scaleType: string | undefined;
      let scaleTypeX: string | undefined;
      let scaleTypeY: string | undefined;
      let scale: number | undefined;
      let scaleX: number | undefined;
      let scaleY: number | undefined;

      for (const line of lines) {
        const trimmed = line.trim();
        const stMatch = trimmed.match(scaleTypeRegex);
        if (stMatch) scaleType = stMatch[1];
        const stxMatch = trimmed.match(scaleTypeXRegex);
        if (stxMatch) scaleTypeX = stxMatch[1];
        const styMatch = trimmed.match(scaleTypeYRegex);
        if (styMatch) scaleTypeY = styMatch[1];
        const sMatch = trimmed.match(scaleRegex);
        if (sMatch) scale = parseScaleValue(sMatch[1]);
        const sxMatch = trimmed.match(scaleXRegex);
        if (sxMatch) scaleX = parseScaleValue(sxMatch[1]);
        const syMatch = trimmed.match(scaleYRegex);
        if (syMatch) scaleY = parseScaleValue(syMatch[1]);
      }

      // Keep path as-is - will be resolved relative to preset in loadPreset()
      const passConfig = {
        name: `pass_${i}`,
        shaderPath: match[1],
        filter: 'linear' as 'linear' | 'nearest',
        alias: alias,
        floatFramebuffer: floatFramebuffer,
        srgbFramebuffer: srgbFramebuffer,
        mipmapInput: mipmapInput,
        scaleType: scaleType as any,
        scaleTypeX: scaleTypeX as any,
        scaleTypeY: scaleTypeY as any,
        scale: scale,
        scaleX: scaleX,
        scaleY: scaleY
      };

      // Debug log disabled

      passes.push(passConfig);
    }

    // Parse parameters - any line with "PARAM_NAME = value" pattern
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // Skip shader/texture/filter/scale/alias definitions
      if (trimmed.startsWith('shader') || trimmed.startsWith('texture') ||
          trimmed.startsWith('filter') || trimmed.startsWith('scale') ||
          trimmed.startsWith('alias') || trimmed.startsWith('Sampler')) continue;

      // Match parameter lines: PARAM_NAME = value
      const paramMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*([0-9]+\.?[0-9]*)/);
      if (paramMatch) {
        parameters[paramMatch[1]] = parseFloat(paramMatch[2]);
      }
    }

    // console.log(`[PresetParser] Extracted ${Object.keys(parameters).length} parameters from preset`);
    if (Object.keys(parameters).length > 0) {
      // console.log('[PresetParser] Parameters:', parameters);
    }

    return { passes, parameters };
  }

  /**
   * Calculate framebuffer dimensions for a shader pass based on scale parameters
   */
  private calculatePassDimensions(pass: ShaderPassConfig, sourceWidth: number, sourceHeight: number): { width: number; height: number } {
    let width = sourceWidth;
    let height = sourceHeight;

    // Handle unified scale (scale + scaleType)
    if (pass.scale !== undefined && pass.scaleType) {
      if (pass.scaleType === 'absolute') {
        width = Math.floor(pass.scale);
        height = Math.floor(pass.scale);
      } else if (pass.scaleType === 'source') {
        width = Math.floor(sourceWidth * pass.scale);
        height = Math.floor(sourceHeight * pass.scale);
      }
      // viewport: would use viewport dimensions, but we treat as source for now
    }

    // Handle separate X scale
    // Use scaleTypeX if available, otherwise fall back to scaleType
    const effectiveScaleTypeX = pass.scaleTypeX || pass.scaleType;
    if (pass.scaleX !== undefined && effectiveScaleTypeX) {
      if (effectiveScaleTypeX === 'absolute') {
        width = Math.floor(pass.scaleX);
      } else if (effectiveScaleTypeX === 'source') {
        width = Math.floor(sourceWidth * pass.scaleX);
      }
    }

    // Handle separate Y scale
    // Use scaleTypeY if available, otherwise fall back to scaleType
    const effectiveScaleTypeY = pass.scaleTypeY || pass.scaleType;
    if (pass.scaleY !== undefined && effectiveScaleTypeY) {
      if (effectiveScaleTypeY === 'absolute') {
        height = Math.floor(pass.scaleY);
      } else if (effectiveScaleTypeY === 'source') {
        height = Math.floor(sourceHeight * pass.scaleY);
      }
    }

    // Ensure minimum dimensions
    width = Math.max(1, width);
    height = Math.max(1, height);

    return { width, height };
  }

  /**
   * Load all textures from preset (LUTs, tube effects, etc.)
   */
  private async loadLUTTextures(presetContent: string, presetPath: string): Promise<void> {
    const lines = presetContent.split('\n');
    const basePath = presetPath.substring(0, presetPath.lastIndexOf('/'));

    // Parse all key=value pairs for texture info
    const config: Record<string, string> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex !== -1) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim().replace(/["']/g, '');
        config[key] = value;
      }
    }

    // Get the full texture list
    const textureList = config['textures'];
    if (!textureList) {
      // Fallback: load just SamplerLUT textures (legacy behavior)
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const match = trimmed.match(/^(SamplerLUT\d+)\s*=\s*(.+)$/);
        if (match) {
          const lutName = match[1];
          const lutPath = match[2].trim().replace(/["']/g, '');
          const fullPath = `${basePath}/${lutPath}`;

          try {
            const img = await this.loadImage(fullPath);
            const textureName = `lut_texture_${lutName}`;
            this.renderer.createTextureFromImage(textureName, img, true);
            this.lutTextures.set(lutName, textureName);
          } catch (error) {
            console.error(`[PureWebGL2MultiPass] Failed to load LUT ${lutName}:`, error);
          }
        }
      }
      return;
    }

    // Parse texture names from the textures list
    const textureNames = textureList.split(';').map(s => s.trim()).filter(s => s);
    console.log(`[PureWebGL2MultiPass] Loading ${textureNames.length} textures: ${textureNames.join(', ')}`);

    for (const texName of textureNames) {
      const texPath = config[texName];
      if (!texPath) {
        console.warn(`[PureWebGL2MultiPass] No path found for texture: ${texName}`);
        continue;
      }

      // Parse texture settings
      const isLinear = config[`${texName}_linear`] === 'true' || config[`${texName}_linear`] === '1';
      const hasMipmap = config[`${texName}_mipmap`] === 'true' || config[`${texName}_mipmap`] === '1';
      const wrapMode = config[`${texName}_wrap_mode`] || 'clamp_to_edge';

      const fullPath = `${basePath}/${texPath}`;

      try {
        const img = await this.loadImage(fullPath);

        // For LUTs, use the lut_texture_ prefix for backward compatibility
        const textureName = texName.startsWith('SamplerLUT')
          ? `lut_texture_${texName}`
          : texName;  // Use original name for other textures

        // Create texture with appropriate settings
        this.renderer.createTextureFromImageWithSettings(textureName, img, {
          linear: isLinear,
          mipmap: hasMipmap,
          wrapMode: wrapMode
        });

        // Store mapping
        this.lutTextures.set(texName, textureName);
        console.log(`[PureWebGL2MultiPass] Loaded texture: ${texName} → ${textureName} (${img.width}x${img.height}, linear=${isLinear}, mipmap=${hasMipmap})`);
      } catch (error) {
        console.error(`[PureWebGL2MultiPass] Failed to load texture ${texName} from ${fullPath}:`, error);
      }
    }

    console.log(`[PureWebGL2MultiPass] Loaded ${this.lutTextures.size} textures total`);
  }

  /**
   * Load an image from URL
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  /**
   * Create feedback buffers for temporal effects
   * Scans all shaders for *Feedback samplers and creates matching textures
   */
  private createFeedbackBuffers(passes: ShaderPassConfig[]): void {
    // Scan all compiled shaders for feedback sampler references
    const feedbackNeeded = new Set<string>();

    for (const [passName, compiled] of this.passes.entries()) {
      if (compiled.samplerBindings) {
        for (const sampler of compiled.samplerBindings) {
          // Check for *Feedback pattern (e.g., DerezedPassFeedback, AfterglowPassFeedback)
          if (sampler.name.endsWith('Feedback')) {
            const baseName = sampler.name.replace('Feedback', '');
            feedbackNeeded.add(baseName);
          }
        }
      }
    }

    if (feedbackNeeded.size === 0) {
      return;
    }

    // console.log(`[Feedback] Creating ${feedbackNeeded.size} feedback buffers:`, Array.from(feedbackNeeded));

    // Create feedback textures for each needed pass
    for (const baseName of feedbackNeeded) {
      // Find the pass configuration that produces this output
      let passConfig: ShaderPassConfig | undefined;
      let outputTexture: string | undefined;

      // Check if baseName matches a pass alias
      if (this.passAliases.has(baseName)) {
        outputTexture = this.passAliases.get(baseName)!;
        const passIndex = this.passConfigs.findIndex(p => `${p.name}_output` === outputTexture);
        if (passIndex >= 0) {
          passConfig = this.passConfigs[passIndex];
        }
      }

      // Find dimensions and format from the pass config
      let width = this.width;
      let height = this.height;
      let useFloat = false;

      if (passConfig) {
        const dims = this.calculatePassDimensions(passConfig, this.width, this.height);
        width = dims.width;
        height = dims.height;
        useFloat = passConfig.floatFramebuffer || false;
      }

      // Create the feedback texture (will hold previous frame's output)
      const feedbackTextureName = `${baseName}_feedback`;
      this.renderer.createRenderTarget(feedbackTextureName, width, height, useFloat);
      this.feedbackBuffers.set(baseName, feedbackTextureName);
      this.feedbackPasses.add(baseName);

      // console.log(`[Feedback] Created ${feedbackTextureName} (${width}x${height}) float=${useFloat}`);
    }
  }

  /**
   * Copy current frame pass outputs to feedback buffers (called at end of frame)
   */
  private updateFeedbackBuffers(): void {
    const gl = this.renderer.getContext();

    for (const [baseName, feedbackTextureName] of this.feedbackBuffers.entries()) {
      // Find the source texture (current frame's output)
      const sourceTextureName = this.passAliases.get(baseName);
      if (!sourceTextureName) continue;

      const sourceTexture = this.renderer.getTexture(sourceTextureName);
      const feedbackTexture = this.renderer.getTexture(feedbackTextureName);

      if (!sourceTexture || !feedbackTexture) continue;

      // Copy source to feedback using framebuffer blit
      // Get or create a temporary framebuffer for reading
      const sourceFB = this.renderer['framebuffers'].get(sourceTextureName);
      const feedbackFB = this.renderer['framebuffers'].get(feedbackTextureName);

      if (sourceFB && feedbackFB) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFB);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, feedbackFB);

        // Get dimensions - use canvas size as fallback
        const width = gl.canvas.width;
        const height = gl.canvas.height;

        gl.blitFramebuffer(
          0, 0, width, height,
          0, 0, width, height,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      }
    }
  }

  /**
   * Dynamically resolve texture inputs based on shader's sampler bindings
   * This method reads what samplers the shader needs and maps them to available textures
   */
  private resolveTextureInputs(
    passName: string,
    passIndex: number,
    currentInput: string
  ): Record<string, string> {
    const compiled = this.passes.get(passName);
    const inputs: Record<string, string> = { Source: currentInput };

    // If shader has sampler bindings, use them for dynamic resolution
    if (compiled?.samplerBindings && compiled.samplerBindings.length > 0) {
      for (const sampler of compiled.samplerBindings) {
        const samplerName = sampler.name;

        // Skip Source - already handled
        if (samplerName === 'Source') continue;

        // Check if this sampler matches a pass alias
        if (this.passAliases.has(samplerName)) {
          const textureName = this.passAliases.get(samplerName)!;
          const aliasPassIndex = this.passConfigs.findIndex(p => `${p.name}_output` === textureName);
          if (aliasPassIndex >= 0 && aliasPassIndex < passIndex) {
            inputs[samplerName] = textureName;
          }
        }
        // Check if this sampler matches a LUT texture
        else if (this.lutTextures.has(samplerName)) {
          inputs[samplerName] = this.lutTextures.get(samplerName)!;
        }
        // Check for common texture patterns (DerezedPass, etc.)
        else if (samplerName === 'DerezedPass' && passIndex > 0) {
          inputs.DerezedPass = 'pass_0_output';
        }
        // Special case: Original is usually the first pass output
        else if (samplerName === 'Original' && passIndex > 0) {
          inputs.Original = 'pass_0_output';
        }
        // Check for feedback buffers (*Feedback pattern)
        else if (samplerName.endsWith('Feedback')) {
          const baseName = samplerName.replace('Feedback', '');
          const feedbackTexture = this.feedbackBuffers.get(baseName);
          if (feedbackTexture) {
            inputs[samplerName] = feedbackTexture;
          } else {
            inputs[samplerName] = '__dummy_texture__';
          }
        }
        // For unresolved samplers, bind a dummy texture to prevent WebGL errors
        else {
          inputs[samplerName] = '__dummy_texture__';
        }
      }
    }

    return inputs;
  }

  /**
   * Render a frame through the shader pipeline
   */
  render(inputTextureName: string): void {
    const gl = this.renderer.getContext();
    this.frameCount++;

    // NOTE: Removed clear to test if it's causing flashing
    // The last pass will render directly to screen, overwriting previous content
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // DEBUG: Sample input texture on first frame
    if (this.frameCount === 1) {
      // Check for any pending WebGL errors
      let glError = gl.getError();
      if (glError !== gl.NO_ERROR) {
        console.error(`[WebGL] ERROR before render: ${glError}`);
      }

      const inputTexture = this.renderer.getTexture(inputTextureName);
      if (inputTexture) {
        // Create temp framebuffer to read from input texture
        const tempFB = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, tempFB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, inputTexture, 0);

        // Check framebuffer status
        const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
          console.error(`[INPUT] Framebuffer incomplete: ${fbStatus}`);
        }

        const pixel = new Uint8Array(4);
        gl.readPixels(Math.floor(this.width/2), Math.floor(this.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.deleteFramebuffer(tempFB);
        const isBlack = pixel[0] < 5 && pixel[1] < 5 && pixel[2] < 5;
        console.log(`[INPUT] ${inputTextureName} center: rgb(${pixel[0]},${pixel[1]},${pixel[2]}) ${isBlack ? '⚫ INPUT IS BLACK!' : '✅'}`);

        // Also log some metadata
        console.log(`[DEBUG] Canvas size: ${gl.canvas.width}x${gl.canvas.height}, Renderer size: ${this.width}x${this.height}`);
        console.log(`[DEBUG] Total passes: ${this.passes.size}, Aliases: ${this.passAliases.size}`);
        const aliasArray = Array.from(this.passAliases.entries());
        console.log(`[DEBUG] Registered aliases (${aliasArray.length}): ${JSON.stringify(aliasArray.slice(0, 5))}...`);
      } else {
        console.error(`[INPUT] ERROR: Input texture "${inputTextureName}" not found!`);
      }
    }

    // Execute ALL shader passes in order
    const passNames = Array.from(this.passes.keys());
    if (passNames.length === 0) {
      console.warn('[PureWebGL2MultiPass] No shader passes loaded to render');
      return;
    }

    if (this.frameCount === 1 || this.frameCount % 60 === 0) {
      // console.log(`[PureWebGL2MultiPass] Frame ${this.frameCount}: Executing ${passNames.length} passes`);
    }

    // Execute each pass in sequence
    let currentInput = inputTextureName;

    // Debug: limit passes if maxPasses is set
    const effectivePassCount = this.maxPasses > 0 ? Math.min(this.maxPasses, passNames.length) : passNames.length;

    for (let i = 0; i < effectivePassCount; i++) {
      const passName = passNames[i];
      const isLastPass = (i === effectivePassCount - 1);

      if (this.frameCount === 1) {
        // console.log(`[PureWebGL2MultiPass] Executing pass ${i}: ${passName}, input: ${currentInput}, output: ${isLastPass ? 'screen' : passName + '_output'}`);
      }

      // For intermediate passes, render to a texture
      // For the last pass, render to screen (null)
      const outputTarget = isLastPass ? null : `${passName}_output`;

      // DYNAMIC TEXTURE RESOLUTION: Automatically resolve all sampler inputs
      // This uses the shader's samplerBindings to determine what textures it needs
      let inputTextures = this.resolveTextureInputs(passName, i, currentInput);

      // Debug: Log texture bindings for ALL passes
      const debugPasses = ['pass_0', 'pass_1', 'pass_2', 'pass_3', 'pass_4', 'pass_5', 'pass_6', 'pass_7', 'pass_9', 'pass_11', 'pass_15', 'pass_17'];
      if (this.frameCount === 1 && debugPasses.includes(passName)) {
        const compiled = this.passes.get(passName);
        const samplerNames = compiled?.samplerBindings?.map(s => s.name) || [];
        console.log(`[DEBUG ${passName}] Samplers declared in shader: ${JSON.stringify(samplerNames)}`);
        const textureBindings = Object.entries(inputTextures).map(([k, v]) => `${k}=${v}(${!!this.renderer.getTexture(v)})`);
        console.log(`[DEBUG ${passName}] Textures resolved: ${JSON.stringify(textureBindings)}`);

        // Extra debug for failing passes - dump vertex shader
        if (['pass_2', 'pass_3', 'pass_4', 'pass_5', 'pass_9', 'pass_15'].includes(passName)) {
          console.log(`[DEBUG ${passName}] passAliases entries:`, Array.from(this.passAliases.entries()));
          console.log(`[DEBUG ${passName}] current passIndex: ${i}, currentInput: ${currentInput}`);
          // Log vertex and fragment shaders to debug
          if (compiled) {
            // Find main() and gl_Position in vertex shader
            const vertLines = compiled.vertex.split('\n');
            const mainIdx = vertLines.findIndex(l => l.includes('void main'));
            console.log(`[DEBUG ${passName}] VERTEX SHADER main() found at line ${mainIdx}`);
            if (mainIdx >= 0) {
              console.log(`[DEBUG ${passName}] VERTEX SHADER main():`);
              console.log(vertLines.slice(mainIdx, mainIdx + 15).join('\n'));
            } else {
              console.log(`[DEBUG ${passName}] VERTEX SHADER has NO main() function!`);
              // Dump last 30 lines to see what's there
              console.log(vertLines.slice(Math.max(0, vertLines.length - 30)).join('\n'));
            }

            // Fragment shader - just main()
            const fragLines = compiled.fragment.split('\n');
            const fragMainIdx = fragLines.findIndex(l => l.includes('void main'));
            if (fragMainIdx >= 0) {
              console.log(`[DEBUG ${passName}] FRAGMENT SHADER main():`);
              console.log(fragLines.slice(fragMainIdx, fragMainIdx + 10).join('\n'));
            }
          }
        }
      }

      // FALLBACK: Add all aliased textures that weren't resolved dynamically
      // This ensures backward compatibility with presets that don't have full sampler info
      for (const [aliasName, textureName] of this.passAliases.entries()) {
        if (!(aliasName in inputTextures)) {
          const aliasPassIndex = this.passConfigs.findIndex(p => `${p.name}_output` === textureName);
          if (aliasPassIndex >= 0 && aliasPassIndex < i) {
            inputTextures[aliasName] = textureName;
          }
        }
      }

      // ADD ALL LUT TEXTURES (available to all passes)
      for (const [lutName, textureName] of this.lutTextures.entries()) {
        if (!(lutName in inputTextures)) {
          inputTextures[lutName] = textureName;
        }
      }

      // Debug: Log final texture bindings after fallback for pass_5
      if (this.frameCount === 1 && passName === 'pass_5') {
        const finalBindings = Object.entries(inputTextures).map(([k, v]) => `${k}=${v}`);
        console.log(`[DEBUG pass_5 FINAL] All textures after fallback: ${JSON.stringify(finalBindings)}`);
      }

      // Prefix preset parameters with PARAM_ to match shader uniform names
      const paramUniforms: Record<string, number> = {};
      for (const [key, value] of Object.entries(this.presetParameters)) {
        paramUniforms[`PARAM_${key}`] = value;
      }

      // AUTO-APPLY pragma parameter defaults for any parameters not in preset
      // These defaults were automatically extracted from #pragma parameter lines during shader compilation
      // Without defaults, parameters get 0.0 in WebGL, causing visual issues (e.g., pre_bb=0 → black output)
      // IMPORTANT: Apply BOTH prefixed (PARAM_) and non-prefixed names because:
      // - Push constant members that are ALSO globals → PARAM_membername uniforms
      // - Push constant members that are NOT globals → membername uniforms (no PARAM_)
      for (const [key, defaultValue] of Object.entries(this.pragmaDefaults)) {
        const paramKey = `PARAM_${key}`;
        if (!(paramKey in paramUniforms)) {
          paramUniforms[paramKey] = defaultValue;
        }
        // Also set non-prefixed name for push constant members that aren't globals
        if (!(key in paramUniforms)) {
          paramUniforms[key] = defaultValue;
        }
      }

      const success = this.renderer.executePass(
        passName,
        inputTextures,
        outputTarget,  // Output target
        { ...paramUniforms, FrameCount: this.frameCount, ScanlinePulse: this._scanlinePulse }  // Preset parameters with PARAM_ prefix + frame uniforms + dynamic params
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] Failed to execute pass ${i}: ${passName}`);
        return;
      }

      // First frame debug: log pass execution and sample center pixel
      if (this.frameCount === 1) {
        const gl = this.renderer.getContext();
        // Sample center pixel to check if pass outputs non-black
        if (!isLastPass && outputTarget) {
          const fb = this.renderer['framebuffers'].get(outputTarget);
          if (fb) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            const passConfig = this.passConfigs[i];
            const isFloat = passConfig?.floatFramebuffer || false;

            let r = 0, g = 0, b = 0;
            if (isFloat) {
              // Float framebuffer: read as float and convert to 0-255
              const floatPixel = new Float32Array(4);
              gl.readPixels(Math.floor(this.width/2), Math.floor(this.height/2), 1, 1, gl.RGBA, gl.FLOAT, floatPixel);
              r = Math.floor(Math.max(0, Math.min(255, floatPixel[0] * 255)));
              g = Math.floor(Math.max(0, Math.min(255, floatPixel[1] * 255)));
              b = Math.floor(Math.max(0, Math.min(255, floatPixel[2] * 255)));
            } else {
              const pixel = new Uint8Array(4);
              gl.readPixels(Math.floor(this.width/2), Math.floor(this.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              r = pixel[0]; g = pixel[1]; b = pixel[2];
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            const isBlack = r < 5 && g < 5 && b < 5;
            console.log(`[Pass ${i}] ${passName} center: rgb(${r},${g},${b})${isFloat ? ' (float)' : ''} ${isBlack ? '⚫' : '✅'}`);
          }
        } else {
          console.log(`[Pass ${i}] ${passName} → screen`);
        }
      }

      // MIPMAP GENERATION: If the NEXT pass needs mipmaps, generate them now for THIS pass's output
      // The mipmap_input flag means "this pass's INPUT needs mipmaps"
      // So if pass i+1 has mipmap_input=true, we need to generate mipmaps for pass i's output
      const nextPassConfig = this.passConfigs[i + 1];
      if (nextPassConfig?.mipmapInput && !isLastPass && outputTarget) {
        const gl = this.renderer.getContext();
        const texture = this.renderer.getTexture(outputTarget);
        if (texture) {
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          if (this.frameCount === 1) {
            console.log(`[Mipmap] Generated mipmaps for ${outputTarget} (pass ${i+1} needs them)`);
          }
        }
      }


      // Next pass uses this pass's output as input
      if (!isLastPass) {
        currentInput = `${passName}_output`;
      }
    }

    // Update feedback buffers with this frame's output (for next frame's temporal effects)
    if (this.feedbackBuffers.size > 0) {
      this.updateFeedbackBuffers();
    }

    if (this.frameCount === 1) {
      // console.log(`[PureWebGL2MultiPass] ✅ All ${passNames.length} passes executed successfully`);
    }
  }

  /**
   * Debug: Render input texture directly to screen, bypassing all shader passes
   * Use this to verify the input texture is not black
   */
  renderPassthrough(inputTextureName: string): void {
    const gl = this.renderer.getContext();

    // Clear screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Get input texture
    const inputTexture = this.renderer.getTexture(inputTextureName);
    if (!inputTexture) {
      console.error(`[Passthrough] Input texture "${inputTextureName}" not found!`);
      return;
    }

    // Compile a minimal passthrough shader if not already done
    if (!this._passthroughCompiled) {
      const passthroughVS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
out vec2 vTexCoord;
void main() {
  gl_Position = vec4(Position.xy, 0.0, 1.0);
  vTexCoord = TexCoord;
}`;
      const passthroughFS = `#version 300 es
precision highp float;
in vec2 vTexCoord;
out vec4 FragColor;
uniform sampler2D Source;
void main() {
  FragColor = texture(Source, vTexCoord);
}`;
      const success = this.renderer.compileProgram('__passthrough__', passthroughVS, passthroughFS);
      if (!success) {
        console.error('[Passthrough] Failed to compile passthrough shader!');
        return;
      }
      this._passthroughCompiled = true;
    }

    // Execute passthrough
    this.renderer.executePass('__passthrough__', { Source: inputTextureName }, null, {});
    // Removed per-frame console.log — DevTools-open + 60Hz logging tanks Chrome performance.
  }

  /**
   * Get the WebGL2 context
   */
  getContext(): WebGL2RenderingContext {
    return this.renderer.getContext();
  }

  /**
   * Create a texture from image data
   * Registers it directly with the renderer
   */
  createTexture(name: string, width: number, height: number, data?: Uint8Array): boolean {
    return this.renderer.createRenderTarget(name, width, height);
  }

  /**
   * Register an existing WebGL texture
   */
  registerTexture(name: string, texture: WebGLTexture): void {
    // Only log on first registration to reduce console spam
    if (this.frameCount === 1) {
      // console.log(`[PureWebGL2MultiPass] Registered texture: ${name}`);
    }
    // Actually register the texture with the renderer!
    this.renderer.registerTexture(name, texture);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.passes.clear();
  }

  /**
   * Get pass info for debugging
   */
  getPassInfo(): Array<{index: number, name: string, alias: string, shader: string}> {
    return this.passConfigs.map((config, i) => ({
      index: i,
      name: `pass_${i}`,
      alias: config.alias || '',
      shader: config.shaderPath
    }));
  }

  /**
   * Get total pass count
   */
  getPassCount(): number {
    return this.passConfigs.length;
  }

  /**
   * Handle canvas resize - updates internal size and render targets
   */
  resize(newWidth: number, newHeight: number): void {
    this.width = newWidth;
    this.height = newHeight;

    // Update all render targets to new size
    this.renderer.resizeAllTargets(newWidth, newHeight);

    console.log(`[PureWebGL2MultiPass] Resized to ${newWidth}x${newHeight}`);
  }
}
