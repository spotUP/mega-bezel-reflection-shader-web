/**
 * Ambient Lighting Renderer for Mega Bezel
 *
 * Handles realistic lighting effects for bezel graphics:
 * - Screen glow based on content brightness
 * - Ambient lighting from screen illumination
 * - Reflections and specular highlights
 * - Dynamic lighting updates based on game content
 */

import * as THREE from 'three';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';

export interface LightingParameters {
  screenGlowIntensity: number;
  screenGlowRadius: number;
  ambientBrightness: number;
  reflectionIntensity: number;
  specularPower: number;
  lightFalloff: number;
}

export class AmbientLightingRenderer {
  private renderer: THREE.WebGLRenderer;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;

  // Lighting render targets
  private glowRenderTarget: THREE.WebGLRenderTarget;
  private lightingRenderTarget: THREE.WebGLRenderTarget;

  // Lighting materials
  private glowMaterial: THREE.ShaderMaterial;
  private lightingMaterial: THREE.ShaderMaterial;
  private reflectionMaterial: THREE.ShaderMaterial;

  // Rendering resources
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Lighting parameters
  private lightingParams: LightingParameters;

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager: ParameterManager,
    coordinateSystem: MegaBezelCoordinateSystem
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager;
    this.coordinateSystem = coordinateSystem;

