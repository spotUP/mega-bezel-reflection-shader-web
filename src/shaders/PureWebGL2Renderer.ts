/**
 * Pure WebGL2 Multi-Pass Shader Renderer
 *
 * NO THREE.JS DEPENDENCIES - Direct WebGL2 API usage
 * Compiles and executes Slang shader pipelines with zero abstraction overhead
 */

export interface ShaderPass {
  name: string;
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { type: string; value: any }>;
}

export class PureWebGL2Renderer {
  private gl: WebGL2RenderingContext;
  private programs: Map<string, WebGLProgram> = new Map();
  private framebuffers: Map<string, WebGLFramebuffer> = new Map();
  private textures: Map<string, WebGLTexture> = new Map();
  private quadVAO: WebGLVertexArrayObject | null = null;
  private frameCount: number = 0;

  constructor(glContext: WebGL2RenderingContext) {
    this.gl = glContext;
    console.log('[PureWebGL2Renderer] Using existing WebGL2 context');

    // Create fullscreen quad
    this.createFullscreenQuad();
  }

  /**
   * Create a fullscreen quad for shader rendering
   */
  private createFullscreenQuad(): void {
    const gl = this.gl;

    // Vertex positions (NDC coordinates: -1 to 1)
    const positions = new Float32Array([
      -1, -1,  // Bottom-left
       1, -1,  // Bottom-right
      -1,  1,  // Top-left
       1,  1   // Top-right
    ]);

    // Texture coordinates (0 to 1)
    const texCoords = new Float32Array([
      0, 0,  // Bottom-left
      1, 0,  // Bottom-right
      0, 1,  // Top-left
      1, 1   // Top-right
    ]);

    // Create VAO
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // TexCoord buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    console.log('✅ Fullscreen quad VAO created');
  }

  /**
   * Compile a shader program from GLSL ES 3.0 source
   */
  compileProgram(name: string, vertexSource: string, fragmentSource: string): boolean {
    const gl = this.gl;

    console.log(`[PureWebGL2] Compiling program: ${name}`);

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      console.error(`[PureWebGL2] Failed to create vertex shader for ${name}`);
      return false;
    }

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(vertexShader);
      console.error(`[PureWebGL2] Vertex shader compilation failed for ${name}:`, log);

      // Extract line number from error and show context
      const lineMatch = log?.match(/ERROR: \d+:(\d+):/);
      if (lineMatch) {
        const errorLine = parseInt(lineMatch[1]);
        const lines = vertexSource.split('\n');
        console.error(`[PureWebGL2] Context around line ${errorLine}:`);
        for (let i = Math.max(0, errorLine - 5); i < Math.min(lines.length, errorLine + 5); i++) {
          const marker = i === errorLine - 1 ? '>>>' : '   ';
          console.error(`${marker} ${i + 1}: ${lines[i]}`);
        }
      }

