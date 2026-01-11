/**
 * Multi-Pass Rendering Framework for Mega Bezel
 *
 * Orchestrates the execution of complex shader pipelines with:
 * - Pass dependency management
 * - Render target chaining
 * - Performance optimization
 * - Frame history management
 * - Dynamic parameter updates
 */

import * as THREE from 'three';
import { MegaBezelPreset, ShaderPass } from './MegaBezelCompiler';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';
import { BezelGraphicsManager } from './BezelGraphicsManager';

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  inputTexture: THREE.Texture;
  outputTarget?: THREE.WebGLRenderTarget;
  frameCount: number;
  deltaTime: number;
}

export interface PassExecutionResult {
  pass: ShaderPass;
  renderTime: number;
  renderTarget?: THREE.WebGLRenderTarget;
}

export class MultiPassRenderer {
  private renderer: THREE.WebGLRenderer;
  private preset: MegaBezelPreset | null = null;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;
  private bezelGraphics: BezelGraphicsManager;

  // Rendering resources
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Frame management
  private frameCount: number = 0;
  private frameHistory: THREE.WebGLRenderTarget[] = [];
  private historyDepth: number = 4;

  // Input texture (compatibility)
  private inputTexture: THREE.Texture | null = null;

  // Performance tracking
  private performanceStats = {
    totalRenderTime: 0,
    passTimes: new Map<string, number>(),
    frameCount: 0
  };

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager?: ParameterManager,
    coordinateSystem?: MegaBezelCoordinateSystem,
    bezelGraphics?: BezelGraphicsManager,
    preset?: MegaBezelPreset
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager || null;
    this.coordinateSystem = coordinateSystem || null;
    this.bezelGraphics = bezelGraphics || null;

    this.initializeRenderingResources();
    this.initializeFrameHistory();

    console.log('[MultiPassRenderer] Constructor called, preset provided:', !!preset);

