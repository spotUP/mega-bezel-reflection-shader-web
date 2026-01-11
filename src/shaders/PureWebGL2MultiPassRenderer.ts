/**
 * Pure WebGL2 Multi-Pass Shader Renderer
 *
 * NO THREE.JS - Direct WebGL2 implementation
 * Executes Slang shader pipelines with zero abstraction overhead
 */

import { PureWebGL2Renderer } from './PureWebGL2Renderer';
import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';

export interface ShaderPassConfig {
  name: string;
  shaderPath: string;
  filter: 'linear' | 'nearest';
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  scaleType?: 'source' | 'viewport' | 'absolute';
  scaleTypeX?: 'source' | 'viewport' | 'absolute';
  scaleTypeY?: 'source' | 'viewport' | 'absolute';
  alias?: string;
  floatFramebuffer?: boolean;
  srgbFramebuffer?: boolean;
  mipmapInput?: boolean;
}

export interface TextureConfig {
  name: string;
  path: string;
  linear: boolean;
  mipmap: boolean;
}

export interface PresetConfig {
  passes: ShaderPassConfig[];
  parameters?: Record<string, number>;
  textures?: TextureConfig[];
}

export class PureWebGL2MultiPassRenderer {
  private renderer: PureWebGL2Renderer;
  private passes: Map<string, CompiledShader> = new Map();
  private passConfigs: ShaderPassConfig[] = []; // Store full pass configs for rendering
  private aliasMap: Map<string, string> = new Map(); // Map alias names to output texture names
  private frameCount: number = 0;
  private width: number;
  private height: number;
  private presetParameters: Record<string, number> = {}; // Store parameters from preset
  private parameterDefaults: Record<string, number> = {}; // Store defaults from shader #pragma parameters
  private presetTextureNames: string[] = []; // Texture names from preset (BackgroundImage, FrameTextureImage, etc.)

  // Debug: limit passes for step-by-step debugging (0 = all passes)
  public maxPasses: number = 0;

  constructor(glContext: WebGL2RenderingContext, width: number = 800, height: number = 600) {
    this.renderer = new PureWebGL2Renderer(glContext);
    this.width = width;
    this.height = height;

    console.log(`[PureWebGL2MultiPass] Initialized (${width}x${height})`);
  }