      gl.deleteShader(vertexShader);
      return false;
    }

    // Compile fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      console.error(`[PureWebGL2] Failed to create fragment shader for ${name}`);
      gl.deleteShader(vertexShader);
      return false;
    }

    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(fragmentShader);
      console.error(`[PureWebGL2] Fragment shader compilation failed for ${name}:`, log);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return false;
    }

    // Link program
    const program = gl.createProgram();
    if (!program) {
      console.error(`[PureWebGL2] Failed to create program for ${name}`);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return false;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      console.error(`[PureWebGL2] Program linking failed for ${name}:`, log);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return false;
    }

    // Clean up shaders (program retains compiled code)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Store program
    this.programs.set(name, program);

    console.log(`✅ [PureWebGL2] Program ${name} compiled successfully`);
    return true;
  }

  /**
   * Create a render target (framebuffer + texture)
   * @param floatBuffer - Use RGBA16F for HDR passes
   * @param srgb - Use sRGB color space (note: WebGL2 doesn't support sRGB framebuffers directly)
   */
  createRenderTarget(name: string, width: number, height: number, floatBuffer: boolean = false, srgb: boolean = false): boolean {
    const gl = this.gl;

    // Create texture
    const texture = gl.createTexture();
    if (!texture) {
      console.error(`[PureWebGL2] Failed to create texture for ${name}`);
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use RGBA16F for float framebuffers (HDR), RGBA8 otherwise
    if (floatBuffer) {
      // Check for EXT_color_buffer_float extension
      const ext = gl.getExtension('EXT_color_buffer_float');
      if (!ext) {
        console.warn(`[PureWebGL2] EXT_color_buffer_float not available, using RGBA8 for ${name}`);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      }
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.textures.set(name, texture);

    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      console.error(`[PureWebGL2] Failed to create framebuffer for ${name}`);
      gl.deleteTexture(texture);
      return false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`[PureWebGL2] Framebuffer incomplete for ${name}:`, status);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      return false;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.framebuffers.set(name, framebuffer);

    const typeStr = floatBuffer ? 'FLOAT' : 'RGBA8';
    console.log(`✅ [PureWebGL2] Render target ${name} created (${width}x${height}) [${typeStr}]`);
    return true;
  }

  /**
   * Execute a shader pass
   */
  executePass(
    programName: string,
    inputTextures: Record<string, string>,
    outputTarget: string | null,
    uniforms: Record<string, any>
  ): boolean {
    const gl = this.gl;
    this.frameCount++;

    const program = this.programs.get(programName);
    if (!program) {
      console.error(`[PureWebGL2] Program not found: ${programName}`);
      return false;
    }

    // Bind output framebuffer (null = screen)
    if (outputTarget) {
      const framebuffer = this.framebuffers.get(outputTarget);
      if (!framebuffer) {
        console.error(`[PureWebGL2] Framebuffer not found: ${outputTarget}`);
        return false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

      // Set viewport to framebuffer size (all framebuffers are canvas-sized)
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    } else {
      // Rendering to screen - set viewport to full canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    }

    // Use program
    gl.useProgram(program);

    // Check for errors after useProgram
    let error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error(`❌ [PureWebGL2] WebGL error after useProgram(${programName}): ${error}`);
      return false;
    }

    // Set standard RetroArch uniforms (required by Mega Bezel shaders)
    this.setStandardUniforms(program, uniforms);

    // Check for errors after setting uniforms
    error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error(`❌ [PureWebGL2] WebGL error after setStandardUniforms(${programName}): ${error}`);
      return false;
    }

    // Bind input textures
    let textureUnit = 0;

    // Debug: log all texture bindings for failing passes (4, 8, 9, 11, 17, 20)
    const debugPasses = ['pass_4', 'pass_8', 'pass_9', 'pass_11', 'pass_17', 'pass_20'];
    const shouldDebug = debugPasses.includes(programName) && this.frameCount < 50;

    // Always log pass_20 debug on first few frames
    if (programName === 'pass_20') {
      console.log(`[PASS20-DEBUG] Frame ${this.frameCount} - Input textures:`, Object.entries(inputTextures).map(([k, v]) => `${k}=${v}`).join(', '));
    }

    if (shouldDebug) {
      console.log(`[DEBUG ${programName}] Input textures:`, Object.entries(inputTextures).map(([k, v]) => `${k}=${v}`));

      // List all sampler uniforms in the program
      const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      const samplers: string[] = [];
      for (let i = 0; i < numUniforms; i++) {
        const info = gl.getActiveUniform(program, i);
        if (info && info.type === gl.SAMPLER_2D) {
          samplers.push(info.name);
        }
      }
      console.log(`[DEBUG ${programName}] Sampler uniforms in program:`, samplers);
    }

    for (const [uniformName, textureName] of Object.entries(inputTextures)) {
      const texture = this.textures.get(textureName);
      if (!texture) {
        console.error(`[PureWebGL2] ❌ Texture not found: ${textureName} (available: ${Array.from(this.textures.keys()).join(', ')})`);
        continue;
      }

      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      const location = gl.getUniformLocation(program, uniformName);
      if (location !== null) {
        gl.uniform1i(location, textureUnit);
        if (shouldDebug) {
          console.log(`[DEBUG ${programName}] Bound ${uniformName} (${textureName}) to unit ${textureUnit}`);
        }
      } else {
        // Log only on first few frames to avoid spam
        if (this.frameCount < 3) {
          console.warn(`[PureWebGL2] ⚠️ Uniform '${uniformName}' not found in program '${programName}'`);
        }
      }

      textureUnit++;
    }

    // Set custom uniforms
    // Debug: Log all uniforms on first frame
    if (this.frameCount === 1) {
      console.log(`[PureWebGL2] Pass ${programName}: ${Object.keys(uniforms).length} custom uniforms`);
      const hsmUniforms = Object.entries(uniforms).filter(([k]) => k.startsWith('HSM'));
      if (hsmUniforms.length > 0) {
        console.log(`[PureWebGL2] HSM uniforms: ${hsmUniforms.slice(0, 5).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
    }

    // Debug: Log CRT parameters on first few passes (frameCount increments per pass, not per frame)
    if (this.frameCount <= 25) {  // First ~25 pass executions
      const paramCount = Object.keys(uniforms).length;
      console.log(`[CRT-PARAM] ${programName}: ${paramCount} uniforms passed (frame ${this.frameCount})`);
      const importantCRTParams = ['gamma_out', 'post_br', 'brightboost', 'brightboost1', 'shadowMask', 'gamma_c', 'GAMMA_INPUT'];
      const foundParams = importantCRTParams.filter(p => p in uniforms);
      if (foundParams.length > 0) {
        console.log(`[CRT-PARAM] ${programName}: ${foundParams.map(p => `${p}=${uniforms[p]}`).join(', ')}`);
      }
    }

    for (const [name, value] of Object.entries(uniforms)) {
      const location = gl.getUniformLocation(program, name);
      if (location === null) continue;

      if (typeof value === 'number') {
        gl.uniform1f(location, value);
      } else if (Array.isArray(value)) {
        if (value.length === 2) {
          gl.uniform2f(location, value[0], value[1]);
        } else if (value.length === 3) {
          gl.uniform3f(location, value[0], value[1], value[2]);
        } else if (value.length === 4) {
          gl.uniform4f(location, value[0], value[1], value[2], value[3]);
        } else if (value.length === 16) {
          // Matrix4
          gl.uniformMatrix4fv(location, false, value);
        }
      }
    }

    // Draw fullscreen quad
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Check for WebGL errors
    error = gl.getError();
    if (error !== gl.NO_ERROR) {
      const errorName = {
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
      }[error] || 'UNKNOWN';
      console.error(`❌ [PureWebGL2] WebGL error after drawing pass ${programName}: ${error} (${errorName})`);
      console.error(`   Output target: ${outputTarget || 'screen'}`);
      console.error(`   Input textures:`, Object.keys(inputTextures));
      return false;
    }

    return true;
  }

  /**
   * Set standard RetroArch uniforms required by Mega Bezel shaders
   */
  private setStandardUniforms(program: WebGLProgram, customUniforms: Record<string, any>): void {
    const gl = this.gl;

    // MVP matrix (identity for fullscreen quad)
    const mvpLoc = gl.getUniformLocation(program, 'MVP');
    if (mvpLoc !== null) {
      const identity = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      gl.uniformMatrix4fv(mvpLoc, false, identity);
    }

    // Get canvas size
    const width = gl.canvas.width;
    const height = gl.canvas.height;

    // SourceSize (x, y, 1/x, 1/y)
    const sourceSizeLoc = gl.getUniformLocation(program, 'SourceSize');
    if (sourceSizeLoc !== null) {
      gl.uniform4f(sourceSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // OutputSize
    const outputSizeLoc = gl.getUniformLocation(program, 'OutputSize');
    if (outputSizeLoc !== null) {
      gl.uniform4f(outputSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // OriginalSize
    const originalSizeLoc = gl.getUniformLocation(program, 'OriginalSize');
    if (originalSizeLoc !== null) {
      gl.uniform4f(originalSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // FrameCount (from custom uniforms or default to 0)
    const frameCountLoc = gl.getUniformLocation(program, 'FrameCount');
    if (frameCountLoc !== null) {
      const frameCount = customUniforms.FrameCount || 0;
      gl.uniform1f(frameCountLoc, frameCount);
    }

    // FrameDirection
    const frameDirectionLoc = gl.getUniformLocation(program, 'FrameDirection');
    if (frameDirectionLoc !== null) {
      gl.uniform1f(frameDirectionLoc, 1.0);
    }

    // FinalViewportSize - CRITICAL for Mega Bezel aspect ratio calculations
    const finalViewportSizeLoc = gl.getUniformLocation(program, 'FinalViewportSize');
    if (finalViewportSizeLoc !== null) {
      gl.uniform4f(finalViewportSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // DerezedPassSize - CRITICAL for Mega Bezel cache-info shader
    // This is the size of pass_0's output (the "derezed" game image)
    const derezedPassSizeLoc = gl.getUniformLocation(program, 'DerezedPassSize');
    if (derezedPassSizeLoc !== null) {
      gl.uniform4f(derezedPassSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // OriginalFeedbackSize - Feedback buffer size
    const originalFeedbackSizeLoc = gl.getUniformLocation(program, 'OriginalFeedbackSize');
    if (originalFeedbackSizeLoc !== null) {
      gl.uniform4f(originalFeedbackSizeLoc, width, height, 1.0/width, 1.0/height);
    }

    // CRITICAL: Set HSM flip/rotation defaults (must be 1.0, not 0!)
    // Without these, coordinate calculations collapse to center
    const hsmFlipDefaults: Record<string, number> = {
      'HSM_FLIP_VIEWPORT_VERTICAL': 1.0,
      'HSM_FLIP_VIEWPORT_HORIZONTAL': 1.0,
      'HSM_FLIP_CORE_VERTICAL': 1.0,
      'HSM_FLIP_CORE_HORIZONTAL': 1.0,
      'HSM_ROTATE_CORE_IMAGE': 0.0,
      'HSM_ASPECT_RATIO_MODE': 0.0,
      'HSM_ASPECT_RATIO_ORIENTATION': 0.0,
      'HSM_VIEWPORT_ZOOM': 1.0,
      'HSM_VIEWPORT_POSITION_X': 0.0,
      'HSM_VIEWPORT_POSITION_Y': 0.0,
      'HSM_NON_INTEGER_SCALE': 0.8297,
      'HSM_DUALSCREEN_MODE': 0.0,
      'HSM_RESOLUTION_DEBUG_ON': 0.0,
      'HSM_CACHE_GRAPHICS_ON': 0.0,
      'HSM_CROP_MODE': 0.0,
    };

    for (const [name, defaultValue] of Object.entries(hsmFlipDefaults)) {
      // Only set if not already in customUniforms
      if (!(name in customUniforms)) {
        const loc = gl.getUniformLocation(program, name);
        if (loc !== null) {
          gl.uniform1f(loc, defaultValue);
        }
      }
    }
  }

  /**
   * Register an external texture with the renderer
   */
  registerTexture(name: string, texture: WebGLTexture): void {
    this.textures.set(name, texture);
    console.log(`✅ [PureWebGL2] Registered external texture: ${name}`);
  }

  /**
   * Get a texture by name
   */
  getTexture(name: string): WebGLTexture | undefined {
    return this.textures.get(name);
  }

  /**
   * Get the WebGL2 context
   */
  getContext(): WebGL2RenderingContext {
    return this.gl;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    const gl = this.gl;

    // Delete programs
    this.programs.forEach(program => gl.deleteProgram(program));
    this.programs.clear();

    // Delete framebuffers
    this.framebuffers.forEach(fb => gl.deleteFramebuffer(fb));
    this.framebuffers.clear();

    // Delete textures
    this.textures.forEach(tex => gl.deleteTexture(tex));
    this.textures.clear();

    // Delete VAO
    if (this.quadVAO) {
      gl.deleteVertexArray(this.quadVAO);
      this.quadVAO = null;
    }

    console.log('✅ [PureWebGL2] Resources disposed');
  }
}