    // Load preset if provided
    if (preset) {
      console.log('[MultiPassRenderer] Loading preset in constructor:', preset.name, preset.passes.length, 'passes');
      this.loadPreset(preset);
    } else {
      console.log('[MultiPassRenderer] No preset provided in constructor');
    }
  }

  /**
   * Initialize rendering resources
   */
  private initializeRenderingResources(): void {
    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ transparent: true });
    this.quad = new THREE.Mesh(geometry, material);

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 0.5;
  }

  /**
   * Initialize frame history buffers
   */
  private initializeFrameHistory(): void {
    const viewportSize = this.renderer.getSize(new THREE.Vector2());

    for (let i = 0; i < this.historyDepth; i++) {
      const historyTarget = new THREE.WebGLRenderTarget(
        viewportSize.x,
        viewportSize.y,
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType
        }
      );
      this.frameHistory.push(historyTarget);
    }
  }

  /**
   * Load preset (for Mega Bezel system)
   */
  async loadPreset(preset: MegaBezelPreset): Promise<void> {
    console.log(`[MultiPassRenderer] Loading preset: ${preset.name} (${preset.passes.length} passes)`);

    this.preset = preset;

    // Validate preset
    this.validatePreset(preset);

    // Prepare passes for rendering
    await this.preparePasses(preset);

    // Update coordinate system if needed
    if (this.coordinateSystem) {
      const viewportSize = this.renderer.getSize(new THREE.Vector2());
      this.coordinateSystem.updateViewportSize(viewportSize.x, viewportSize.y);
    }

    console.log(`[MultiPassRenderer] Preset loaded successfully, preset set to:`, !!this.preset);
  }

  /**
   * Load shaders from preset (compatibility method for PongSlangDemo)
   */
  async loadShaders(): Promise<void> {
    // This is a compatibility method - in the new architecture,
    // shaders are loaded when the preset is set in the constructor
    console.log(`[MultiPassRenderer] loadShaders() called - using preset from constructor`);
    console.log(`[MultiPassRenderer] Preset has ${this.preset?.passes.length || 0} passes`);

    if (this.preset) {
      this.preset.passes.forEach((pass, index) => {
        console.log(`[MultiPassRenderer] Pass ${index}: ${pass.name}, shader compiled: ${!!pass.shader}`);
      });
    }
  }

  /**
   * Set input texture (compatibility method for PongSlangDemo)
   */
  setInputTexture(texture: THREE.Texture): void {
    this.inputTexture = texture;
    console.log(`[MultiPassRenderer] Input texture set: ${texture.image ? `${texture.image.width}x${texture.image.height}` : 'no image'}`);
  }

  /**
   * Render to screen (compatibility method for PongSlangDemo)
   */
  render(): void {
    if (!this.inputTexture) {
      console.warn('[MultiPassRenderer] No input texture set');
      return;
    }

    const context: RenderContext = {
      renderer: this.renderer,
      inputTexture: this.inputTexture,
      frameCount: this.frameCount++,
      deltaTime: 1/60 // Assume 60fps
    };

    // Call the main render method
    this.renderPipeline(context);
  }

  /**
   * Validate preset integrity
   */
  private validatePreset(preset: MegaBezelPreset): void {
    if (!preset.passes || preset.passes.length === 0) {
      throw new Error('Preset must have at least one pass');
    }

    // Check for required passes
    const hasFinalPass = preset.passes.some(pass => !pass.renderTarget);
    if (!hasFinalPass) {
      throw new Error('Preset must have a final pass (no render target)');
    }

    // Validate pass dependencies
    preset.passes.forEach((pass, index) => {
      if (pass.index !== index) {
        throw new Error(`Pass ${pass.name} has incorrect index ${pass.index}, expected ${index}`);
      }
    });

    console.log(`[MultiPassRenderer] Preset validation passed`);
  }

  /**
   * Prepare passes for rendering
   */
  private async preparePasses(preset: MegaBezelPreset): Promise<void> {
    // Bind textures to uniforms
    for (const pass of preset.passes) {
      await this.bindPassTextures(pass);
      this.updatePassUniforms(pass);
    }
  }

  /**
   * Bind textures to pass uniforms
   */
  private async bindPassTextures(pass: ShaderPass): Promise<void> {
    const uniforms = pass.uniforms;

    // Bind external textures (LUTs, bezel graphics) - only if bezelGraphics is available
    if (this.bezelGraphics) {
      for (const input of pass.inputs) {
        const texture = this.bezelGraphics.getTextureForUniform(input);
        if (texture && uniforms[input]) {
          uniforms[input].value = texture;
        }
      }
    }

    // Bind aliased textures from previous passes
    if (pass.index > 0) {
      for (let i = 0; i < pass.index; i++) {
        const prevPass = this.preset!.passes[i];
        if (prevPass.alias && prevPass.renderTarget && uniforms[prevPass.alias]) {
          uniforms[prevPass.alias].value = prevPass.renderTarget.texture;
        }
      }
    }
  }

  /**
   * Update pass uniforms with current values
   */
  private updatePassUniforms(pass: ShaderPass): void {
    const uniforms = pass.uniforms;

    // Log uniform update (only once per pass on first frame)
    if (this.frameCount === 0) {
      console.log(`[MultiPassRenderer] Updating uniforms for pass ${pass.index} (${pass.name})`);
      console.log(`  - Total uniforms: ${Object.keys(uniforms).length}`);
      console.log(`  - Parameters to update: ${pass.parameters.length}`);
    }

    // Update parameter uniforms
    if (this.parameterManager) {
      for (const paramName of pass.parameters) {
        const value = this.parameterManager.getValue(paramName);
        if (uniforms[paramName]) {
          uniforms[paramName].value = value;
        }
      }
    }

    // Update standard uniforms
    this.updateStandardUniforms(pass, uniforms);

    // Log critical uniforms on first frame
    if (this.frameCount === 0) {
      const criticalUniforms = ['Source', 'MVP', 'SourceSize', 'OutputSize'];
      criticalUniforms.forEach(name => {
        if (uniforms[name]) {
          console.log(`  - ${name}: ${uniforms[name].value ? 'SET' : 'NULL'}`);
        } else {
          console.log(`  - ${name}: MISSING`);
        }
      });
    }
  }

  /**
   * Update standard RetroArch/Mega Bezel uniforms
   */
  private updateStandardUniforms(pass: ShaderPass, uniforms: Record<string, THREE.IUniform>): void {
    const viewportSize = this.renderer.getSize(new THREE.Vector2());

    // MVP matrix for fullscreen quad
    if (uniforms['MVP']) {
      uniforms['MVP'].value.copy(this.camera.projectionMatrix);
    }

    // Size uniforms - ensure all size uniforms are set
    const sizeUniforms = ['OutputSize', 'OriginalSize', 'SourceSize', 'DerezedPassSize', 'FinalViewportSize', 'OriginalFeedbackSize'];
    sizeUniforms.forEach(sizeUniform => {
      if (uniforms[sizeUniform]) {
        // Initialize uniform value if null
        if (!uniforms[sizeUniform].value) {
          uniforms[sizeUniform].value = new THREE.Vector4();
        }
        uniforms[sizeUniform].value.set(
          viewportSize.x,
          viewportSize.y,
          1.0 / viewportSize.x,
          1.0 / viewportSize.y
        );
      }
    });

    // Frame count
    if (uniforms['FrameCount']) {
      uniforms['FrameCount'].value = this.frameCount;
    }
    if (uniforms['FrameDirection']) {
      uniforms['FrameDirection'].value = 1.0;
    }

    // History textures
    for (let i = 0; i < this.historyDepth; i++) {
      const historyKey = `OriginalHistory${i + 1}`;
      if (uniforms[historyKey] && this.frameHistory[i]) {
        const historyIndex = (this.frameCount - i - 1 + this.historyDepth) % this.historyDepth;
        uniforms[historyKey].value = this.frameHistory[historyIndex].texture;
      }
    }

    // Source and Original textures (from input)
    if (uniforms['Source'] && this.inputTexture) {
      uniforms['Source'].value = this.inputTexture;
    }
    if (uniforms['Original'] && this.inputTexture) {
      uniforms['Original'].value = this.inputTexture;
    }

    // Ensure all uniforms have valid values (not null/undefined)
    Object.keys(uniforms).forEach(key => {
      const uniform = uniforms[key];
      if (uniform && uniform.value === null) {
        console.warn(`[MultiPassRenderer] Uniform ${key} has null value, setting default`);
        // Set default values based on type
        if (key.includes('Size') || key.includes('Scale')) {
          uniform.value = new THREE.Vector4(800, 600, 1/800, 1/600);
        } else if (key.includes('Count') || key.includes('Direction')) {
          uniform.value = 0;
        } else if (key.includes('MVP')) {
          uniform.value = new THREE.Matrix4();
        } else {
          uniform.value = 0; // Default to 0 for unknown uniforms
        }
      }
    });
  }

  /**
   * Render the complete pipeline (internal method)
   */
  renderPipeline(context: RenderContext): void {
    if (!this.preset) {
      throw new Error('No preset loaded');
    }

    const startTime = performance.now();
    this.frameCount++;

    // Log input texture status on first frame
    if (this.frameCount === 1) {
      console.log('[MultiPassRenderer] renderPipeline called');
      console.log(`  - inputTexture: ${context.inputTexture ? 'PROVIDED' : 'NULL'}`);
      if (context.inputTexture) {
        console.log(`  - inputTexture size: ${context.inputTexture.image?.width}x${context.inputTexture.image?.height}`);
        console.log(`  - inputTexture type: ${context.inputTexture.type}`);
        console.log(`  - inputTexture needsUpdate: ${context.inputTexture.needsUpdate}`);
        console.log(`  - inputTexture minFilter: ${context.inputTexture.minFilter}, magFilter: ${context.inputTexture.magFilter}`);
        console.log(`  - inputTexture format: ${context.inputTexture.format}, internalFormat: ${context.inputTexture.internalFormat}`);

        // Force texture upload if needed
        if (context.inputTexture.image && !context.inputTexture.needsUpdate) {
          console.log('  - WARNING: Texture has image but needsUpdate=false, forcing upload');
          context.inputTexture.needsUpdate = true;
        }
      }
    }

    // Update frame history
    this.updateFrameHistory(context.inputTexture);

    // Execute all passes
    let currentInput = context.inputTexture;
    const passResults: PassExecutionResult[] = [];

    for (let i = 0; i < this.preset.passes.length; i++) {
      const pass = this.preset.passes[i];
      const passStartTime = performance.now();

      // Update pass uniforms
      this.updatePassUniforms(pass);

      // Set input texture
      if (pass.uniforms['Source']) {
        pass.uniforms['Source'].value = currentInput;
        if (this.frameCount === 1) {
          console.log(`  - Pass ${pass.index}: Source texture SET (${currentInput ? 'valid' : 'NULL'})`);
        }
      } else {
        if (this.frameCount === 1) {
          console.log(`  - Pass ${pass.index}: No Source uniform`);
        }
      }

      // Execute pass
      const result = this.executePass(pass, context);
      passResults.push(result);

      // Update input for next pass
      if (pass.renderTarget) {
        currentInput = pass.renderTarget.texture;
      }

      // Track performance
      const passTime = performance.now() - passStartTime;
      this.performanceStats.passTimes.set(pass.name, passTime);
    }

    // Update performance stats
    const totalTime = performance.now() - startTime;
    this.performanceStats.totalRenderTime = totalTime;
    this.performanceStats.frameCount++;

    // Debug logging
    if (this.frameCount % 60 === 0) { // Log every 60 frames
    }
  }

  /**
   * Execute a single pass
   */
  private executePass(pass: ShaderPass, context: RenderContext): PassExecutionResult {
    const startTime = performance.now();

    // Check if material is valid
    if (!pass.material) {
      console.error(`[MultiPassRenderer] Pass ${pass.name} has no material!`);
      return {
        pass,
        renderTime: 0,
        renderTarget: pass.renderTarget || undefined
      };
    }

    // Set material on quad
    this.quad.material = pass.material;

    // Log shader code on first frame for first pass to check bindings
    if (this.frameCount === 1 && pass.index === 0) {
      console.log('[MultiPassRenderer] Pass 0 fragment shader snippet:');
      const fragShader = (pass.material as any).fragmentShader || '';
      const sourceLines = fragShader.split('\n').filter((line: string) => line.includes('Source') || line.includes('texture'));
      console.log(sourceLines.slice(0, 10).join('\n'));
    }

    // Determine output target
    const outputTarget = pass.renderTarget || context.outputTarget || null;

    // Set render target
    this.renderer.setRenderTarget(outputTarget);

    // Clear if needed
    if (outputTarget) {
      this.renderer.clear();
    }

    // Render
    this.renderer.render(this.scene, this.camera);

    // Sample center pixel on first frame to check output
    if (this.frameCount === 1 && outputTarget) {
      const gl = this.renderer.getContext();
      const pixel = new Uint8Array(4);
      gl.readPixels(
        Math.floor(outputTarget.width / 2),
        Math.floor(outputTarget.height / 2),
        1, 1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel
      );
      console.log(`  → Pass ${pass.index} center pixel: rgb(${pixel[0]},${pixel[1]},${pixel[2]}) alpha=${pixel[3]}`);
    }

    // Reset render target
    this.renderer.setRenderTarget(null);

    const renderTime = performance.now() - startTime;

    return {
      pass,
      renderTime,
      renderTarget: pass.renderTarget || undefined
    };
  }

  /**
   * Update frame history
   */
  private updateFrameHistory(inputTexture: THREE.Texture): void {
    const historyIndex = this.frameCount % this.historyDepth;
    const historyTarget = this.frameHistory[historyIndex];

    // Copy input texture to history buffer
    const copyMaterial = new THREE.MeshBasicMaterial({ map: inputTexture });
    this.quad.material = copyMaterial;

    this.renderer.setRenderTarget(historyTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  /**
   * Update parameter values
   */
  updateParameters(parameters: Record<string, number>): void {
    // Update parameter manager
    Object.entries(parameters).forEach(([name, value]) => {
      this.parameterManager.setValue(name, value);
    });

    // Update all pass uniforms
    if (this.preset) {
      this.preset.passes.forEach(pass => {
        this.updatePassUniforms(pass);
      });
    }
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    // Update coordinate system if available
    if (this.coordinateSystem) {
      this.coordinateSystem.updateViewportSize(width, height);
    }

    // Recreate render targets
    if (this.preset) {
      this.preset.passes.forEach(pass => {
        if (pass.renderTarget) {
          pass.renderTarget.setSize(width, height);
        }
      });
    }

    // Recreate frame history
    this.frameHistory.forEach(target => {
      target.setSize(width, height);
    });

    console.log(`[MultiPassRenderer] Resized to ${width}x${height}`);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    const avgPassTimes: Record<string, number> = {};
    this.performanceStats.passTimes.forEach((time, name) => {
      avgPassTimes[name] = time; // Could average over multiple frames
    });

    return {
      totalRenderTime: this.performanceStats.totalRenderTime,
      averagePassTimes: avgPassTimes,
      frameCount: this.performanceStats.frameCount,
      fps: this.performanceStats.frameCount > 0 ?
        1000 / (this.performanceStats.totalRenderTime / this.performanceStats.frameCount) : 0
    };
  }

  /**
   * Get current preset
   */
  getPreset(): MegaBezelPreset | null {
    return this.preset;
  }

  /**
   * Get the final render target (last pass output)
   */
  getRenderTarget(): THREE.WebGLRenderTarget | null {
    if (!this.preset || this.preset.passes.length === 0) {
      return null;
    }

    // Return the render target of the second-to-last pass (final pass renders to screen)
    const lastPassWithTarget = this.preset.passes
      .slice(0, -1)
      .reverse()
      .find(pass => pass.renderTarget);

    return lastPassWithTarget?.renderTarget || null;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Dispose render targets
    if (this.preset) {
      this.preset.passes.forEach(pass => {
        if (pass.renderTarget) {
          pass.renderTarget.dispose();
        }
        pass.material.dispose();
      });
    }

    // Dispose frame history
    this.frameHistory.forEach(target => target.dispose());

    // Dispose quad
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();

    console.log('[MultiPassRenderer] Disposed');
  }
}
