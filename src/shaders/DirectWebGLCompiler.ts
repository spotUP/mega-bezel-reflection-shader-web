/**
 * Direct WebGL shader compiler that bypasses Three.js limitations
 */
export class DirectWebGLCompiler {
  /**
   * Compile shader directly with WebGL, bypassing Three.js
   */
  static compileShader(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram | null {
    // Create vertex shader
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      console.error('[DirectWebGLCompiler] Failed to create vertex shader');
      return null;
    }

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(vertexShader);
      console.error('[DirectWebGLCompiler] Vertex shader compilation error:', error);

      // Debug: Save the problematic vertex shader for inspection
      if (error?.includes('redefinition')) {
        const lines = vertexSource.split('\n');
        const varyingDeclarations: string[] = [];
        const globalToVaryingSections: number[] = [];

        for (let i = 0; i < lines.length; i++) {
          // Find all varying declarations
          if (lines[i].includes('v_') && (lines[i].includes('out ') || lines[i].includes('in '))) {
            varyingDeclarations.push(`Line ${i+1}: ${lines[i]}`);
          }
          // Find all Global-to-varying sections
          if (lines[i].includes('// Global-to-varying conversions')) {
            globalToVaryingSections.push(i + 1);
          }
        }

        if (varyingDeclarations.length > 0) {
          console.log('[DirectWebGLCompiler] All varying declarations found:');
          varyingDeclarations.slice(0, 10).forEach(line => console.log(line));
          if (varyingDeclarations.length > 10) {
            console.log(`... and ${varyingDeclarations.length - 10} more`);
          }
        }

        if (globalToVaryingSections.length > 1) {
          console.error(`[DirectWebGLCompiler] ERROR: Found ${globalToVaryingSections.length} Global-to-varying sections at lines:`, globalToVaryingSections);
        }
      }

      // Log the problematic lines
      const errorMatch = error?.match(/ERROR: \d+:(\d+):/);
      if (errorMatch) {
        const lineNum = parseInt(errorMatch[1]) - 1;
        const lines = vertexSource.split("\n");
        console.error(`[DirectWebGLCompiler] Error at line ${lineNum + 1}:`);
        for (let i = Math.max(0, lineNum - 2); i <= Math.min(lines.length - 1, lineNum + 2); i++) {
          console.error(`  ${i + 1}: ${lines[i]}`);
        }
      }

      gl.deleteShader(vertexShader);
      return null;
    }

    // Create fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      console.error('[DirectWebGLCompiler] Failed to create fragment shader');
      gl.deleteShader(vertexShader);
      return null;
    }

    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(fragmentShader);
      console.error('[DirectWebGLCompiler] Fragment shader compilation error:', error);

      // Log the problematic lines
      const lines = fragmentSource.split('\n');
      const errorMatch = error?.match(/ERROR: \d+:(\d+):/);
      if (errorMatch) {
        const lineNum = parseInt(errorMatch[1]) - 1;
        const lines = vertexSource.split("\n");
        console.error(`[DirectWebGLCompiler] Error at line ${lineNum + 1}:`);
        for (let i = Math.max(0, lineNum - 2); i <= Math.min(lines.length - 1, lineNum + 2); i++) {
          console.error(`  ${i + 1}: ${lines[i]}`);
        }
      }

      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    // Create and link program
    const program = gl.createProgram();
    if (!program) {
      console.error('[DirectWebGLCompiler] Failed to create program');
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      console.error('[DirectWebGLCompiler] Program link error:', error);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    console.log('[DirectWebGLCompiler] ✅ Shader compiled and linked successfully!');
    return program;
  }

  /**
   * Test if a shader can compile
   */
  static testCompilation(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string
  ): boolean {
    const program = this.compileShader(gl, vertexSource, fragmentSource);
    if (program) {
      gl.deleteProgram(program);
      return true;
    }
    return false;
  }
}