/**
 * Temporal Effects Renderer for Mega Bezel
 *
 * Handles advanced temporal effects including:
 * - Motion blur based on frame-to-frame changes
 * - Temporal anti-aliasing (TAA) for reduced aliasing
 * - Frame history management and temporal stability
 * - Velocity-based effects and motion vectors
 * - Temporal denoising and quality improvements
 */

import * as THREE from 'three';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';

export interface TemporalParameters {
  motionBlurStrength: number;
  motionBlurSamples: number;
  taaEnabled: boolean;
  taaBlendFactor: number;
  frameHistoryDepth: number;
  temporalStability: number;
  velocityScale: number;
}

export interface FrameHistory {
  texture: THREE.Texture;
  timestamp: number;
  velocity?: THREE.Texture;
}

export class TemporalEffectsRenderer {
  private renderer: THREE.WebGLRenderer;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;

  // Temporal render targets
  private currentFrameTarget: THREE.WebGLRenderTarget;
  private previousFrameTarget: THREE.WebGLRenderTarget;
  private motionBlurTarget: THREE.WebGLRenderTarget;
  private taaTarget: THREE.WebGLRenderTarget;

  // Frame history
  private frameHistory: FrameHistory[] = [];
  private maxHistoryDepth: number = 8;
  private currentHistoryIndex: number = 0;

  // Motion vectors and velocity
  private velocityTarget: THREE.WebGLRenderTarget;
  private velocityMaterial: THREE.ShaderMaterial;

  // Temporal effects materials
  private motionBlurMaterial: THREE.ShaderMaterial;
  private taaMaterial: THREE.ShaderMaterial;
  private temporalBlendMaterial: THREE.ShaderMaterial;

  // Rendering resources
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Temporal parameters
  private temporalParams: TemporalParameters;

  // Frame timing
  private lastFrameTime: number = 0;
  private frameDeltaTime: number = 1/60;

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager: ParameterManager,
    coordinateSystem: MegaBezelCoordinateSystem
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager;
    this.coordinateSystem = coordinateSystem;

