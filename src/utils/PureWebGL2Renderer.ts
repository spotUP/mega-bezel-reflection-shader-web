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

  constructor(canvasOrContext: HTMLCanvasElement | WebGL2RenderingContext) {
    // Accept either a canvas or an existing WebGL context
    let gl: WebGL2RenderingContext;

    if (canvasOrContext instanceof WebGL2RenderingContext) {
      // Use existing context
      gl = canvasOrContext;
    } else {
      // Create new context from canvas
      const context = canvasOrContext.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      });

      if (!context) {
        throw new Error('WebGL2 not supported');
      }
      gl = context;
    }

    this.gl = gl;
    // console.log('✅ Pure WebGL2 context created');

    // Enable float texture extensions for RGBA16F/RGBA32F framebuffers
    const floatExt = gl.getExtension('EXT_color_buffer_float');
    if (floatExt) {
      // console.log('✅ EXT_color_buffer_float extension enabled');
    } else {
      console.warn('⚠️  EXT_color_buffer_float not supported - float framebuffers will fail');
    }

    // Enable linear filtering for float textures
    const floatLinearExt = gl.getExtension('OES_texture_float_linear');
    if (floatLinearExt) {
      // console.log('✅ OES_texture_float_linear extension enabled');
    } else {
      console.warn('⚠️  OES_texture_float_linear not supported - float textures will use NEAREST filtering');
    }

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

    // console.log('✅ Fullscreen quad VAO created');
  }

  /**
   * Compile a shader program from GLSL ES 3.0 source
   */
  compileProgram(name: string, vertexSource: string, fragmentSource: string): boolean {
    const gl = this.gl;

    // console.log(`[PureWebGL2] Compiling program: ${name}`);

    // Compile vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      console.error(`[PureWebGL2] Failed to create vertex shader for ${name}`);
      return false;
    }

    // DEBUG: Dump vertex shader for pass_3 (working) and pass_4 (broken) to compare
    if (name === 'pass_3' || name === 'pass_4') {
      // Find the section with layout(location) and void main()
      const layoutIdx = vertexSource.indexOf('layout(location');
      const mainIdx = vertexSource.indexOf('void main()');

      // console.log(`[PureWebGL2] === ${name.toUpperCase()} VERTEX SHADER ATTRIBUTES ===`);
      if (layoutIdx !== -1 && mainIdx !== -1) {
        // Show from first layout to 500 chars after main()
        const start = Math.max(0, layoutIdx - 200);
        const end = Math.min(vertexSource.length, mainIdx + 500);
        // console.log(vertexSource.substring(start, end));
      } else {
        // console.log('❌ Could not find layout(location) or void main()');
        // console.log('Showing last 800 chars instead:');
        // console.log(vertexSource.substring(vertexSource.length - 800));
      }
      // console.log(`[PureWebGL2] === END ${name.toUpperCase()} VERTEX SHADER ===`);
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
        // console.log(`[PureWebGL2] Context around line ${errorLine}:`);
        for (let i = Math.max(0, errorLine - 5); i < Math.min(lines.length, errorLine + 5); i++) {
          const marker = i === errorLine - 1 ? '>>>' : '   ';
          // console.log(`${marker} ${i + 1}: ${lines[i]}`);
        }

        // CRITICAL: Dump full shader to console for debugging
        if (name === 'pass_0') {
          // console.log(`[PureWebGL2] pass_0 vertex shader has ${lines.length} lines total`);
          // console.log(`[PureWebGL2] Showing lines 1460-1475 (error at ${errorLine}):`);
          for (let i = 1459; i < Math.min(1475, lines.length); i++) {
            const marker = i === errorLine - 1 ? '>>>' : '   ';
            // console.log(`${marker} ${i + 1}: ${lines[i]}`);
          }

          // Expose shader source on window for debugging
          (window as any).debugPass0VertexSource = vertexSource;
          (window as any).debugPass0ErrorLine = errorLine;
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

      // Debug: Show source around error line
      const errorLineMatch = log?.match(/ERROR: 0:(\d+):/);
      if (errorLineMatch) {
        const errorLine = parseInt(errorLineMatch[1]);
        const lines = fragmentSource.split('\n');
        console.error(`=== Fragment shader source around line ${errorLine} (total lines: ${lines.length}) ===`);
        const start = Math.max(0, errorLine - 6);
        const end = Math.min(lines.length, errorLine + 4);
        for (let i = start; i < end; i++) {
          const marker = i === errorLine - 1 ? ' <-- ERROR HERE' : '';
          console.error(`${i + 1}: ${lines[i]}${marker}`);
        }
        console.error('=== END ===');

        // For Guest CRT shader, check if HSM_GetNoScanlineMode is defined
        if (fragmentSource.includes('HSM_GetNoScanlineMode')) {
          const funcDefMatches = fragmentSource.match(/float\s+HSM_GetNoScanlineMode\s*\(\s*\)/g);
          if (funcDefMatches) {
            console.error(`Found ${funcDefMatches.length} definition(s) of HSM_GetNoScanlineMode`);

            // Find first definition
            const defPos = fragmentSource.indexOf(funcDefMatches[0]);
            const defLine = fragmentSource.substring(0, defPos).split('\n').length;

            // Show the function definition with more context
            const funcLines = fragmentSource.split('\n');
            const funcStart = defLine - 1;
            const funcEnd = Math.min(funcStart + 15, funcLines.length);
            console.error(`=== Function definition at line ${defLine} (showing lines ${defLine-5} to ${defLine+10}) ===`);
            // Show 5 lines BEFORE the function to see context
            for (let i = Math.max(0, funcStart - 5); i < funcEnd; i++) {
              const marker = i === funcStart ? ' <-- FUNCTION HERE' : '';
              console.error(`${i + 1}: ${funcLines[i]}${marker}`);
            }
            console.error('=== END ===');

            // Check if we're inside main() function
            const textBeforeFunc = fragmentSource.substring(0, defPos);
            const mainMatches = textBeforeFunc.match(/void\s+main\s*\(\s*\)\s*{/g);
            const closingBracesBefore = (textBeforeFunc.match(/}/g) || []).length;
            const openingBracesBefore = (textBeforeFunc.match(/{/g) || []).length;
            const insideMain = mainMatches && openingBracesBefore > closingBracesBefore;
            console.error(`Function scope check: main() found=${!!mainMatches}, insideMain=${insideMain}, braces: open=${openingBracesBefore}, close=${closingBracesBefore}`);

            // Check for duplicates
            if (funcDefMatches.length > 1) {
              console.error(`⚠ WARNING: ${funcDefMatches.length} definitions found! Checking for duplicates...`);
              let searchPos = defPos + 10;
              for (let i = 1; i < funcDefMatches.length; i++) {
                const nextPos = fragmentSource.indexOf(funcDefMatches[i], searchPos);
                if (nextPos !== -1) {
                  const nextLine = fragmentSource.substring(0, nextPos).split('\n').length;
                  console.error(`  - Duplicate at line ${nextLine}`);
                  searchPos = nextPos + 10;
                }
              }
            }
          } else {
            console.error(`✗ HSM_GetNoScanlineMode NOT DEFINED (only called at line ${errorLine})`);
          }
        }
      }

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

    // console.log(`✅ [PureWebGL2] Program ${name} compiled successfully`);
    return true;
  }

  /**
   * Create a render target (framebuffer + texture)
   */
  createRenderTarget(name: string, width: number, height: number, useFloatFramebuffer: boolean = false, useSrgbFramebuffer: boolean = false): boolean {
    const gl = this.gl;

    // Create texture
    const texture = gl.createTexture();
    if (!texture) {
      console.error(`[PureWebGL2] Failed to create texture for ${name}`);
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use floating-point framebuffer if requested (for color precision in intermediate passes)
    if (useFloatFramebuffer) {
      // console.log(`✨ [PureWebGL2] Creating FLOAT framebuffer for ${name}`);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    } else if (useSrgbFramebuffer) {
      // sRGB framebuffer for gamma-correct blending
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    // FIXED: Use LINEAR filter without mipmaps - mipmap generation was causing texture corruption
    // OLD: gl.LINEAR_MIPMAP_LINEAR required mipmaps to be regenerated after each render
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // REMOVED: Mipmap generation - not needed with LINEAR filter
    // gl.generateMipmap(gl.TEXTURE_2D);

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

    // console.log(`✅ [PureWebGL2] Render target ${name} created (${width}x${height})`);
    return true;
  }

  /**
   * Create a texture from an HTMLImageElement (for LUTs, etc.)
   */
  createTextureFromImage(name: string, image: HTMLImageElement, linear: boolean = true): boolean {
    const gl = this.gl;

    const texture = gl.createTexture();
    if (!texture) {
      console.error(`[PureWebGL2] Failed to create texture for ${name}`);
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Set filtering based on parameter
    if (linear) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    // LUTs typically use CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.textures.set(name, texture);

    // console.log(`✅ [PureWebGL2] Texture ${name} created from image (${image.width}x${image.height})`);
    return true;
  }

  /**
   * Create a texture from an HTMLImageElement with full settings (for tube textures, etc.)
   */
  createTextureFromImageWithSettings(
    name: string,
    image: HTMLImageElement,
    settings: { linear?: boolean; mipmap?: boolean; wrapMode?: string }
  ): boolean {
    const gl = this.gl;
    const { linear = true, mipmap = false, wrapMode = 'clamp_to_edge' } = settings;

    const texture = gl.createTexture();
    if (!texture) {
      console.error(`[PureWebGL2] Failed to create texture for ${name}`);
      return false;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Generate mipmaps if requested
    if (mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // Set filtering
    if (linear) {
      if (mipmap) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      if (mipmap) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    // Set wrap mode
    let wrapModeGL: number;
    switch (wrapMode.toLowerCase()) {
      case 'repeat':
        wrapModeGL = gl.REPEAT;
        break;
      case 'mirrored_repeat':
        wrapModeGL = gl.MIRRORED_REPEAT;
        break;
      case 'clamp_to_edge':
      default:
        wrapModeGL = gl.CLAMP_TO_EDGE;
        break;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapModeGL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapModeGL);

    this.textures.set(name, texture);

    // console.log(`✅ [PureWebGL2] Texture ${name} created (${image.width}x${image.height}, linear=${linear}, mipmap=${mipmap}, wrap=${wrapMode})`);
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
      // CRITICAL: Set viewport to match framebuffer dimensions
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // Set viewport to full canvas
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    // CRITICAL: Clear framebuffers (textures) before rendering
    // Without this, intermediate framebuffers contain uninitialized data
    // ONLY clear when rendering to texture (not screen), as screen clearing should be handled by the game
    if (outputTarget) {
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // Use program
    gl.useProgram(program);

    // Set standard RetroArch uniforms (required by Mega Bezel shaders)
    this.setStandardUniforms(program, uniforms);

    // Bind input textures
    let textureUnit = 0;
    // DEBUG: Log texture bindings for pass_20
    const frameCount = uniforms.FrameCount || 0;

    // Always log pass_20 texture bindings (but don't read pixels which causes WebGL errors with float textures)
    if (programName === 'pass_20' && frameCount <= 3) {
      console.log(`[PASS20-BINDINGS] Frame ${frameCount} - Input textures available:`, Object.entries(inputTextures).map(([k, v]) => `${k}=${v}`).join(', '));
    }

    // NOTE: Pixel reading debug is disabled for pass_20 because it uses float framebuffers
    // Reading from float textures with UNSIGNED_BYTE causes GL_INVALID_OPERATION (error 1282)
    // Only enable for passes with non-float framebuffers
    const debugInputPasses = ['pass_4'];  // Only pass_4 (non-float) for pixel debug
    const shouldLog = debugInputPasses.includes(programName) && (frameCount <= 2);
    if (shouldLog) {
      // Store current framebuffer binding so we can restore it
      const savedFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);

      console.log(`[DEBUG ${programName} FRAME ${frameCount}] Checking input texture content...`);
      for (const [name, texName] of Object.entries(inputTextures)) {
        // DEBUG: Read a pixel from textures to verify their contents
        const texture = this.textures.get(texName);
        if (texture) {
          // Create a temporary framebuffer to read from the texture
          const tempFB = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, tempFB);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

          const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
          if (fbStatus === gl.FRAMEBUFFER_COMPLETE) {
            const pixel = new Uint8Array(4);
            gl.readPixels(Math.floor(gl.canvas.width/2), Math.floor(gl.canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            console.log(`[DEBUG ${programName}] Input '${name}' (${texName}) pixel: rgb(${pixel[0]},${pixel[1]},${pixel[2]})`);
          } else {
            console.log(`[DEBUG ${programName}] Input '${name}' (${texName}) - framebuffer incomplete: ${fbStatus}`);
          }

          gl.deleteFramebuffer(tempFB);
        }
      }

      // CRITICAL: Restore the original framebuffer binding!
      gl.bindFramebuffer(gl.FRAMEBUFFER, savedFB);
    }

    for (const [uniformName, textureName] of Object.entries(inputTextures)) {
      // CRITICAL FIX: Check if this sampler uniform exists in the shader FIRST
      // This prevents binding textures that the shader doesn't use, which would
      // cause texture unit mismatches (e.g., PreCRTPass bound to unit 2 but shader expects unit 0)
      const location = gl.getUniformLocation(program, uniformName);
      if (location === null) {
        // DEBUG: Log when important samplers are not found
        const frameCount = uniforms.FrameCount || 0;
        if (frameCount <= 2 && ['pass_4', 'pass_9', 'pass_11', 'pass_17', 'pass_20'].includes(programName)) {
          console.warn(`[DEBUG ${programName}] Sampler uniform '${uniformName}' NOT FOUND in shader!`);
        }
        // Sampler doesn't exist in this shader - skip binding this texture
        continue;
      }

      // DEBUG: Texture bindings (disabled)
      // if (shouldLog) {
      //   // console.log(`[DEBUG ${programName}] Binding ${uniformName} → ${textureName} at unit ${textureUnit}`);
      // }

      let texture = this.textures.get(textureName);
      if (!texture) {
        // Silently create dummy textures for unresolved samplers
        // Create a 1x1 black texture as fallback
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        const blackPixel = new Uint8Array([0, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, blackPixel);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.textures.set(textureName, texture);
      }

      // DEBUG: Texture binding (disabled - enable if needed for debugging)
      // if (programName === 'pass_0' && uniformName === 'Source') {
      //   // console.log(`[DEBUG pass_0] Binding Source sampler: ${textureName} -> unit ${textureUnit}`);
      // }

      gl.activeTexture(gl.TEXTURE0 + textureUnit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location, textureUnit);

      // DEBUG: Log successful texture bindings for problematic passes
      const frameCount2 = uniforms.FrameCount || 0;
      if (frameCount2 <= 2 && ['pass_4', 'pass_9', 'pass_11', 'pass_17', 'pass_20'].includes(programName)) {
        console.log(`[DEBUG ${programName}] Bound '${uniformName}' (${textureName}) to unit ${textureUnit}`);
      }

      textureUnit++;
    }

    // Set custom uniforms
    let paramSetCount = 0;
    let paramMissingCount = 0;
    let nonParamSetCount = 0;
    for (const [name, value] of Object.entries(uniforms)) {
      const location = gl.getUniformLocation(program, name);
      if (location === null) {
        // Uniform doesn't exist in this shader - this is normal, not all shaders use all parameters
        if (name.startsWith('PARAM_')) paramMissingCount++;
        continue;
      }

      if (typeof value === 'number') {
        gl.uniform1f(location, value);
        if (name.startsWith('PARAM_')) {
          paramSetCount++;
        } else {
          nonParamSetCount++;
        }
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
    // Logging disabled to reduce console spam

    // DEBUG: For failing passes, check state before draw
    const frameCount3 = uniforms.FrameCount || 0;
    const debugDrawPasses = ['pass_4', 'pass_9', 'pass_11', 'pass_15', 'pass_17', 'pass_20'];

    // Always log when executing pass_20
    if (programName === 'pass_20') {
      console.log(`[PASS20-DRAW] About to draw. FrameCount=${frameCount3}, VAO=${this.quadVAO !== null}`);
    }

    if (debugDrawPasses.includes(programName) && frameCount3 <= 3) {
      // Check VAO is valid
      console.log(`[DEBUG ${programName}] quadVAO valid: ${this.quadVAO !== null}`);

      // Check bound texture on unit 0
      const boundTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      console.log(`[DEBUG ${programName}] Bound texture on active unit: ${boundTexture !== null}`);

      // Check if framebuffer is bound
      const boundFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      console.log(`[DEBUG ${programName}] Framebuffer bound: ${boundFB !== null ? 'FBO' : 'screen'}`);

      // Check for errors before draw
      let preError = gl.getError();
      if (preError !== gl.NO_ERROR) {
        console.error(`[DEBUG ${programName}] WebGL error BEFORE draw: ${preError}`);
      }

      // For pass_9, check SourceSize uniform
      if (programName === 'pass_9') {
        const sourceSizeLoc = gl.getUniformLocation(program, 'SourceSize');
        console.log(`[DEBUG pass_9] SourceSize uniform exists: ${sourceSizeLoc !== null}`);
        // Check canvas size
        console.log(`[DEBUG pass_9] Canvas size: ${gl.canvas.width}x${gl.canvas.height}`);
      }
    }

    // Draw fullscreen quad
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // DEBUG: Removed - reading pixels from float framebuffers with UNSIGNED_BYTE causes GL_INVALID_OPERATION
    // The proper debug output is done in PureWebGL2MultiPassRenderer which handles float framebuffers correctly

    // DISABLED: Mipmap generation removed - textures now use LINEAR filter without mipmaps
    // This prevents texture corruption that was causing white output in pass_4

    // Check for WebGL errors
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error(`[PureWebGL2] WebGL error after drawing: ${error}`);
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

    // Also set as vec2 for some shaders
    const finalViewportSizeXLoc = gl.getUniformLocation(program, 'FinalViewportSizeX');
    if (finalViewportSizeXLoc !== null) {
      gl.uniform1f(finalViewportSizeXLoc, width);
    }
    const finalViewportSizeYLoc = gl.getUniformLocation(program, 'FinalViewportSizeY');
    if (finalViewportSizeYLoc !== null) {
      gl.uniform1f(finalViewportSizeYLoc, height);
    }
  }

  /**
   * Register an external texture with the renderer
   */
  registerTexture(name: string, texture: WebGLTexture): void {
    this.textures.set(name, texture);
    // console.log(`✅ [PureWebGL2] Registered external texture: ${name}`);
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
   * Resize all render targets to new dimensions
   */
  resizeAllTargets(newWidth: number, newHeight: number): void {
    const gl = this.gl;

    // Resize all textures that are render targets (those with framebuffers)
    this.framebuffers.forEach((fb, name) => {
      const texture = this.textures.get(name);
      if (texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // Recreate texture at new size (use RGBA format as default)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, newWidth, newHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    });

    console.log(`[PureWebGL2] Resized ${this.framebuffers.size} render targets to ${newWidth}x${newHeight}`);
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

    // console.log('✅ [PureWebGL2] Resources disposed');
  }
}
