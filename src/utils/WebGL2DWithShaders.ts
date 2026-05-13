/**
 * WebGL2DWithShaders - Extends WebGL2D with Mega Bezel shader post-processing
 *
 * This wrapper allows WebGL2D to render to a framebuffer, then applies
 * Mega Bezel CRT shader effects before displaying the final result.
 *
 * NO FALLBACK - Mega Bezel or nothing.
 */

import { WebGL2D } from './WebGL2D';
import { PureWebGL2MultiPassRenderer } from './PureWebGL2MultiPassRenderer';

export interface ShaderConfig {
  enabled: boolean;
  presetPath?: string;
}

export class WebGL2DWithShaders {
  private webgl2d: WebGL2D;
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  // Framebuffer for capturing WebGL2D output
  private framebuffer: WebGLFramebuffer | null = null;
  private framebufferTexture: WebGLTexture | null = null;
  private width: number;
  private height: number;

  // Mega Bezel shader renderer
  private shaderRenderer: PureWebGL2MultiPassRenderer | null = null;
  private _shadersEnabled: boolean = false;
  private frameCount = 0;

  get shadersEnabled(): boolean {
    return this._shadersEnabled;
  }

  set shadersEnabled(value: boolean) {
    if (this._shadersEnabled !== value) {
      console.log(`[WebGL2DWithShaders] shadersEnabled: ${this._shadersEnabled} -> ${value}`);
    }
    this._shadersEnabled = value;
  }

  constructor(canvas: HTMLCanvasElement, config: ShaderConfig = { enabled: false }) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;

    // Create WebGL2D renderer
    this.webgl2d = new WebGL2D(canvas);
    this.gl = this.webgl2d.getGL();

    console.log(`[WebGL2DWithShaders] Initialized (${this.width}x${this.height})`);

