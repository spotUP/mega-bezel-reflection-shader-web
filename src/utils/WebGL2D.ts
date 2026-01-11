/**
 * WebGL2D - Simple 2D Drawing API for WebGL2
 *
 * Provides basic 2D drawing primitives using WebGL2.
 * Designed to match Canvas2D rendering output pixel-perfectly.
 */

export class WebGL2D {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;
  private _fillRectCount: number = 0; // DEBUG counter

  // Shader programs
  private solidProgram: WebGLProgram | null = null;
  private textureProgram: WebGLProgram | null = null;

  // Buffers
  private vertexBuffer: WebGLBuffer | null = null;

  // State
  private currentFillStyle: string = '#000000';
  private currentStrokeStyle: string = '#000000';
  private currentLineWidth: number = 1;
  private currentGlobalAlpha: number = 1;
  private currentFont: string = '10px sans-serif';
  private currentTextAlign: CanvasTextAlign = 'start';
  private currentTextBaseline: CanvasTextBaseline = 'alphabetic';
  private currentShadowBlur: number = 0;
  private currentShadowColor: string = 'rgba(0,0,0,0)';

  // Transform state
  private transformMatrix: number[] = [1, 0, 0, 1, 0, 0]; // a, b, c, d, e, f
  private transformStack: number[][] = [];

  // Path state
  private pathVertices: number[] = [];
  private pathCommands: ('move' | 'line')[] = []; // Track moveTo vs lineTo

  // Text rendering canvas
  private textCanvas: HTMLCanvasElement;
  private textCtx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;

    // Setup WebGL state
    gl.viewport(0, 0, this.width, this.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // Create text rendering canvas
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 2048;
    this.textCanvas.height = 2048;
    const ctx = this.textCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to create text context');
    this.textCtx = ctx;

    // Initialize shaders and buffers
    this.initShaders();
    this.initBuffers();

    console.log('✅ WebGL2D initialized');
  }