    this.initializeTemporalParameters();
    this.initializeRenderTargets();
    this.initializeMaterials();
    this.initializeRenderingResources();
    this.initializeFrameHistory();
  }

  /**
   * Initialize default temporal parameters
   */
  private initializeTemporalParameters(): void {
    this.temporalParams = {
      motionBlurStrength: 0.5,
      motionBlurSamples: 8,
      taaEnabled: true,
      taaBlendFactor: 0.1,
      frameHistoryDepth: 4,
      temporalStability: 0.95,
      velocityScale: 1.0
    };
  }

  /**
   * Initialize render targets for temporal effects
   */
  private initializeRenderTargets(): void {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Current and previous frame targets
    this.currentFrameTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    this.previousFrameTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Motion blur and TAA targets
    this.motionBlurTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    this.taaTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Velocity buffer for motion vectors
    this.velocityTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    });
  }

  /**
   * Initialize shader materials for temporal effects
   */
  private initializeMaterials(): void {
    // Velocity calculation material (simplified - would need motion vectors from game)
    this.velocityMaterial = new THREE.ShaderMaterial({
      uniforms: {
        currentFrame: { value: null },
        previousFrame: { value: null },
        deltaTime: { value: 1/60 },
        velocityScale: { value: this.temporalParams.velocityScale }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D currentFrame;
        uniform sampler2D previousFrame;
        uniform float deltaTime;
        uniform float velocityScale;
        varying vec2 vUv;

        void main() {
          // Simplified velocity calculation based on frame differences
          // In a real implementation, this would use actual motion vectors
          vec4 current = texture2D(currentFrame, vUv);
          vec4 previous = texture2D(previousFrame, vUv);

          // Calculate velocity based on color differences (simplified)
          vec3 colorDiff = current.rgb - previous.rgb;
          float velocity = length(colorDiff) * velocityScale;

          // Store velocity as RG (velocity vector) and B (magnitude)
          gl_FragColor = vec4(velocity * 0.1, velocity * 0.1, velocity, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // Motion blur material
    this.motionBlurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        inputTexture: { value: null },
        velocityTexture: { value: null },
        blurStrength: { value: this.temporalParams.motionBlurStrength },
        numSamples: { value: this.temporalParams.motionBlurSamples }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D inputTexture;
        uniform sampler2D velocityTexture;
        uniform float blurStrength;
        uniform float numSamples;
        varying vec2 vUv;

        void main() {
          vec4 result = vec4(0.0);
          float totalWeight = 0.0;

          // Sample along velocity vector
          vec4 velocity = texture2D(velocityTexture, vUv);
          vec2 velocityDir = velocity.rg * 2.0 - 1.0;
          float velocityMag = velocity.b;

          // Skip motion blur for static pixels
          if (velocityMag < 0.01) {
            gl_FragColor = texture2D(inputTexture, vUv);
            return;
          }

          // Motion blur along velocity direction
          for (float i = 0.0; i < numSamples; i++) {
            float t = (i - (numSamples - 1.0) * 0.5) / (numSamples - 1.0);
            vec2 offset = velocityDir * t * blurStrength * velocityMag * 0.1;
            vec2 sampleUv = vUv + offset;

            // Boundary check
            if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 && sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
              float weight = 1.0 - abs(t);
              result += texture2D(inputTexture, sampleUv) * weight;
              totalWeight += weight;
            }
          }

          gl_FragColor = result / totalWeight;
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // Temporal anti-aliasing material
    this.taaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        currentFrame: { value: null },
        historyFrame: { value: null },
        velocityTexture: { value: null },
        blendFactor: { value: this.temporalParams.taaBlendFactor },
        temporalStability: { value: this.temporalParams.temporalStability }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D currentFrame;
        uniform sampler2D historyFrame;
        uniform sampler2D velocityTexture;
        uniform float blendFactor;
        uniform float temporalStability;
        varying vec2 vUv;

        // Neighborhood clamping to reduce ghosting
        vec4 clampToNeighborhood(vec4 color, vec2 uv, sampler2D tex) {
          vec4 minColor = vec4(1.0);
          vec4 maxColor = vec4(0.0);

          // Sample 3x3 neighborhood
          for (int x = -1; x <= 1; x++) {
            for (int y = -1; y <= 1; y++) {
              vec2 offset = vec2(float(x), float(y)) * 0.01; // Adjust for pixel size
              vec4 sampleColor = texture2D(tex, uv + offset);
              minColor = min(minColor, sampleColor);
              maxColor = max(maxColor, sampleColor);
            }
          }

          return clamp(color, minColor, maxColor);
        }

        void main() {
          vec4 current = texture2D(currentFrame, vUv);
          vec4 history = texture2D(historyFrame, vUv);
          vec4 velocity = texture2D(velocityTexture, vUv);

          // Clamp history to current frame neighborhood to reduce ghosting
          history = clampToNeighborhood(history, vUv, currentFrame);

          // Blend current and history frames
          float velocityMag = velocity.b;
          float adaptiveBlend = blendFactor * (1.0 - velocityMag * 0.5); // Less blending for moving objects

          vec4 taaResult = mix(current, history, adaptiveBlend * temporalStability);

          gl_FragColor = taaResult;
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    // Temporal blending material for general use
    this.temporalBlendMaterial = new THREE.ShaderMaterial({
      uniforms: {
        currentFrame: { value: null },
        historyFrame: { value: null },
        blendFactor: { value: 0.1 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D currentFrame;
        uniform sampler2D historyFrame;
        uniform float blendFactor;
        varying vec2 vUv;

        void main() {
          vec4 current = texture2D(currentFrame, vUv);
          vec4 history = texture2D(historyFrame, vUv);
          gl_FragColor = mix(current, history, blendFactor);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }

  /**
   * Initialize rendering resources
   */
  private initializeRenderingResources(): void {
    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry);

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 0.5;
  }

  /**
   * Initialize frame history buffer
   */
  private initializeFrameHistory(): void {
    this.frameHistory = [];
    for (let i = 0; i < this.maxHistoryDepth; i++) {
      const target = new THREE.WebGLRenderTarget(
        this.renderer.getSize(new THREE.Vector2()).x,
        this.renderer.getSize(new THREE.Vector2()).y,
        {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType
        }
      );

      this.frameHistory.push({
        texture: target.texture,
        timestamp: 0
      });
    }
  }

  /**
   * Update temporal parameters from Mega Bezel parameters
   */
  private updateTemporalParameters(): void {
    // Update from parameter manager
    this.temporalParams.motionBlurStrength = this.parameterManager.getValue('HSM_MOTION_BLUR_STRENGTH') || 0.5;
    this.temporalParams.motionBlurSamples = Math.floor(this.parameterManager.getValue('HSM_MOTION_BLUR_SAMPLES') || 8);
    this.temporalParams.taaBlendFactor = this.parameterManager.getValue('HSM_TAA_BLEND_FACTOR') || 0.1;
    this.temporalParams.temporalStability = this.parameterManager.getValue('HSM_TEMPORAL_STABILITY') || 0.95;
    this.temporalParams.velocityScale = this.parameterManager.getValue('HSM_VELOCITY_SCALE') || 1.0;

    // Update shader uniforms
    this.motionBlurMaterial.uniforms.blurStrength.value = this.temporalParams.motionBlurStrength;
    this.motionBlurMaterial.uniforms.numSamples.value = this.temporalParams.motionBlurSamples;
    this.taaMaterial.uniforms.blendFactor.value = this.temporalParams.taaBlendFactor;
    this.taaMaterial.uniforms.temporalStability.value = this.temporalParams.temporalStability;
    this.velocityMaterial.uniforms.velocityScale.value = this.temporalParams.velocityScale;
  }

  /**
   * Calculate motion vectors between frames
   */
  private calculateMotionVectors(currentFrame: THREE.Texture): void {
    this.velocityMaterial.uniforms.currentFrame.value = currentFrame;
    this.velocityMaterial.uniforms.previousFrame.value = this.previousFrameTarget.texture;
    this.velocityMaterial.uniforms.deltaTime.value = this.frameDeltaTime;

    this.quad.material = this.velocityMaterial;
    this.renderer.setRenderTarget(this.velocityTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Apply motion blur effect
   */
  private applyMotionBlur(inputTexture: THREE.Texture): THREE.WebGLRenderTarget {
    this.motionBlurMaterial.uniforms.inputTexture.value = inputTexture;
    this.motionBlurMaterial.uniforms.velocityTexture.value = this.velocityTarget.texture;

    this.quad.material = this.motionBlurMaterial;
    this.renderer.setRenderTarget(this.motionBlurTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.motionBlurTarget;
  }

  /**
   * Apply temporal anti-aliasing
   */
  private applyTemporalAA(currentFrame: THREE.Texture): THREE.WebGLRenderTarget {
    // Get the most recent history frame
    const historyFrame = this.getRecentHistoryFrame();

    this.taaMaterial.uniforms.currentFrame.value = currentFrame;
    this.taaMaterial.uniforms.historyFrame.value = historyFrame?.texture || currentFrame;
    this.taaMaterial.uniforms.velocityTexture.value = this.velocityTarget.texture;

    this.quad.material = this.taaMaterial;
    this.renderer.setRenderTarget(this.taaTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.taaTarget;
  }

  /**
   * Get the most recent frame from history
   */
  private getRecentHistoryFrame(): FrameHistory | null {
    if (this.frameHistory.length === 0) return null;

    // Find the most recent frame (highest timestamp)
    let recentFrame = this.frameHistory[0];
    for (const frame of this.frameHistory) {
      if (frame.timestamp > recentFrame.timestamp) {
        recentFrame = frame;
      }
    }

    return recentFrame;
  }

  /**
   * Update frame history
   */
  private updateFrameHistory(currentFrame: THREE.Texture): void {
    const now = performance.now();

    // Add current frame to history
    this.frameHistory[this.currentHistoryIndex] = {
      texture: currentFrame,
      timestamp: now
    };

    this.currentHistoryIndex = (this.currentHistoryIndex + 1) % this.maxHistoryDepth;

    // Remove old frames beyond history depth
    const cutoffTime = now - (1000 / 30) * this.temporalParams.frameHistoryDepth; // Keep ~N frames of history
    this.frameHistory = this.frameHistory.filter(frame => frame.timestamp > cutoffTime);
  }

  /**
   * Render temporal effects pipeline
   */
  renderTemporalEffects(inputTexture: THREE.Texture): THREE.WebGLRenderTarget {
    this.updateTemporalParameters();

    const currentTime = performance.now();
    this.frameDeltaTime = (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    // Step 1: Calculate motion vectors
    this.calculateMotionVectors(inputTexture);

    // Step 2: Apply motion blur if enabled
    let processedTexture = inputTexture;
    if (this.temporalParams.motionBlurStrength > 0) {
      const motionBlurred = this.applyMotionBlur(inputTexture);
      processedTexture = motionBlurred.texture;
    }

    // Step 3: Apply temporal anti-aliasing if enabled
    let finalTexture = processedTexture;
    if (this.temporalParams.taaEnabled) {
      const taaResult = this.applyTemporalAA(processedTexture);
      finalTexture = taaResult.texture;
    }

    // Step 4: Update frame history for next frame
    this.updateFrameHistory(finalTexture);

    // Step 5: Swap frame buffers for next frame
    const temp = this.currentFrameTarget;
    this.currentFrameTarget = this.previousFrameTarget;
    this.previousFrameTarget = temp;

    // Copy current result to current frame target for next frame's motion vectors
    this.temporalBlendMaterial.uniforms.currentFrame.value = finalTexture;
    this.temporalBlendMaterial.uniforms.historyFrame.value = this.currentFrameTarget.texture;
    this.temporalBlendMaterial.uniforms.blendFactor.value = 1.0; // Full copy

    this.quad.material = this.temporalBlendMaterial;
    this.renderer.setRenderTarget(this.currentFrameTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.currentFrameTarget;
  }

  /**
   * Get temporal effects texture
   */
  getTemporalTexture(): THREE.Texture {
    return this.currentFrameTarget.texture;
  }

  /**
   * Get motion blur texture
   */
  getMotionBlurTexture(): THREE.Texture {
    return this.motionBlurTarget.texture;
  }

  /**
   * Get TAA texture
   */
  getTAATexture(): THREE.Texture {
    return this.taaTarget.texture;
  }

  /**
   * Get velocity texture
   */
  getVelocityTexture(): THREE.Texture {
    return this.velocityTarget.texture;
  }

  /**
   * Set temporal parameters
   */
  setTemporalParameters(params: Partial<TemporalParameters>): void {
    Object.assign(this.temporalParams, params);
  }

  /**
   * Get current temporal parameters
   */
  getTemporalParameters(): TemporalParameters {
    return { ...this.temporalParams };
  }

  /**
   * Enable/disable TAA
   */
  setTAAEnabled(enabled: boolean): void {
    this.temporalParams.taaEnabled = enabled;
  }

  /**
   * Set motion blur strength
   */
  setMotionBlurStrength(strength: number): void {
    this.temporalParams.motionBlurStrength = Math.max(0, Math.min(1, strength));
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    this.currentFrameTarget.setSize(width, height);
    this.previousFrameTarget.setSize(width, height);
    this.motionBlurTarget.setSize(width, height);
    this.taaTarget.setSize(width, height);
    this.velocityTarget.setSize(width, height);

    // Reinitialize frame history with new size
    this.initializeFrameHistory();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.currentFrameTarget.dispose();
    this.previousFrameTarget.dispose();
    this.motionBlurTarget.dispose();
    this.taaTarget.dispose();
    this.velocityTarget.dispose();

    this.velocityMaterial.dispose();
    this.motionBlurMaterial.dispose();
    this.taaMaterial.dispose();
    this.temporalBlendMaterial.dispose();

    this.quad.geometry.dispose();

    // Dispose frame history
    this.frameHistory.forEach(frame => {
      if (frame.texture instanceof THREE.WebGLRenderTarget) {
        frame.texture.dispose();
      }
    });
  }

  /**
   * Get frame timing information
   */
  getFrameTiming(): { deltaTime: number; fps: number } {
    return {
      deltaTime: this.frameDeltaTime,
      fps: 1 / Math.max(this.frameDeltaTime, 1/1000) // Cap at 1000fps minimum
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    return {
      frameHistoryDepth: this.frameHistory.length,
      temporalParams: this.temporalParams,
      frameTiming: this.getFrameTiming()
    };
  }
}