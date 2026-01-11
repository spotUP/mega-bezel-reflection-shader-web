/**
 * Bezel Composition Renderer for Mega Bezel
 *
 * Handles the visual composition of bezel elements:
 * - Background textures and gradients
 * - Frame graphics and overlays
 * - Screen placement and masking
 * - Layer compositing and blending
 * - Coordinate space transformations
 */

import * as THREE from 'three';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';
import { ParameterManager } from './ParameterManager';
import { BezelGraphicsManager, BezelTexture } from './BezelGraphicsManager';
import { SpecularReflectionsRenderer } from './SpecularReflectionsRenderer';

export interface BezelLayer {
  name: string;
  texture?: BezelTexture;
  position: [number, number];
  scale: [number, number];
  rotation: number;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay';
  visible: boolean;
}

export interface ScreenPlacement {
  position: [number, number];
  scale: [number, number];
  curvature: number;
  maskSoftness: number;
  cornerRadius: number;
}

export class BezelCompositionRenderer {
  private renderer: THREE.WebGLRenderer;
  private coordinateSystem: MegaBezelCoordinateSystem;
  private parameterManager: ParameterManager;
  private bezelGraphics: BezelGraphicsManager;
  private specularReflections: SpecularReflectionsRenderer;

  // Rendering resources
  private compositionScene: THREE.Scene;
  private compositionCamera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;

  // Bezel layers
  private backgroundLayer: BezelLayer;
  private frameLayer: BezelLayer;
  private bezelLayers: BezelLayer[] = [];

  // Screen placement
  private screenPlacement: ScreenPlacement;

  // Composition render target
  private compositionTarget: THREE.WebGLRenderTarget;

  constructor(
    renderer: THREE.WebGLRenderer,
    coordinateSystem: MegaBezelCoordinateSystem,
    parameterManager: ParameterManager,
    bezelGraphics: BezelGraphicsManager
  ) {
    this.renderer = renderer;
    this.coordinateSystem = coordinateSystem;
    this.parameterManager = parameterManager;
    this.bezelGraphics = bezelGraphics;

    this.initializeCompositionResources();
    this.initializeBezelLayers();
    this.initializeScreenPlacement();
    this.initializeReflectionsRenderer();
  }