    this.initializeLightingParameters();
    this.initializeRenderTargets();
    this.initializeMaterials();
    this.initializeRenderingResources();
  }

  /**
   * Initialize default lighting parameters
   */
  private initializeLightingParameters(): void {
    this.lightingParams = {
      screenGlowIntensity: 0.5,
      screenGlowRadius: 0.1,
      ambientBrightness: 0.3,
      reflectionIntensity: 0.2,
      specularPower: 32.0,
      lightFalloff: 2.0
    };
  }

  /**
   * Initialize render targets for lighting effects
   */
  private initializeRenderTargets(): void {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Glow render target for screen glow effect
    this.glowRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Lighting render target for combined lighting
    this.lightingRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
  }

  /**
   * Initialize shader materials for lighting effects
   */
  private initializeMaterials(): void {
    // Screen glow material - creates glow effect around bright screen areas
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        screenTexture: { value: null },
        glowIntensity: { value: this.lightingParams.screenGlowIntensity },
        glowRadius: { value: this.lightingParams.screenGlowRadius },
        screenRect: { value: new THREE.Vector4(0.1, 0.1, 0.8, 0.8) } // x, y, width, height
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D screenTexture;
        uniform float glowIntensity;
        uniform float glowRadius;
        uniform vec4 screenRect; // x, y, width, height in 0-1 space
        varying vec2 vUv;

        void main() {
          // Check if we're within the screen area
          vec2 screenPos = (vUv - screenRect.xy) / screenRect.zw;
          bool inScreen = screenPos.x >= 0.0 && screenPos.x <= 1.0 &&
                         screenPos.y >= 0.0 && screenPos.y <= 1.0;

          if (inScreen) {
            // Sample screen texture
            vec4 screenColor = texture2D(screenTexture, screenPos);

            // Calculate brightness
            float brightness = dot(screenColor.rgb, vec3(0.299, 0.587, 0.114));

            // Create glow based on brightness
            float glow = brightness * glowIntensity;

            // Apply distance-based falloff for edge glow
            vec2 distFromEdge = min(screenPos, 1.0 - screenPos);
            float edgeFactor = min(distFromEdge.x, distFromEdge.y) / glowRadius;
            edgeFactor = clamp(edgeFactor, 0.0, 1.0);

            glow *= (1.0 - edgeFactor);

            gl_FragColor = vec4(screenColor.rgb * glow, glow);
          } else {
            gl_FragColor = vec4(0.0);
          }
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    // Ambient lighting material - creates overall illumination
    this.lightingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        screenTexture: { value: null },
        glowTexture: { value: null },
        ambientBrightness: { value: this.lightingParams.ambientBrightness },
        lightFalloff: { value: this.lightingParams.lightFalloff },
        screenRect: { value: new THREE.Vector4(0.1, 0.1, 0.8, 0.8) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D screenTexture;
        uniform sampler2D glowTexture;
        uniform float ambientBrightness;
        uniform float lightFalloff;
        uniform vec4 screenRect;
        varying vec2 vUv;

        void main() {
          // Sample glow texture
          vec4 glowColor = texture2D(glowTexture, vUv);

          // Calculate distance from screen center for falloff
          vec2 screenCenter = screenRect.xy + screenRect.zw * 0.5;
          vec2 distVec = vUv - screenCenter;
          float distance = length(distVec);

          // Apply distance-based falloff
          float falloff = 1.0 / (1.0 + pow(distance * lightFalloff, 2.0));

          // Combine ambient brightness with screen-based lighting
          vec3 lightingColor = vec3(ambientBrightness) + glowColor.rgb * falloff;

          // Add some color temperature variation
          lightingColor *= vec3(1.0, 0.95, 0.9); // Slightly warm lighting

          gl_FragColor = vec4(lightingColor, 1.0);
        }
      `,
      transparent: false,
      depthTest: false,
      depthWrite: false
    });

    // Reflection material - adds specular highlights
    this.reflectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        lightingTexture: { value: null },
        reflectionIntensity: { value: this.lightingParams.reflectionIntensity },
        specularPower: { value: this.lightingParams.specularPower },
        normalMap: { value: null }, // Optional normal map for surface detail
        viewPosition: { value: new THREE.Vector3(0, 0, 1) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D lightingTexture;
        uniform float reflectionIntensity;
        uniform float specularPower;
        uniform sampler2D normalMap;
        uniform vec3 viewPosition;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Sample lighting
          vec3 lighting = texture2D(lightingTexture, vUv).rgb;

          // Calculate reflection vector
          vec3 reflectDir = reflect(-vViewDir, vNormal);

          // Simple specular calculation
          float specular = pow(max(dot(reflectDir, vec3(0, 0, 1)), 0.0), specularPower);

          // Apply lighting to specular
          vec3 reflectionColor = lighting * specular * reflectionIntensity;

          gl_FragColor = vec4(reflectionColor, 1.0);
        }
      `,
      transparent: true,
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
   * Update lighting parameters from Mega Bezel parameters
   */
  private updateLightingParameters(): void {
    // Update from parameter manager
    this.lightingParams.screenGlowIntensity = this.parameterManager.getValue('HSM_AMBIENT_LIGHTING_SCREEN_GLOW') || 0.5;
    this.lightingParams.ambientBrightness = this.parameterManager.getValue('HSM_AMBIENT_LIGHTING_BRIGHTNESS') || 0.3;
    this.lightingParams.reflectionIntensity = this.parameterManager.getValue('HSM_REFLECTION_OPACITY') || 0.2;

    // Update shader uniforms
    this.glowMaterial.uniforms.glowIntensity.value = this.lightingParams.screenGlowIntensity;
    this.lightingMaterial.uniforms.ambientBrightness.value = this.lightingParams.ambientBrightness;
    this.reflectionMaterial.uniforms.reflectionIntensity.value = this.lightingParams.reflectionIntensity;
  }

  /**
   * Render ambient lighting effects
   */
  render(
    screenTexture: THREE.Texture,
    outputTarget?: THREE.WebGLRenderTarget
  ): THREE.WebGLRenderTarget {
    // Update parameters
    this.updateLightingParameters();

    // Step 1: Render screen glow
    this.renderScreenGlow(screenTexture);

    // Step 2: Render ambient lighting
    this.renderAmbientLighting(screenTexture);

    // Step 3: Render reflections (optional)
    this.renderReflections();

    // Return the final lighting texture
    return this.lightingRenderTarget;
  }

  /**
   * Render screen glow effect
   */
  private renderScreenGlow(screenTexture: THREE.Texture): void {
    // Update screen rectangle
    const screenRect = this.coordinateSystem.getScreenRect();
    this.glowMaterial.uniforms.screenRect.value.set(
      screenRect.x, screenRect.y, screenRect.width, screenRect.height
    );

    // Set material and texture
    this.quad.material = this.glowMaterial;
    this.glowMaterial.uniforms.screenTexture.value = screenTexture;

    // Render to glow target
    this.renderer.setRenderTarget(this.glowRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Render ambient lighting
   */
  private renderAmbientLighting(screenTexture: THREE.Texture): void {
    // Update screen rectangle
    const screenRect = this.coordinateSystem.getScreenRect();
    this.lightingMaterial.uniforms.screenRect.value.set(
      screenRect.x, screenRect.y, screenRect.width, screenRect.height
    );

    // Set material and textures
    this.quad.material = this.lightingMaterial;
    this.lightingMaterial.uniforms.screenTexture.value = screenTexture;
    this.lightingMaterial.uniforms.glowTexture.value = this.glowRenderTarget.texture;

    // Render to lighting target
    this.renderer.setRenderTarget(this.lightingRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Render reflection effects
   */
  private renderReflections(): void {
    // For now, skip reflections as they require more complex setup
    // This would involve normal maps and proper 3D lighting calculations
    // TODO: Implement full reflection system in future phases
  }

  /**
   * Get the lighting texture for use in composition
   */
  getLightingTexture(): THREE.Texture {
    return this.lightingRenderTarget.texture;
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    this.glowRenderTarget.setSize(width, height);
    this.lightingRenderTarget.setSize(width, height);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.glowRenderTarget.dispose();
    this.lightingRenderTarget.dispose();
    this.glowMaterial.dispose();
    this.lightingMaterial.dispose();
    this.reflectionMaterial.dispose();
    this.quad.geometry.dispose();
  }

  /**
   * Set custom lighting parameters
   */
  setLightingParameters(params: Partial<LightingParameters>): void {
    Object.assign(this.lightingParams, params);
  }

  /**
   * Get current lighting parameters
   */
  getLightingParameters(): LightingParameters {
    return { ...this.lightingParams };
  }
}