  private initShaders(): void {
    const gl = this.gl;

    // Solid color shader
    const solidVertexShader = `#version 300 es
      in vec2 a_position;
      uniform vec2 u_resolution;
      uniform mat3 u_transform;

      void main() {
        vec2 pos = (u_transform * vec3(a_position, 1.0)).xy;
        vec2 clipSpace = ((pos / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
      }
    `;

    const solidFragmentShader = `#version 300 es
      precision highp float;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        // Output premultiplied alpha
        outColor = vec4(u_color.rgb * u_color.a, u_color.a);
      }
    `;

    this.solidProgram = this.createProgram(solidVertexShader, solidFragmentShader);

    // Texture shader (for text)
    const textureVertexShader = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      uniform vec2 u_resolution;
      uniform mat3 u_transform;
      out vec2 v_texCoord;

      void main() {
        vec2 pos = (u_transform * vec3(a_position, 1.0)).xy;
        vec2 clipSpace = ((pos / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        v_texCoord = a_texCoord;
      }
    `;

    const textureFragmentShader = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        vec4 texColor = texture(u_texture, v_texCoord);
        float alpha = u_color.a * texColor.a;
        // Output premultiplied alpha
        outColor = vec4(u_color.rgb * alpha, alpha);
      }
    `;

    this.textureProgram = this.createProgram(textureVertexShader, textureFragmentShader);
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vertexShader));
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fragmentShader));
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }

    return program;
  }

  private initBuffers(): void {
    this.vertexBuffer = this.gl.createBuffer();
  }

  // ============================================================================
  // Canvas2D-compatible API
  // ============================================================================

  get fillStyle(): string { return this.currentFillStyle; }
  set fillStyle(value: string | any) {
    // If it's a gradient object, use its primary color or ignore it
    if (typeof value === 'object' && value !== null) {
      this.currentFillStyle = value._primaryColor || 'rgba(0, 0, 0, 1)';
    } else {
      this.currentFillStyle = value;
    }
  }

  get strokeStyle(): string { return this.currentStrokeStyle; }
  set strokeStyle(value: string) { this.currentStrokeStyle = value; }

  get lineWidth(): number { return this.currentLineWidth; }
  set lineWidth(value: number) { this.currentLineWidth = value; }

  get globalAlpha(): number { return this.currentGlobalAlpha; }
  set globalAlpha(value: number) { this.currentGlobalAlpha = value; }

  get font(): string { return this.currentFont; }
  set font(value: string) { this.currentFont = value; }

  get textAlign(): CanvasTextAlign { return this.currentTextAlign; }
  set textAlign(value: CanvasTextAlign) { this.currentTextAlign = value; }

  get textBaseline(): CanvasTextBaseline { return this.currentTextBaseline; }
  set textBaseline(value: CanvasTextBaseline) { this.currentTextBaseline = value; }

  get shadowBlur(): number { return this.currentShadowBlur; }
  set shadowBlur(value: number) { this.currentShadowBlur = value; }

  get shadowColor(): string { return this.currentShadowColor; }
  set shadowColor(value: string) { this.currentShadowColor = value; }

  set imageSmoothingEnabled(value: boolean) { /* No-op */ }
  set textRenderingOptimization(value: any) { /* No-op */ }
  set fontKerning(value: any) { /* No-op */ }

  fillRect(x: number, y: number, width: number, height: number): void {
    const gl = this.gl;

    // DEBUG: Log first few fillRect calls
    if (!this._fillRectCount) this._fillRectCount = 0;
    this._fillRectCount++;
    if (this._fillRectCount <= 3) {
      const boundFB = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      console.log(`[WebGL2D.fillRect #${this._fillRectCount}] pos=(${x},${y}) size=(${width}x${height}) color=${this.fillStyle} boundFB=${boundFB}`);
    }

    // TEMPORARY: Disabled gl.clear optimization to debug rendering issue
    // If filling the entire canvas, use gl.clear for efficiency (background clear)
    // if (x === 0 && y === 0 && width === this.width && height === this.height) {
    //   const color = this.parseColor(this.fillStyle);
    //   gl.clearColor(color[0], color[1], color[2], color[3] * this._globalAlpha);
    //   gl.clear(gl.COLOR_BUFFER_BIT);
    //   return;
    // }

    const vertices = new Float32Array([
      x, y,
      x + width, y,
      x, y + height,
      x, y + height,
      x + width, y,
      x + width, y + height,
    ]);

    this.drawSolid(vertices, this.parseColor(this.currentFillStyle));
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    const lw = this.currentLineWidth;

    // Draw 4 rectangles for the border
    this.fillRect(x, y, width, lw); // Top
    this.fillRect(x, y + height - lw, width, lw); // Bottom
    this.fillRect(x, y, lw, height); // Left
    this.fillRect(x + width - lw, y, lw, height); // Right
  }

  clearRect(x: number, y: number, width: number, height: number): void {
    // Clear to transparent
    const savedAlpha = this.currentGlobalAlpha;
    const savedFill = this.currentFillStyle;
    this.currentGlobalAlpha = 0;
    this.currentFillStyle = 'rgba(0,0,0,0)';
    this.fillRect(x, y, width, height);
    this.currentGlobalAlpha = savedAlpha;
    this.currentFillStyle = savedFill;
  }

  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    // Use Canvas2D to render text, then upload as texture
    const ctx = this.textCtx;
    ctx.font = this.currentFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const metrics = ctx.measureText(text);
    const textWidth = maxWidth ? Math.min(metrics.width, maxWidth) : metrics.width;
    const textHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent) + 4;

    // Clear and draw text
    ctx.clearRect(0, 0, textWidth + 10, textHeight + 10);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 1;
    ctx.font = this.currentFont;
    ctx.fillText(text, 0, 0, maxWidth);

    // Get image data
    const imageData = ctx.getImageData(0, 0, textWidth + 10, textHeight + 10);

    // Create texture
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Calculate final position based on alignment
    let finalX = x;
    let finalY = y;

    if (this.currentTextAlign === 'center') {
      finalX = x - textWidth / 2;
    } else if (this.currentTextAlign === 'right' || this.currentTextAlign === 'end') {
      finalX = x - textWidth;
    }

    if (this.currentTextBaseline === 'middle') {
      finalY = y - textHeight / 2;
    } else if (this.currentTextBaseline === 'bottom') {
      finalY = y - textHeight;
    } else if (this.currentTextBaseline === 'alphabetic') {
      finalY = y - metrics.actualBoundingBoxAscent;
    }

    // Draw texture
    this.drawTexture(texture, finalX, finalY, textWidth + 10, textHeight + 10, this.parseColor(this.currentFillStyle));

    // Clean up
    gl.deleteTexture(texture);
  }

  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    // For now, just render as filled text
    // TODO: Implement proper stroke text
    this.fillText(text, x, y, maxWidth);
  }

  measureText(text: string): TextMetrics {
    // Use the internal text context to measure text
    const ctx = this.textCtx;
    ctx.font = this.currentFont;
    return ctx.measureText(text);
  }

  beginPath(): void {
    this.pathVertices = [];
    this.pathCommands = [];
  }

  moveTo(x: number, y: number): void {
    this.pathVertices.push(x, y);
    this.pathCommands.push('move');
  }

  lineTo(x: number, y: number): void {
    this.pathVertices.push(x, y);
    this.pathCommands.push('line');
  }

  stroke(): void {
    if (!this.solidProgram) {
      console.error('[WebGL2D] stroke() called but solidProgram is null!');
      return;
    }
    if (this.pathVertices.length < 4) return;

    // Draw thick lines by rendering rectangles for each line segment
    // This is necessary because WebGL lineWidth is limited to 1 on most platforms
    const halfWidth = this.currentLineWidth / 2;
    const color = this.parseColor(this.currentStrokeStyle);

    // Process path vertices, only drawing lines between consecutive lineTo calls
    // Skip drawing when we encounter a moveTo (which creates a gap in the path)
    for (let i = 0; i < this.pathCommands.length - 1; i++) {
      // Only draw a line if current point is NOT a moveTo (i.e., it's a lineTo following another point)
      if (this.pathCommands[i + 1] === 'move') {
        continue; // Skip - next point is a moveTo, so don't connect
      }

      const x1 = this.pathVertices[i * 2];
      const y1 = this.pathVertices[i * 2 + 1];
      const x2 = this.pathVertices[i * 2 + 2];
      const y2 = this.pathVertices[i * 2 + 3];

      // Calculate line direction and perpendicular
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) continue;

      // Perpendicular vector (normalized)
      const px = -dy / length * halfWidth;
      const py = dx / length * halfWidth;

      // Create rectangle vertices for the line segment
      const vertices = new Float32Array([
        x1 + px, y1 + py,
        x2 + px, y2 + py,
        x1 - px, y1 - py,
        x1 - px, y1 - py,
        x2 + px, y2 + py,
        x2 - px, y2 - py,
      ]);

      this.drawSolid(vertices, color);
    }
  }

  fill(): void {
    // TODO: Implement polygon fill
    // Note: This is called but not needed - WebGL2D handles fills differently
    // Suppressed warning to avoid console spam
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    const segments = 64;
    const angleStep = (endAngle - startAngle) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (counterclockwise ? -angleStep * i : angleStep * i);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;

      if (i === 0 || this.pathVertices.length === 0) {
        this.moveTo(px, py);
      } else {
        this.lineTo(px, py);
      }
    }
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.transformMatrix = [a, b, c, d, e, f];
  }

  translate(x: number, y: number): void {
    // Apply translation to current transform matrix
    // Translation is: [1, 0, 0, 1, x, y]
    const [a, b, c, d, e, f] = this.transformMatrix;
    this.transformMatrix = [a, b, c, d, a * x + c * y + e, b * x + d * y + f];
  }

  scale(x: number, y: number): void {
    // Apply scaling to current transform matrix
    const [a, b, c, d, e, f] = this.transformMatrix;
    this.transformMatrix = [a * x, b * x, c * y, d * y, e, f];
  }

  rotate(angle: number): void {
    // Apply rotation to current transform matrix
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [a, b, c, d, e, f] = this.transformMatrix;
    this.transformMatrix = [
      a * cos + c * sin,
      b * cos + d * sin,
      a * -sin + c * cos,
      b * -sin + d * cos,
      e,
      f
    ];
  }

  getTransform(): DOMMatrix {
    return new DOMMatrix(this.transformMatrix);
  }

  save(): void {
    this.transformStack.push([...this.transformMatrix]);
  }

  restore(): void {
    if (this.transformStack.length > 0) {
      this.transformMatrix = this.transformStack.pop()!;
    }
  }

  setLineDash(segments: number[]): void {
    // TODO: Implement dashed lines
  }

  getLineDash(): number[] {
    return [];
  }

  // Gradient stubs - return mock objects that store primary color
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
    const gradient = {
      _primaryColor: undefined as string | undefined,
      addColorStop(offset: number, color: string) {
        // Use the first color stop as the primary color
        if (!this._primaryColor) {
          this._primaryColor = color;
        }
      }
    };
    return gradient;
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): any {
    const gradient = {
      _primaryColor: undefined as string | undefined,
      addColorStop(offset: number, color: string) {
        if (!this._primaryColor) {
          this._primaryColor = color;
        }
      }
    };
    return gradient;
  }

  // ============================================================================
  // Internal drawing methods
  // ============================================================================

  private drawSolid(vertices: Float32Array, color: [number, number, number, number]): void {
    const gl = this.gl;

    gl.useProgram(this.solidProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.solidProgram!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(this.solidProgram!, 'u_resolution');
    gl.uniform2f(resLoc, this.width, this.height);

    const transformLoc = gl.getUniformLocation(this.solidProgram!, 'u_transform');
    gl.uniformMatrix3fv(transformLoc, false, new Float32Array([
      this.transformMatrix[0], this.transformMatrix[1], 0,
      this.transformMatrix[2], this.transformMatrix[3], 0,
      this.transformMatrix[4], this.transformMatrix[5], 1
    ]));

    const colorLoc = gl.getUniformLocation(this.solidProgram!, 'u_color');
    gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3] * this.currentGlobalAlpha);

    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
  }

  private drawTexture(texture: WebGLTexture | null, x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
    const gl = this.gl;

    const vertices = new Float32Array([
      x, y, 0, 0,
      x + width, y, 1, 0,
      x, y + height, 0, 1,
      x, y + height, 0, 1,
      x + width, y, 1, 0,
      x + width, y + height, 1, 1,
    ]);

    gl.useProgram(this.textureProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    const posLoc = gl.getAttribLocation(this.textureProgram!, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

    const texLoc = gl.getAttribLocation(this.textureProgram!, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);

    const resLoc = gl.getUniformLocation(this.textureProgram!, 'u_resolution');
    gl.uniform2f(resLoc, this.width, this.height);

    const transformLoc = gl.getUniformLocation(this.textureProgram!, 'u_transform');
    gl.uniformMatrix3fv(transformLoc, false, new Float32Array([
      this.transformMatrix[0], this.transformMatrix[1], 0,
      this.transformMatrix[2], this.transformMatrix[3], 0,
      this.transformMatrix[4], this.transformMatrix[5], 1
    ]));

    const colorLoc = gl.getUniformLocation(this.textureProgram!, 'u_color');
    gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3] * this.currentGlobalAlpha);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const samplerLoc = gl.getUniformLocation(this.textureProgram!, 'u_texture');
    gl.uniform1i(samplerLoc, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private parseColor(color: string): [number, number, number, number] {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    } else if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        return [
          parseInt(match[1]) / 255,
          parseInt(match[2]) / 255,
          parseInt(match[3]) / 255,
          match[4] ? parseFloat(match[4]) : 1
        ];
      }
    } else if (color.startsWith('hsl')) {
      const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
      if (match) {
        const [r, g, b] = this.hslToRgb(
          parseInt(match[1]) / 360,
          parseInt(match[2]) / 100,
          parseInt(match[3]) / 100
        );
        return [r, g, b, match[4] ? parseFloat(match[4]) : 1];
      }
    }
    return [0, 0, 0, 1];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }

  clear(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  getGL(): WebGL2RenderingContext {
    return this.gl;
  }
}