  /**
   * Load a single shader pass
   */
  async loadShaderPass(name: string, shaderPath: string): Promise<boolean> {
    try {
      console.log(`[PureWebGL2MultiPass] Loading shader: ${name} from ${shaderPath}`);

      // Use loadFromURL which processes #include directives AND compiles
      // This is CRITICAL - it processes globals.inc which contains the UBO!
      const compiled = await SlangShaderCompiler.loadFromURL(shaderPath, true); // webgl2 = true

      console.log(`[PureWebGL2MultiPass] Compiled ${name}:`, {
        vertexLength: compiled.vertex.length,
        fragmentLength: compiled.fragment.length,
        parameters: compiled.parameters.length
      });

      // Store compiled shader
      this.passes.set(name, compiled);

      // Collect parameter defaults from this shader (don't override existing)
      for (const param of compiled.parameters) {
        if (!(param.name in this.parameterDefaults)) {
          this.parameterDefaults[param.name] = param.default;
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
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading shader pass ${name}:`, error);
      console.error(`[PureWebGL2MultiPass] Error message: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[PureWebGL2MultiPass] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
      return false;
    }
  }

  /**
   * Load a preset (multiple passes)
   */
  async loadPreset(presetPath: string): Promise<boolean> {
    console.log('[PureWebGL2MultiPass] loadPreset() called with:', presetPath);
    try {

      // Fetch preset file (.slangp) with cache busting
      const cacheBuster = `?t=${Date.now()}`;
      const response = await fetch(presetPath + cacheBuster);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.statusText}`);
      }

      const presetContent = await response.text();
      console.log('[PureWebGL2MultiPass] Preset content length:', presetContent.length);

      // Parse preset (simple .slangp parser)
      const config = this.parseSlangPreset(presetContent, presetPath);

      // Store parameters for use during rendering
      this.presetParameters = config.parameters || {};
      console.log(`[PureWebGL2MultiPass] Loaded ${Object.keys(this.presetParameters).length} preset parameters`);
      const hsmParams = Object.entries(this.presetParameters).filter(([k]) => k.startsWith('HSM_FLIP'));
      if (hsmParams.length > 0) {
        console.log(`[PureWebGL2MultiPass] HSM_FLIP params: ${hsmParams.map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      console.log(`[PureWebGL2MultiPass] Parsed ${config.passes.length} passes:`);
      config.passes.forEach((p, i) => console.log(`  [${i}] ${p.name}: ${p.shaderPath}`));

      if (config.passes.length === 0) {
        console.error('[PureWebGL2MultiPass] ❌ NO PASSES FOUND! Check parser regex.');
        return false;
      }

      // Store pass configs for rendering
      this.passConfigs = config.passes;

      // Load each shader pass
      for (const pass of config.passes) {
        const basePath = presetPath.substring(0, presetPath.lastIndexOf('/'));
        const fullPath = `${basePath}/${pass.shaderPath}`;
        console.log(`[PureWebGL2MultiPass] Loading pass ${pass.name} from ${fullPath}`);

        const success = await this.loadShaderPass(pass.name, fullPath);
        if (!success) {
          console.error(`[PureWebGL2MultiPass] ❌ Failed to load pass: ${pass.name}`);
          return false;
        }
        console.log(`[PureWebGL2MultiPass] ✅ Loaded pass: ${pass.name}`);
      }

      // Create render targets for passes (all except last which renders to screen)
      console.log(`[PureWebGL2MultiPass] Creating ${config.passes.length - 1} render targets with proper formats...`);
      for (let i = 0; i < config.passes.length - 1; i++) {
        const pass = config.passes[i];
        const targetName = `${pass.name}_output`;

        // Calculate render target size based on scale type
        let targetWidth = this.width;
        let targetHeight = this.height;

        const scaleTypeX = pass.scaleTypeX || pass.scaleType || 'source';
        const scaleTypeY = pass.scaleTypeY || pass.scaleType || 'source';
        const scaleX = pass.scaleX ?? pass.scale ?? 1.0;
        const scaleY = pass.scaleY ?? pass.scale ?? 1.0;

        if (scaleTypeX === 'absolute') {
          targetWidth = scaleX;
        } else if (scaleTypeX === 'viewport') {
          targetWidth = this.width * scaleX;
        } else {
          targetWidth = this.width * scaleX;
        }

        if (scaleTypeY === 'absolute') {
          targetHeight = scaleY;
        } else if (scaleTypeY === 'viewport') {
          targetHeight = this.height * scaleY;
        } else {
          targetHeight = this.height * scaleY;
        }

        // Create render target with proper format
        const success = this.renderer.createRenderTarget(
          targetName,
          Math.max(1, Math.round(targetWidth)),
          Math.max(1, Math.round(targetHeight)),
          pass.floatFramebuffer || false,
          pass.srgbFramebuffer || false
        );

        const formatStr = pass.floatFramebuffer ? '[FLOAT]' : pass.srgbFramebuffer ? '[sRGB]' : '';
        console.log(`[PureWebGL2MultiPass] Render target ${targetName} (${Math.round(targetWidth)}x${Math.round(targetHeight)}) ${formatStr}: ${success ? '✅' : '❌'}`);

        // Register alias if present
        if (pass.alias) {
          this.aliasMap.set(pass.alias, targetName);
          // Also register texture with alias name directly
          this.renderer.registerTexture(pass.alias, this.renderer.getTexture(targetName)!);
          console.log(`[PureWebGL2MultiPass] Registered alias: ${pass.alias} -> ${targetName}`);
        }
      }

      // Log collected parameter defaults
      console.log(`[PureWebGL2MultiPass] Collected ${Object.keys(this.parameterDefaults).length} parameter defaults from shaders`);
      // Log important CRT parameters for debugging
      const importantParams = ['gamma_out', 'post_br', 'brightboost', 'brightboost1', 'shadowMask', 'gamma_c'];
      const importantDefaults = importantParams
        .filter(p => p in this.parameterDefaults)
        .map(p => `${p}=${this.parameterDefaults[p]}`)
        .join(', ');
      if (importantDefaults) {
        console.log(`[PureWebGL2MultiPass] Important parameter defaults: ${importantDefaults}`);
      }

      // Load textures from preset
      this.presetTextureNames = []; // Reset
      if (config.textures && config.textures.length > 0) {
        const basePath = presetPath.substring(0, presetPath.lastIndexOf('/'));
        console.log(`[PureWebGL2MultiPass] Loading ${config.textures.length} textures...`);
        for (const tex of config.textures) {
          const texPath = `${basePath}/${tex.path}`;
          const success = await this.loadImageTexture(tex.name, texPath, tex.linear, tex.mipmap);
          if (success) {
            this.presetTextureNames.push(tex.name);
            console.log(`[PureWebGL2MultiPass] ✅ Loaded texture: ${tex.name}`);
          } else {
            console.warn(`[PureWebGL2MultiPass] ⚠️ Failed to load texture: ${tex.name} from ${texPath}`);
          }
        }
      }

      console.log(`✅ [PureWebGL2MultiPass] Preset loaded successfully with ${this.passes.size} passes, ${this.aliasMap.size} aliases`);
      return true;
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading preset:`, error);
      return false;
    }
  }

  /**
   * Load an image texture from URL
   */
  private async loadImageTexture(name: string, url: string, linear: boolean, mipmap: boolean): Promise<boolean> {
    const gl = this.renderer.getContext();

    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';

      image.onload = () => {
        const texture = gl.createTexture();
        if (!texture) {
          console.error(`[PureWebGL2MultiPass] Failed to create texture for ${name}`);
          resolve(false);
          return;
        }

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // Set filtering
        if (mipmap) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_NEAREST);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Register with renderer
        this.renderer.registerTexture(name, texture);
        console.log(`[PureWebGL2MultiPass] Texture ${name} loaded (${image.width}x${image.height})`);
        resolve(true);
      };

      image.onerror = (err) => {
        console.error(`[PureWebGL2MultiPass] Failed to load image: ${url}`, err);
        resolve(false);
      };

      image.src = url;
    });
  }

  /**
   * Parse .slangp preset file
   */
  private parseSlangPreset(content: string, basePath: string): PresetConfig {
    console.log('[PureWebGL2MultiPass] parseSlangPreset() called');
    const lines = content.split('\n');
    const passes: ShaderPassConfig[] = [];
    const parameters: Record<string, number> = {};
    let shaderCount = 0;

    // Find number of shaders
    for (const line of lines) {
      if (line.startsWith('shaders')) {
        const match = line.match(/shaders\s*=\s*"?(\d+)"?/);
        if (match) {
          shaderCount = parseInt(match[1]);
        }
      }
    }

    // Helper to get property value for a pass
    const getPassProp = (passIdx: number, prop: string): string | undefined => {
      const regex = new RegExp(`^${prop}${passIdx}\\s*=\\s*"?([^"\\s]+)"?`, 'm');
      const match = content.match(regex);
      return match ? match[1] : undefined;
    };

    // Parse each shader with all its properties
    for (let i = 0; i < shaderCount; i++) {
      const shaderPath = getPassProp(i, 'shader');
      if (!shaderPath) continue;

      const alias = getPassProp(i, 'alias');
      const filterLinear = getPassProp(i, 'filter_linear');
      const floatFb = getPassProp(i, 'float_framebuffer');
      const srgbFb = getPassProp(i, 'srgb_framebuffer');
      const mipmapInput = getPassProp(i, 'mipmap_input');
      const scaleType = getPassProp(i, 'scale_type');
      const scaleTypeX = getPassProp(i, 'scale_type_x');
      const scaleTypeY = getPassProp(i, 'scale_type_y');
      const scale = getPassProp(i, 'scale');
      const scaleX = getPassProp(i, 'scale_x');
      const scaleY = getPassProp(i, 'scale_y');

      const passConfig: ShaderPassConfig = {
        name: `pass_${i}`,
        shaderPath: shaderPath,
        filter: filterLinear === 'false' ? 'nearest' : 'linear',
        alias: alias,
        floatFramebuffer: floatFb === 'true',
        srgbFramebuffer: srgbFb === 'true',
        mipmapInput: mipmapInput === 'true',
        scaleType: (scaleType as any) || 'source',
        scaleTypeX: (scaleTypeX as any),
        scaleTypeY: (scaleTypeY as any),
        scale: scale ? parseFloat(scale) : undefined,
        scaleX: scaleX ? parseFloat(scaleX) : undefined,
        scaleY: scaleY ? parseFloat(scaleY) : undefined,
      };

      passes.push(passConfig);
      console.log(`[PresetParser] Pass ${i}: ${shaderPath}${alias ? ` (alias: ${alias})` : ''}${floatFb === 'true' ? ' [FLOAT]' : ''}${srgbFb === 'true' ? ' [sRGB]' : ''}`);
    }

    // Parse parameters - any line with "key = value" pattern
    console.log('[PresetParser] Starting parameter extraction...');
    for (const line of lines) {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // Skip shader/texture/filter/scale/alias definitions
      if (trimmed.startsWith('shader') || trimmed.startsWith('texture') ||
          trimmed.startsWith('filter') || trimmed.startsWith('scale') ||
          trimmed.startsWith('alias') || trimmed.startsWith('Sampler')) continue;

      // Match parameter lines: PARAM_NAME = value (handles integers and decimals)
      const paramMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*([0-9]+\.?[0-9]*)/);
      if (paramMatch) {
        const paramName = paramMatch[1];
        const paramValue = parseFloat(paramMatch[2]);
        parameters[paramName] = paramValue;
      }
    }