    // Setup framebuffer and load Mega Bezel shaders
    if (config.enabled && config.presetPath) {
      this.setupFramebuffer();

      // Load Mega Bezel preset
      this.loadShaderPreset(config.presetPath)
        .then(() => {
          console.log('='.repeat(80));
          console.log('MEGA BEZEL SHADER PRESET LOADED');
          console.log('='.repeat(80));
          this.shadersEnabled = true;
          this.frameCount = 0;
          this.exposeDebugControls();
        })
        .catch(err => {
          console.error('[WebGL2DWithShaders] FATAL: Failed to load Mega Bezel:', err);
          // No fallback - just don't enable shaders
        });
    }
  }

  /**
   * Setup framebuffer to capture WebGL2D output
   */
  private setupFramebuffer(): void {
    const gl = this.gl;

    // Create texture for framebuffer
    this.framebufferTexture = gl.createTexture();
    if (!this.framebufferTexture) {
      throw new Error('Failed to create framebuffer texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    this.framebuffer = gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.framebufferTexture,
      0
    );

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    console.log('[WebGL2DWithShaders] Framebuffer ready');
  }

  /**
   * Load Mega Bezel shader preset
   */
  private async loadShaderPreset(presetPath: string): Promise<void> {
    console.log('[WebGL2DWithShaders] Loading Mega Bezel preset:', presetPath);

    // Pass the existing WebGL context - don't create a new one!
    this.shaderRenderer = new PureWebGL2MultiPassRenderer(
      this.gl,
      this.width,
      this.height
    );

    const success = await this.shaderRenderer.loadPreset(presetPath);
    if (!success) {
      throw new Error('Failed to load Mega Bezel preset');
    }

    console.log('[WebGL2DWithShaders] Mega Bezel loaded');
  }

  /**
   * Begin rendering to framebuffer
   */
  beginFrame(): void {
    (this as any)._frameBegun = true;

    if (this.framebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
      // Set viewport to match framebuffer size
      this.gl.viewport(0, 0, this.width, this.height);
    }
  }

  /**
   * End rendering and apply Mega Bezel shaders
   */
  endFrame(): void {
    if (!(this as any)._frameBegun) {
      // DEBUG: Track skipped frames
      if (!this._skipCount) this._skipCount = 0;
      this._skipCount++;
      if (this._skipCount % 60 === 1) {
        console.warn(`[WebGL2DWithShaders] endFrame called without beginFrame! Skip count: ${this._skipCount}`);
      }
      return;
    }
    (this as any)._frameBegun = false;
    this.frameCount++;

    if (!this.framebuffer) {
      console.warn(`[WebGL2DWithShaders] No framebuffer at frame ${this.frameCount}`);
      return;
    }

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Set viewport to screen size when rendering shader output
    gl.viewport(0, 0, this.width, this.height);

    // Apply Mega Bezel if ready
    if (this.shaderRenderer && this.framebufferTexture && this.shadersEnabled) {
      try {
        this.shaderRenderer.registerTexture('gameTexture', this.framebufferTexture);
        // Check for passthrough mode via debug controls
        if ((window as any).shaderDebug?.passthrough) {
          this.shaderRenderer.renderPassthrough('gameTexture');
        } else {
          this.shaderRenderer.render('gameTexture');
        }
        gl.flush();

        // DEBUG: Track shader frames
        if (!this._shaderFrames) this._shaderFrames = 0;
        this._shaderFrames++;
      } catch (error) {
        console.error('[WebGL2DWithShaders] Mega Bezel render failed:', error);
      }
    } else {
      // Shader not ready - render framebuffer directly to screen as passthrough
      // This prevents black screen during shader loading or when shaders are disabled
      if (this.shaderRenderer && this.framebufferTexture) {
        this.shaderRenderer.registerTexture('gameTexture', this.framebufferTexture);
        this.shaderRenderer.renderPassthrough('gameTexture');
        gl.flush();
      } else if (this.framebuffer && this.framebufferTexture) {
        // Fallback: blit framebuffer to screen when shader renderer isn't ready yet
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.framebuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        gl.blitFramebuffer(
          0, 0, this.width, this.height,
          0, 0, this.width, this.height,
          gl.COLOR_BUFFER_BIT,
          gl.NEAREST
        );
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      }

      // DEBUG: Track why shader was skipped — counter kept for inspection
      // but no console output (60Hz/300Hz logging tanks Chrome with DevTools open).
      if (!this._noShaderFrames) this._noShaderFrames = 0;
      this._noShaderFrames++;
    }
  }

  private _skipCount?: number;
  private _shaderFrames?: number;
  private _noShaderFrames?: number;

  /**
   * Get WebGL2D instance for drawing
   */
  getWebGL2D(): WebGL2D {
    return this.webgl2d;
  }

  /**
   * Toggle shaders on/off
   */
  setShadersEnabled(enabled: boolean): void {
    this.shadersEnabled = enabled;
  }

  /**
   * Check if shaders are currently active
   */
  areShadersActive(): boolean {
    return this.shadersEnabled && !!this.shaderRenderer;
  }

  /**
   * Set the scanline pulse intensity (0.0 = normal, 1.0 = full pulse)
   * Used for beat-reactive CRT effects in Detroit mode
   */
  setScanlinePulse(value: number): void {
    if (this.shaderRenderer) {
      this.shaderRenderer.setScanlinePulse(value);
    }
  }

  /**
   * Handle canvas resize - updates framebuffer texture to match new size
   */
  resize(newWidth: number, newHeight: number): void {
    if (newWidth === this.width && newHeight === this.height) {
      return; // No change
    }

    this.width = newWidth;
    this.height = newHeight;

    const gl = this.gl;

    // Update WebGL2D's internal size tracking and projection matrix
    (this.webgl2d as any).width = newWidth;
    (this.webgl2d as any).height = newHeight;
    gl.viewport(0, 0, newWidth, newHeight);

    // Resize the framebuffer texture to match new canvas size
    if (this.framebufferTexture) {
      gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        newWidth,
        newHeight,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    // Update shader renderer size if available
    if (this.shaderRenderer) {
      this.shaderRenderer.resize(newWidth, newHeight);
    }

    console.log(`[WebGL2DWithShaders] Resized to ${newWidth}x${newHeight}`);
  }

  /**
   * Expose shader debug controls to window object
   */
  private exposeDebugControls(): void {
    if (!this.shaderRenderer) return;

    const renderer = this.shaderRenderer;

    let usePassthrough = false;

    const shaderDebug = {
      get maxPasses() { return renderer.maxPasses; },
      get passthrough() { return usePassthrough; },

      setMaxPasses: (n: number) => {
        renderer.maxPasses = n;
        console.log(`[ShaderDebug] maxPasses = ${n} (0 = all)`);
      },

      togglePassthrough: () => {
        usePassthrough = !usePassthrough;
        console.log(`[ShaderDebug] Passthrough mode: ${usePassthrough ? 'ON (bypass shaders)' : 'OFF (normal rendering)'}`);
        return usePassthrough;
      },

      listPasses: () => {
        const passes = renderer.getPassInfo();
        console.log('='.repeat(60));
        console.log('SHADER PASSES:');
        passes.forEach(p => {
          console.log(`  [${p.index}] ${p.name}${p.alias ? ` (${p.alias})` : ''}`);
          console.log(`       ${p.shader}`);
        });
        console.log('='.repeat(60));
        console.log(`Total: ${passes.length} | Showing: ${renderer.maxPasses || 'ALL'}`);
        return passes;
      },

      nextPass: () => {
        const total = renderer.getPassCount();
        const current = renderer.maxPasses || total;
        if (current < total) {
          renderer.maxPasses = current + 1;
          console.log(`[ShaderDebug] ${renderer.maxPasses}/${total} passes`);
        }
      },

      prevPass: () => {
        if (renderer.maxPasses > 1) {
          renderer.maxPasses--;
          console.log(`[ShaderDebug] ${renderer.maxPasses}/${renderer.getPassCount()} passes`);
        }
      },

      showAll: () => {
        renderer.maxPasses = 0;
        console.log(`[ShaderDebug] Showing ALL ${renderer.getPassCount()} passes`);
      },

      showPass: (n: number) => {
        const total = renderer.getPassCount();
        renderer.maxPasses = Math.max(1, Math.min(n, total));
        console.log(`[ShaderDebug] ${renderer.maxPasses}/${total} passes`);
      },

      get passCount() { return renderer.getPassCount(); }
    };

    (window as any).shaderDebug = shaderDebug;

    console.log('='.repeat(70));
    console.log('SHADER DEBUG COMMANDS:');
    console.log('  shaderDebug.listPasses() - Show all passes');
    console.log('  shaderDebug.showPass(n)  - Show first n passes only');
    console.log('  shaderDebug.nextPass()   - Add one more pass');
    console.log('  shaderDebug.prevPass()   - Remove one pass');
    console.log('  shaderDebug.showAll()    - Show all passes');
    console.log('  shaderDebug.togglePassthrough() - Bypass ALL shaders (test input)');
    console.log('='.repeat(70));
  }
}