  /**
   * Initialize composition rendering resources
   */
  private initializeCompositionResources(): void {
    // Create composition scene and camera
    this.compositionScene = new THREE.Scene();
    this.compositionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fullscreen quad for composition
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D backgroundTexture;
        uniform sampler2D frameTexture;
        uniform sampler2D screenTexture;
        uniform sampler2D lightingTexture;
        uniform sampler2D specularTexture;
        uniform sampler2D reflectionTexture;
        uniform vec2 screenPosition;
        uniform vec2 screenScale;
        uniform float screenOpacity;
        uniform float backgroundOpacity;
        uniform float frameOpacity;
        uniform float lightingIntensity;
        uniform float specularIntensity;
        uniform float reflectionIntensity;
        varying vec2 vUv;

        void main() {
          // Sample background
          vec4 backgroundColor = texture2D(backgroundTexture, vUv) * backgroundOpacity;

          // Sample frame
          vec4 frameColor = texture2D(frameTexture, vUv) * frameOpacity;

          // Sample lighting
          vec3 lightingColor = texture2D(lightingTexture, vUv).rgb * lightingIntensity;

          // Sample specular highlights
          vec3 specularColor = texture2D(specularTexture, vUv).rgb * specularIntensity;

          // Sample reflections
          vec3 reflectionColor = texture2D(reflectionTexture, vUv).rgb * reflectionIntensity;

          // Calculate screen coordinates
          vec2 screenCoord = (vUv - screenPosition) / screenScale + 0.5;

          // Sample screen (only within screen area)
          vec4 screenColor = vec4(0.0);
          if (screenCoord.x >= 0.0 && screenCoord.x <= 1.0 &&
              screenCoord.y >= 0.0 && screenCoord.y <= 1.0) {
            screenColor = texture2D(screenTexture, screenCoord) * screenOpacity;
          }

          // Apply lighting, specular, and reflections to frame and background
          vec4 litBackground = backgroundColor;
          litBackground.rgb *= (vec3(1.0) + lightingColor * 0.3); // Subtle lighting on background
          litBackground.rgb += specularColor * 0.2; // Add specular to background
          litBackground.rgb += reflectionColor * 0.1; // Add reflections to background

          vec4 litFrame = frameColor;
          litFrame.rgb *= (vec3(1.0) + lightingColor * 0.8); // Stronger lighting on frame
          litFrame.rgb += specularColor * 0.8; // Add specular highlights to frame
          litFrame.rgb += reflectionColor * 0.5; // Add reflections to frame

          // Composite layers (background -> frame -> screen)
          vec4 finalColor = litBackground;
          finalColor = mix(finalColor, litFrame, frameColor.a);
          finalColor = mix(finalColor, screenColor, screenColor.a);

          gl_FragColor = finalColor;
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    this.quad = new THREE.Mesh(geometry, material);
    this.compositionScene.add(this.quad);

    // Create composition render target
    const size = this.renderer.getSize(new THREE.Vector2());
    this.compositionTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
  }

  /**
   * Initialize bezel layers
   */
  private initializeBezelLayers(): void {
    // Background layer
    this.backgroundLayer = {
      name: 'background',
      position: [0.5, 0.5],
      scale: [1.0, 1.0],
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      visible: true
    };

    // Frame layer
    this.frameLayer = {
      name: 'frame',
      position: [0.5, 0.5],
      scale: [1.0, 1.0],
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      visible: true
    };

    this.bezelLayers = [this.backgroundLayer, this.frameLayer];
  }

  /**
   * Initialize screen placement settings
   */
  private initializeScreenPlacement(): void {
    this.screenPlacement = {
      position: [0.5, 0.5],
      scale: [0.8, 0.8],
      curvature: 0.0,
      maskSoftness: 0.01,
      cornerRadius: 0.05
    };
  }

  /**
   * Update bezel layers from parameters
   */
  private updateBezelLayers(): void {
    // Update background layer
    const bgOpacity = this.parameterManager.getValue('HSM_BZL_OPACITY') || 1.0;
    this.backgroundLayer.opacity = bgOpacity;

    // Update frame layer
    const frameOpacity = this.parameterManager.getValue('HSM_FRM_OPACITY') || 1.0;
    this.frameLayer.opacity = frameOpacity;

    // Update screen placement
    const screenPosX = this.parameterManager.getValue('HSM_SCREEN_POSITION_X') || 0;
    const screenPosY = this.parameterManager.getValue('HSM_SCREEN_POSITION_Y') || 0;
    const screenScale = this.parameterManager.getValue('HSM_NON_INTEGER_SCALE') || 0.8;

    this.screenPlacement.position = [0.5 + screenPosX / 1000, 0.5 + screenPosY / 1000];
    this.screenPlacement.scale = [screenScale, screenScale];
  }

  /**
   * Load bezel textures for layers
   */
  async loadBezelTextures(): Promise<void> {
    // Load background texture
    const bgTexture = this.bezelGraphics.getTexture('BackgroundImage');
    if (bgTexture) {
      this.backgroundLayer.texture = bgTexture;
    }

    // Load frame texture
    const frameTexture = this.bezelGraphics.getTexture('ScreenPlacementImage');
    if (frameTexture) {
      this.frameLayer.texture = frameTexture;
    }

    console.log('[BezelComposition] Loaded bezel textures');
  }

  /**
   * Render bezel composition
   */
  render(
    screenTexture: THREE.Texture,
    outputTarget?: THREE.WebGLRenderTarget,
    lightingTexture?: THREE.Texture,
    specularTexture?: THREE.Texture,
    reflectionTexture?: THREE.Texture
  ): void {
    // Generate reflection texture if not provided
    let finalReflectionTexture = reflectionTexture;
    if (!finalReflectionTexture && this.specularReflections) {
      const reflectionTarget = this.specularReflections.renderReflections(screenTexture);
      finalReflectionTexture = reflectionTarget.texture;
    }

    // Update layers from parameters
    this.updateBezelLayers();

    // Update shader uniforms
    this.updateCompositionUniforms(screenTexture, lightingTexture, specularTexture, finalReflectionTexture);

    // Set render target
    const target = outputTarget || this.compositionTarget;
    this.renderer.setRenderTarget(target);

    // Clear
    this.renderer.clear();

    // Render composition
    this.renderer.render(this.compositionScene, this.compositionCamera);

    // Reset render target
    this.renderer.setRenderTarget(null);
  }

  /**
   * Update composition shader uniforms
   */
  private updateCompositionUniforms(
    screenTexture: THREE.Texture,
    lightingTexture?: THREE.Texture,
    specularTexture?: THREE.Texture,
    reflectionTexture?: THREE.Texture
  ): void {
    const material = this.quad.material as THREE.ShaderMaterial;
    const uniforms = material.uniforms;

    // Background texture
    if (this.backgroundLayer.texture) {
      uniforms.backgroundTexture = { value: this.backgroundLayer.texture.texture };
    } else {
      // Create default background gradient
      uniforms.backgroundTexture = { value: this.createDefaultBackgroundTexture() };
    }

    // Frame texture
    if (this.frameLayer.texture) {
      uniforms.frameTexture = { value: this.frameLayer.texture.texture };
    } else {
      // Create default frame
      uniforms.frameTexture = { value: this.createDefaultFrameTexture() };
    }

    // Screen texture
    uniforms.screenTexture = { value: screenTexture };

    // Lighting texture
    if (lightingTexture) {
      uniforms.lightingTexture = { value: lightingTexture };
    } else {
      // Create default neutral lighting
      uniforms.lightingTexture = { value: this.createDefaultLightingTexture() };
    }

    // Specular texture
    if (specularTexture) {
      uniforms.specularTexture = { value: specularTexture };
    } else {
      // Create default neutral specular
      uniforms.specularTexture = { value: this.createDefaultLightingTexture() };
    }

    // Reflection texture
    if (reflectionTexture) {
      uniforms.reflectionTexture = { value: reflectionTexture };
    } else {
      // Create default neutral reflection
      uniforms.reflectionTexture = { value: this.createDefaultLightingTexture() };
    }

    // Screen placement
    uniforms.screenPosition = { value: new THREE.Vector2(
      this.screenPlacement.position[0],
      this.screenPlacement.position[1]
    ) };
    uniforms.screenScale = { value: new THREE.Vector2(
      this.screenPlacement.scale[0],
      this.screenPlacement.scale[1]
    ) };

    // Opacities and effects
    uniforms.backgroundOpacity = { value: this.backgroundLayer.opacity };
    uniforms.frameOpacity = { value: this.frameLayer.opacity };
    uniforms.screenOpacity = { value: 1.0 };
    uniforms.lightingIntensity = { value: lightingTexture ? 1.0 : 0.0 };

    // Use proper Mega Bezel reflection parameters
    const bezelInnerEdgeAmount = this.parameterManager.getValue('HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT') || 1.3;
    const frameInnerEdgeAmount = this.parameterManager.getValue('HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT') || 0.5;
    const showTubeFxAmount = this.parameterManager.getValue('HSM_REFLECT_SHOW_TUBE_FX_AMOUNT') || 1.0;

    // Calculate reflection intensities based on Mega Bezel parameters
    const specularIntensity = specularTexture ? bezelInnerEdgeAmount * 0.01 : 0.0;
    const reflectionIntensity = reflectionTexture ? frameInnerEdgeAmount * 0.01 : 0.0;

    uniforms.specularIntensity = { value: specularIntensity };
    uniforms.reflectionIntensity = { value: reflectionIntensity };
  }

  /**
   * Create default background texture (gradient)
   */
  private createDefaultBackgroundTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.5, '#16213e');
    gradient.addColorStop(1, '#0f0f23');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Create default frame texture
   */
  private createDefaultFrameTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create simple frame
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, 512, 512);

    // Screen area (transparent)
    ctx.clearRect(56, 56, 400, 400);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Create default lighting texture (neutral lighting)
   */
  private createDefaultLightingTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create neutral gray lighting (no lighting effect)
    ctx.fillStyle = '#808080'; // 50% gray = neutral lighting
    ctx.fillRect(0, 0, 512, 512);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Get composition render target
   */
  getCompositionTarget(): THREE.WebGLRenderTarget {
    return this.compositionTarget;
  }

  /**
   * Resize composition resources
   */
  resize(width: number, height: number): void {
    this.compositionTarget.setSize(width, height);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.compositionTarget.dispose();
    this.quad.geometry.dispose();
    (this.quad.material as THREE.Material).dispose();
  }

  /**
   * Get screen rectangle in viewport coordinates
   */
  getScreenRect(): { x: number, y: number, width: number, height: number } {
    return this.coordinateSystem.getScreenRect();
  }

  /**
   * Check if coordinate is within screen area
   */
  isInScreenArea(coord: [number, number]): boolean {
    return this.coordinateSystem.isInScreenArea(coord);
  }

  /**
   * Transform coordinate between spaces
   */
  transformCoordinate(coord: [number, number], from: string, to: string): [number, number] {
    return this.coordinateSystem.transform(coord, from as any, to as any);
  }

  /**
   * Initialize specular reflections renderer
   */
  private initializeReflectionsRenderer(): void {
    this.specularReflections = new SpecularReflectionsRenderer(
      this.renderer,
      this.parameterManager,
      this.coordinateSystem
    );
  }

  /**
   * Render specular reflections
   */
  renderReflections(screenTexture: THREE.Texture, target?: THREE.WebGLRenderTarget): void {
    if (this.specularReflections) {
      this.specularReflections.renderReflections(screenTexture);
    }
  }
}