    console.log(`[PresetParser] ✅ Extracted ${Object.keys(parameters).length} parameters`);
    if (Object.keys(parameters).length > 0) {
      console.log('[PresetParser] Parameters:', JSON.stringify(parameters, null, 2));
    }

    // Parse textures - format: textures = "Name1;Name2;Name3"
    const textures: TextureConfig[] = [];
    const texturesMatch = content.match(/^textures\s*=\s*"([^"]+)"/m);
    if (texturesMatch) {
      const textureNames = texturesMatch[1].split(';').map(s => s.trim()).filter(s => s);
      console.log(`[PresetParser] Found ${textureNames.length} textures:`, textureNames);

      for (const texName of textureNames) {
        // Get texture path
        const pathMatch = content.match(new RegExp(`^${texName}\\s*=\\s*(.+)$`, 'm'));
        if (pathMatch) {
          const texPath = pathMatch[1].trim();
          // Get texture options
          const linearMatch = content.match(new RegExp(`^${texName}_linear\\s*=\\s*(true|false)`, 'm'));
          const mipmapMatch = content.match(new RegExp(`^${texName}_mipmap\\s*=\\s*(\\d+)`, 'm'));

          textures.push({
            name: texName,
            path: texPath,
            linear: linearMatch ? linearMatch[1] === 'true' : true,
            mipmap: mipmapMatch ? parseInt(mipmapMatch[1]) > 0 : false
          });
          console.log(`[PresetParser] Texture: ${texName} -> ${texPath} (linear: ${linearMatch?.[1] ?? 'true'}, mipmap: ${mipmapMatch?.[1] ?? '0'})`);
        }
      }
    }

    return { passes, parameters, textures };
  }

  /**
   * Render a frame through the shader pipeline
   */
  render(inputTextureName: string): void {
    const gl = this.renderer.getContext();
    this.frameCount++;

    // DO NOT clear here - each pass will render to its own target
    // Clearing here would clear the screen before the final pass renders to it!

    if (this.passes.size === 0) {
      console.warn('[PureWebGL2MultiPass] No shader passes loaded to render');
      return;
    }

    // Execute all passes in sequence
    const passArray = Array.from(this.passes.entries());
    let currentInput = inputTextureName;

    // Debug: limit passes if maxPasses is set
    const effectivePassCount = this.maxPasses > 0 ? Math.min(this.maxPasses, passArray.length) : passArray.length;

    // Track outputs from previous passes for aliased texture access
    const passOutputs: Map<string, string> = new Map();
    passOutputs.set('Original', inputTextureName); // Original game input

    for (let i = 0; i < effectivePassCount; i++) {
      const [passName, _passConfig] = passArray[i];
      const passConfig = this.passConfigs[i];
      const isLastPass = i === effectivePassCount - 1;

      // Last pass renders to screen, others render to their output framebuffer
      // Render targets are created as `${passName}_output` in loadPreset
      const outputTarget = isLastPass ? null : `${passName}_output`;

      // Build texture inputs: Source (previous) + all aliased passes
      const textureInputs: Record<string, string> = {
        Source: currentInput,
        Original: inputTextureName
      };

      // Add all aliased textures from previous passes
      // aliasMap stores: alias name -> output texture name (e.g., "ChromaPass" -> "pass_5_output")
      for (const [aliasName, outputTextureName] of this.aliasMap.entries()) {
        // Check if this texture exists (meaning the pass has executed)
        if (this.renderer.getTexture(outputTextureName)) {
          textureInputs[aliasName] = outputTextureName;
        }
      }

      // Also add outputs from passes executed this frame (for passes that completed earlier)
      for (const [name, textureName] of passOutputs.entries()) {
        if (!textureInputs[name]) {
          textureInputs[name] = textureName;
        }
      }

      // Add preset textures (BackgroundImage, FrameTextureImage, etc.)
      for (const texName of this.presetTextureNames) {
        if (!textureInputs[texName] && this.renderer.getTexture(texName)) {
          textureInputs[texName] = texName;
        }
      }

      // Debug: log texture inputs for pass 20 (reflection) - extended debug
      if (i === 20 && this.frameCount < 3) {
        console.log(`[REFLECTION-DEBUG] Pass ${i} (${passName}) ALL texture inputs:`, JSON.stringify(Object.entries(textureInputs).map(([k,v]) => `${k}=${v}`)));
        console.log(`[REFLECTION-DEBUG] aliasMap entries:`, JSON.stringify(Array.from(this.aliasMap.entries())));
      }

      // Execute the shader pass with merged parameters:
      // 1. Start with parameter defaults from shader #pragma directives
      // 2. Override with preset parameters (from .slangp file)
      // 3. Add frame count
      const mergedParameters = {
        ...this.parameterDefaults,  // Defaults from shaders
        ...this.presetParameters,    // Overrides from preset
        FrameCount: this.frameCount  // Frame counter
      };

      // Debug: Log CRT parameters for important passes
      if (this.frameCount <= 3 && (i === 16 || i === 18)) {
        const crtParams = ['gamma_out', 'GAMMA_INPUT', 'post_br', 'brightboost', 'brightboost1', 'gamma_c'];
        const paramValues = crtParams.filter(p => p in mergedParameters).map(p => `${p}=${mergedParameters[p]}`).join(', ');
        console.log(`[CRT-DEBUG] Pass ${i} (${passName}): ${paramValues || 'no CRT params found'}`);
      }

      const success = this.renderer.executePass(
        passName,
        textureInputs,
        outputTarget,
        mergedParameters
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] ❌ Failed to execute pass ${i + 1}/${effectivePassCount}: ${passName}`);
        console.error(`   Input: ${currentInput}, Output: ${outputTarget || 'screen'}`);
        throw new Error(`Pass ${passName} failed to execute`);
      }

      // Store output for this pass
      const outputTexture = isLastPass ? passName : `${passName}_output`;

      // Register by alias if present
      if (passConfig.alias) {
        passOutputs.set(passConfig.alias, outputTexture);
      }

      // Also store by pass name for reference
      passOutputs.set(passName, outputTexture);

      // Next pass uses this pass's output texture
      currentInput = outputTexture;
    }
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
    this.renderer.registerTexture(name, texture);
    console.log(`[PureWebGL2MultiPass] Registered texture: ${name}`);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.passes.clear();
    console.log('[PureWebGL2MultiPass] Disposed');
  }
}
