/**
 * Specular Reflections Renderer for Mega Bezel
 *
 * Handles advanced lighting effects with specular highlights and reflections:
 * - Specular reflection calculations
 * - Surface material properties (roughness, metallic)
 * - Normal mapping for surface detail
 * - Fresnel effects for realistic reflections
 * - Environment mapping for complex reflections
 */

import * as THREE from 'three';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';

export interface MaterialProperties {
  roughness: number;
  metallic: number;
  specularPower: number;
  fresnelStrength: number;
  reflectionStrength: number;
}

export interface ReflectionParameters {
  materialProps: MaterialProperties;
  lightDirection: [number, number, number];
  viewPosition: [number, number, number];
  environmentMap?: THREE.Texture;
  normalMap?: THREE.Texture;
}

export class SpecularReflectionsRenderer {
  private renderer: THREE.WebGLRenderer;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;

  // Reflection render targets
  private reflectionRenderTarget: THREE.WebGLRenderTarget;
  private specularRenderTarget: THREE.WebGLRenderTarget;

  // Reflection materials
  private specularMaterial: THREE.ShaderMaterial;
  private reflectionMaterial: THREE.ShaderMaterial;
  private fresnelMaterial: THREE.ShaderMaterial;

  // Rendering resources
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Material and reflection parameters
  private materialProps: MaterialProperties;
  private reflectionParams: ReflectionParameters;

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager: ParameterManager,
    coordinateSystem: MegaBezelCoordinateSystem
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager;
    this.coordinateSystem = coordinateSystem;

    this.initializeMaterialProperties();
    this.initializeReflectionParameters();
    this.initializeRenderTargets();
    this.initializeMaterials();
    this.initializeRenderingResources();
  }

  /**
   * Initialize default material properties
   */
  private initializeMaterialProperties(): void {
    this.materialProps = {
      roughness: 0.3,
      metallic: 0.1,
      specularPower: 64.0,
      fresnelStrength: 0.5,
      reflectionStrength: 0.3
    };
  }

  /**
   * Initialize reflection parameters
   */
  private initializeReflectionParameters(): void {
    this.reflectionParams = {
      materialProps: this.materialProps,
      lightDirection: [0.5, 0.5, 1.0], // Directional light from top-right
      viewPosition: [0.0, 0.0, 1.0]   // Camera position
    };
  }

  /**
   * Initialize render targets for reflection effects
   */
  private initializeRenderTargets(): void {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Reflection render target for environment reflections
    this.reflectionRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Specular render target for specular highlights
    this.specularRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
  }

  /**
   * Initialize shader materials for reflection effects
   */
  private initializeMaterials(): void {

    // For Mega Bezel, we need screen-based reflections, not 3D geometry reflections
    // The reflections should be applied to bezel areas, not the entire viewport
    // Advanced specular highlight material with blur, noise, and fading
     this.specularMaterial = new THREE.ShaderMaterial({
       uniforms: {
         screenTexture: { value: null },
         screenPosition: { value: new THREE.Vector2(0.5, 0.5) },
         screenScale: { value: new THREE.Vector2(0.8, 0.8) },
         specularPower: { value: this.materialProps.specularPower },
         roughness: { value: this.materialProps.roughness },
         specularIntensity: { value: 0.8 },
         blurSamples: { value: 12 },
         blurMin: { value: 0.0 },
         blurMax: { value: 0.95 },
         blurFalloff: { value: 1.0 },
         fadeAmount: { value: 1.0 },
         noiseAmount: { value: 0.5 },
         gammaAdjust: { value: 1.2 },
         time: { value: 0.0 }
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
         uniform vec2 screenPosition;
         uniform vec2 screenScale;
         uniform float specularPower;
         uniform float roughness;
         uniform float specularIntensity;
         uniform float blurSamples;
         uniform float blurMin;
         uniform float blurMax;
         uniform float blurFalloff;
         uniform float fadeAmount;
         uniform float noiseAmount;
         uniform float gammaAdjust;
         uniform float time;
         varying vec2 vUv;

         // Noise function for grain effect
         float random(vec2 st) {
           return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
         }

         // Simple blur function (fallback for Gaussian blur)
         vec3 simpleBlur(sampler2D tex, vec2 uv, float blurAmount) {
           vec3 result = vec3(0.0);
           float samples = 0.0;

           // Sample in a cross pattern for simplicity
           for (int i = -1; i <= 1; i++) {
             for (int j = -1; j <= 1; j++) {
               vec2 offset = vec2(float(i), float(j)) * blurAmount * 0.01;
               result += texture2D(tex, uv + offset).rgb;
               samples += 1.0;
             }
           }

           return result / samples;
         }

         void main() {
           // Calculate screen coordinates
           vec2 screenCoord = (vUv - screenPosition) / screenScale + 0.5;

           // Only apply specular in bezel areas (outside screen area)
           float inScreenArea = step(0.0, screenCoord.x) * step(screenCoord.x, 1.0) *
                               step(0.0, screenCoord.y) * step(screenCoord.y, 1.0);

           if (inScreenArea > 0.0) {
             // Inside screen area - no specular
             gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
             return;
           }

           // Calculate distance from screen edge for falloff
           vec2 distFromScreen = abs(screenCoord - 0.5) - 0.5;
           float edgeDistance = max(distFromScreen.x, distFromScreen.y);

           // Radial fade calculation
           vec2 radialCoord = (vUv - 0.5) * 2.0; // -1 to 1 range
           float radialFade = 1.0 - smoothstep(0.0, 1.0, length(radialCoord));

           // Combined fade
           float reflectionFalloff = (1.0 - smoothstep(0.0, 0.3, edgeDistance)) * fadeAmount * radialFade;

           // Apply blur if enabled
           vec3 screenColor;
           if (blurSamples > 0.0) {
             float blurAmount = mix(blurMin, blurMax, edgeDistance * blurFalloff);
             screenColor = simpleBlur(screenTexture, clamp(screenCoord, 0.0, 1.0), blurAmount);
           } else {
             screenColor = texture2D(screenTexture, clamp(screenCoord, 0.0, 1.0)).rgb;
           }

           // Apply gamma adjustment
           screenColor = pow(screenColor, vec3(1.0 / gammaAdjust));

           // Calculate specular based on screen brightness
           float luminance = dot(screenColor, vec3(0.299, 0.587, 0.114));
           float specular = pow(luminance, specularPower) * reflectionFalloff * specularIntensity;

           // Apply roughness (more spread out highlights)
           specular *= (1.0 - roughness * 0.5);

           // Add noise/grain effect
           if (noiseAmount > 0.0) {
             float noise = random(vUv + time) * 2.0 - 1.0;
             specular += noise * noiseAmount * reflectionFalloff;
             specular = clamp(specular, 0.0, 1.0);
           }

           gl_FragColor = vec4(vec3(specular), 1.0);
         }
       `,
       transparent: true,
       depthTest: false,
       depthWrite: false
     });

    // Advanced reflection material with multiple reflection types and Fresnel
     this.reflectionMaterial = new THREE.ShaderMaterial({
       uniforms: {
         screenTexture: { value: null },
         screenPosition: { value: new THREE.Vector2(0.5, 0.5) },
         screenScale: { value: new THREE.Vector2(0.8, 0.8) },
         reflectionStrength: { value: this.materialProps.reflectionStrength },
         metallic: { value: this.materialProps.metallic },
         fresnelStrength: { value: this.materialProps.fresnelStrength },
         directAmount: { value: 1.5 },
         diffusedAmount: { value: 0.5 },
         fullscreenGlow: { value: 0.75 },
         gammaAdjust: { value: 1.2 },
         fadeAmount: { value: 1.0 },
         radialFadeWidth: { value: 1.0 },
         radialFadeHeight: { value: 1.0 },
         viewPosition: { value: new THREE.Vector3(0.0, 0.0, 1.0) },
         normalMap: { value: null },
         reflectionMask: { value: null },
         reflectMaskAmount: { value: 0.0 },
         reflectMaskBrightness: { value: 1.0 },
         reflectMaskBlackLevel: { value: 1.0 },
         reflectMaskMipBias: { value: 0.0 },
         cornerFade: { value: 0.1 },
         cornerFadeDistance: { value: 1.0 },
         cornerInnerSpread: { value: 5.0 },
         cornerOuterSpread: { value: 1.6 },
         cornerRotationTop: { value: 0.0 },
         cornerRotationBottom: { value: 0.0 },
         cornerSpreadFalloff: { value: 1.0 }
       },
       vertexShader: `
         varying vec2 vUv;
         varying vec3 vNormal;
         varying vec3 vViewPosition;
         void main() {
           vUv = uv;
           vNormal = normalize(normalMatrix * normal);
           vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
           vViewPosition = -mvPosition.xyz;
           gl_Position = projectionMatrix * mvPosition;
         }
       `,
       fragmentShader: `
         uniform sampler2D screenTexture;
         uniform vec2 screenPosition;
         uniform vec2 screenScale;
         uniform float reflectionStrength;
         varying vec2 vUv;

         void main() {
           // Calculate screen coordinates
           vec2 screenCoord = (vUv - screenPosition) / screenScale + 0.5;

           // Only apply reflections in bezel areas (outside screen area)
           float inScreenArea = step(0.0, screenCoord.x) * step(screenCoord.x, 1.0) *
                               step(0.0, screenCoord.y) * step(screenCoord.y, 1.0);

           if (inScreenArea > 0.0) {
             // Inside screen area - no reflection
             gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
             return;
           }

           // Sample screen content for reflection
           vec2 reflectCoord = clamp(screenCoord, 0.0, 1.0);
           vec3 screenColor = texture2D(screenTexture, reflectCoord).rgb;

           // Calculate distance from screen for reflection intensity falloff
           vec2 distFromScreen = abs(screenCoord - 0.5) - 0.5;
           float edgeDistance = max(distFromScreen.x, distFromScreen.y);

           // Simple reflection falloff
           float reflectionFalloff = 1.0 - smoothstep(0.0, 0.4, edgeDistance);

           // Simple reflection color
           vec3 reflectionColor = screenColor * reflectionFalloff * reflectionStrength;

           gl_FragColor = vec4(reflectionColor, 1.0);
         }
       `,
       transparent: true,
       depthTest: false,
       depthWrite: false
     });

    // Simplified Fresnel effect material for bezel areas
    this.fresnelMaterial = new THREE.ShaderMaterial({
      uniforms: {
        screenPosition: { value: new THREE.Vector2(0.5, 0.5) },
        screenScale: { value: new THREE.Vector2(0.8, 0.8) },
        fresnelStrength: { value: this.materialProps.fresnelStrength },
        fresnelPower: { value: 2.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec2 screenPosition;
        uniform vec2 screenScale;
        uniform float fresnelStrength;
        uniform float fresnelPower;
        varying vec2 vUv;

        void main() {
          // Calculate screen coordinates
          vec2 screenCoord = (vUv - screenPosition) / screenScale + 0.5;

          // Only apply fresnel in bezel areas (outside screen area)
          float inScreenArea = step(0.0, screenCoord.x) * step(screenCoord.x, 1.0) *
                              step(0.0, screenCoord.y) * step(screenCoord.y, 1.0);

          if (inScreenArea > 0.0) {
            // Inside screen area - no fresnel
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          // Calculate distance-based fresnel (simplified)
          vec2 distFromScreen = abs(screenCoord - 0.5) - 0.5;
          float edgeDistance = max(distFromScreen.x, distFromScreen.y);
          float fresnel = 1.0 - smoothstep(0.0, 0.5, edgeDistance);
          fresnel = pow(fresnel, fresnelPower);

          // White fresnel highlight
          vec3 finalColor = vec3(fresnel * fresnelStrength);

          gl_FragColor = vec4(finalColor, 1.0);
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
    * Update material and reflection parameters from Mega Bezel parameters
    */
   private updateReflectionParameters(): void {
     // Update from actual Mega Bezel reflection parameters
     const globalAmount = this.parameterManager.getValue('HSM_REFLECT_GLOBAL_AMOUNT') || 0.4;
     const directAmount = this.parameterManager.getValue('HSM_REFLECT_DIRECT_AMOUNT') || 1.5;
     const diffusedAmount = this.parameterManager.getValue('HSM_REFLECT_DIFFUSED_AMOUNT') || 0.5;
     const fullscreenGlow = this.parameterManager.getValue('HSM_REFLECT_FULLSCREEN_GLOW') || 0.75;
     const gammaAdjust = this.parameterManager.getValue('HSM_REFLECT_GLOBAL_GAMMA_ADJUST') || 1.2;

     // Blur parameters
     const blurSamples = this.parameterManager.getValue('HSM_REFLECT_BLUR_NUM_SAMPLES') || 12;
     const blurMin = this.parameterManager.getValue('HSM_REFLECT_BLUR_MIN') || 0.0;
     const blurMax = this.parameterManager.getValue('HSM_REFLECT_BLUR_MAX') || 0.95;
     const blurFalloff = this.parameterManager.getValue('HSM_REFLECT_BLUR_FALLOFF_DISTANCE') || 1.0;

     // Fade parameters
     const fadeAmount = this.parameterManager.getValue('HSM_REFLECT_FADE_AMOUNT') || 1.0;
     const radialFadeWidth = this.parameterManager.getValue('HSM_REFLECT_RADIAL_FADE_WIDTH') || 1.0;
     const radialFadeHeight = this.parameterManager.getValue('HSM_REFLECT_RADIAL_FADE_HEIGHT') || 1.0;

     // Noise parameters
     const noiseAmount = this.parameterManager.getValue('HSM_REFLECT_NOISE_AMOUNT') || 0.5;
     const noiseSamples = this.parameterManager.getValue('HSM_REFLECT_NOISE_SAMPLES') || 1;

     // Glass preset parameters
     const vignetteAmount = this.parameterManager.getValue('HSM_REFLECT_VIGNETTE_AMOUNT') || 0.0;
     const vignetteSize = this.parameterManager.getValue('HSM_REFLECT_VIGNETTE_SIZE') || 1.0;

     // Reflection mask parameters
     const reflectMaskAmount = this.parameterManager.getValue('HSM_REFLECT_MASK_IMAGE_AMOUNT') || 0.0;
     const reflectMaskBrightness = this.parameterManager.getValue('HSM_REFLECT_MASK_BRIGHTNESS') || 1.0;
     const reflectMaskBlackLevel = this.parameterManager.getValue('HSM_REFLECT_MASK_BLACK_LEVEL') || 1.0;
     const reflectMaskMipBias = this.parameterManager.getValue('HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS') || 0.0;

     // Corner crease parameters
     const cornerFade = this.parameterManager.getValue('HSM_REFLECT_CORNER_FADE') || 0.1;
     const cornerFadeDistance = this.parameterManager.getValue('HSM_REFLECT_CORNER_FADE_DISTANCE') || 1.0;
     const cornerInnerSpread = this.parameterManager.getValue('HSM_REFLECT_CORNER_INNER_SPREAD') || 5.0;
     const cornerOuterSpread = this.parameterManager.getValue('HSM_REFLECT_CORNER_OUTER_SPREAD') || 1.6;
     const cornerRotationTop = this.parameterManager.getValue('HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP') || 0.0;
     const cornerRotationBottom = this.parameterManager.getValue('HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM') || 0.0;
     const cornerSpreadFalloff = this.parameterManager.getValue('HSM_REFLECT_CORNER_SPREAD_FALLOFF') || 1.0;

     // Update material properties
     this.materialProps.roughness = 1.0 - (blurMax - blurMin); // Convert blur to roughness
     this.materialProps.metallic = diffusedAmount / (directAmount + diffusedAmount + 0.001);
     this.materialProps.specularPower = Math.max(1.0, blurSamples * 2.0);
     this.materialProps.fresnelStrength = fullscreenGlow * 0.5;
     this.materialProps.reflectionStrength = globalAmount;

     // Update shader uniforms with Mega Bezel parameters
     this.specularMaterial.uniforms.specularPower.value = this.materialProps.specularPower;
     this.specularMaterial.uniforms.roughness.value = this.materialProps.roughness;

     this.reflectionMaterial.uniforms.reflectionStrength.value = this.materialProps.reflectionStrength;
     this.reflectionMaterial.uniforms.metallic.value = this.materialProps.metallic;

     this.fresnelMaterial.uniforms.fresnelStrength.value = this.materialProps.fresnelStrength;

     // Update specular material uniforms
     this.specularMaterial.uniforms.blurSamples.value = blurSamples;
     this.specularMaterial.uniforms.blurMin.value = blurMin;
     this.specularMaterial.uniforms.blurMax.value = blurMax;
     this.specularMaterial.uniforms.blurFalloff.value = blurFalloff;
     this.specularMaterial.uniforms.fadeAmount.value = fadeAmount;
     this.specularMaterial.uniforms.noiseAmount.value = noiseAmount;
     this.specularMaterial.uniforms.gammaAdjust.value = gammaAdjust;

     // Update reflection material uniforms
     this.reflectionMaterial.uniforms.directAmount.value = directAmount;
     this.reflectionMaterial.uniforms.diffusedAmount.value = diffusedAmount;
     this.reflectionMaterial.uniforms.fullscreenGlow.value = fullscreenGlow;
     this.reflectionMaterial.uniforms.gammaAdjust.value = gammaAdjust;
     this.reflectionMaterial.uniforms.fadeAmount.value = fadeAmount;
     this.reflectionMaterial.uniforms.radialFadeWidth.value = radialFadeWidth;
     this.reflectionMaterial.uniforms.radialFadeHeight.value = radialFadeHeight;

     // Update reflection mask uniforms
     this.reflectionMaterial.uniforms.reflectMaskAmount.value = reflectMaskAmount;
     this.reflectionMaterial.uniforms.reflectMaskBrightness.value = reflectMaskBrightness;
     this.reflectionMaterial.uniforms.reflectMaskBlackLevel.value = reflectMaskBlackLevel;
     this.reflectionMaterial.uniforms.reflectMaskMipBias.value = reflectMaskMipBias;

     // Update corner crease uniforms
     this.reflectionMaterial.uniforms.cornerFade.value = cornerFade;
     this.reflectionMaterial.uniforms.cornerFadeDistance.value = cornerFadeDistance;
     this.reflectionMaterial.uniforms.cornerInnerSpread.value = cornerInnerSpread;
     this.reflectionMaterial.uniforms.cornerOuterSpread.value = cornerOuterSpread;
     this.reflectionMaterial.uniforms.cornerRotationTop.value = cornerRotationTop;
     this.reflectionMaterial.uniforms.cornerRotationBottom.value = cornerRotationBottom;
     this.reflectionMaterial.uniforms.cornerSpreadFalloff.value = cornerSpreadFalloff;
   }

  /**
    * Render specular reflections
    */
   renderSpecular(screenTexture?: THREE.Texture): THREE.WebGLRenderTarget {
     this.updateReflectionParameters();

     // Update time for noise animation
     this.specularMaterial.uniforms.time.value = performance.now() * 0.001;

     // Set material and render specular highlights
     this.quad.material = this.specularMaterial;

     // Update screen texture and positioning
     if (screenTexture) {
       this.specularMaterial.uniforms.screenTexture.value = screenTexture;
     }

     // Get screen placement from parameters (same as BezelCompositionRenderer)
     const screenPosX = this.parameterManager.getValue('HSM_SCREEN_POSITION_X') || 0;
     const screenPosY = this.parameterManager.getValue('HSM_SCREEN_POSITION_Y') || 0;
     const screenScale = this.parameterManager.getValue('HSM_NON_INTEGER_SCALE') || 0.8;

     const screenPosition = [0.5 + screenPosX / 1000, 0.5 + screenPosY / 1000];
     const screenScaleVec = [screenScale, screenScale];

     this.specularMaterial.uniforms.screenPosition.value.set(
       screenPosition[0],
       screenPosition[1]
     );
     this.specularMaterial.uniforms.screenScale.value.set(
       screenScaleVec[0],
       screenScaleVec[1]
     );

     // Update specular intensity based on Mega Bezel parameters
     const globalAmount = this.parameterManager.getValue('HSM_REFLECT_GLOBAL_AMOUNT') || 0.5;
     const bezelInnerEdgeAmount = this.parameterManager.getValue('HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT') || 1.3;
     const frameInnerEdgeAmount = this.parameterManager.getValue('HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT') || 0.5;

     // Calculate specular intensity from Mega Bezel parameters
     const specularIntensity = globalAmount * bezelInnerEdgeAmount * 0.01;
     this.specularMaterial.uniforms.specularIntensity = { value: specularIntensity };

     // Render to specular target
     this.renderer.setRenderTarget(this.specularRenderTarget);
     this.renderer.clear();
     this.renderer.render(this.scene, this.camera);

     return this.specularRenderTarget;
   }

  /**
   * Render environment reflections
   */
  renderReflections(screenTexture?: THREE.Texture): THREE.WebGLRenderTarget {
    this.updateReflectionParameters();

    // Set material and render environment reflections
    this.quad.material = this.reflectionMaterial;

    // Update screen texture and positioning
    if (screenTexture) {
      this.reflectionMaterial.uniforms.screenTexture.value = screenTexture;
    }

    // Get screen placement from parameters (same as BezelCompositionRenderer)
    const screenPosX = this.parameterManager.getValue('HSM_SCREEN_POSITION_X') || 0;
    const screenPosY = this.parameterManager.getValue('HSM_SCREEN_POSITION_Y') || 0;
    const screenScale = this.parameterManager.getValue('HSM_NON_INTEGER_SCALE') || 0.8;

    const screenPosition = [0.5 + screenPosX / 1000, 0.5 + screenPosY / 1000];
    const screenScaleVec = [screenScale, screenScale];

    this.reflectionMaterial.uniforms.screenPosition.value.set(
      screenPosition[0],
      screenPosition[1]
    );
    this.reflectionMaterial.uniforms.screenScale.value.set(
      screenScaleVec[0],
      screenScaleVec[1]
    );

    // Render to reflection target
    this.renderer.setRenderTarget(this.reflectionRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.reflectionRenderTarget;
  }

  /**
   * Render Fresnel effects
   */
  renderFresnel(): THREE.WebGLRenderTarget {
    this.updateReflectionParameters();

    // Set material and render Fresnel effects
    this.quad.material = this.fresnelMaterial;

    // Update screen positioning
    const screenPosX = this.parameterManager.getValue('HSM_SCREEN_POSITION_X') || 0;
    const screenPosY = this.parameterManager.getValue('HSM_SCREEN_POSITION_Y') || 0;
    const screenScale = this.parameterManager.getValue('HSM_NON_INTEGER_SCALE') || 0.8;

    const screenPosition = [0.5 + screenPosX / 1000, 0.5 + screenPosY / 1000];
    const screenScaleVec = [screenScale, screenScale];

    this.fresnelMaterial.uniforms.screenPosition.value.set(
      screenPosition[0],
      screenPosition[1]
    );
    this.fresnelMaterial.uniforms.screenScale.value.set(
      screenScaleVec[0],
      screenScaleVec[1]
    );

    // Render to reflection target (reuse for Fresnel)
    this.renderer.setRenderTarget(this.reflectionRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.reflectionRenderTarget;
  }

  /**
   * Render all reflection effects combined
   */
  renderAllReflections(screenTexture?: THREE.Texture): {
    specular: THREE.WebGLRenderTarget;
    reflections: THREE.WebGLRenderTarget;
    fresnel: THREE.WebGLRenderTarget;
  } {
    const specular = this.renderSpecular(screenTexture);
    const reflections = this.renderReflections(screenTexture);
    const fresnel = this.renderFresnel();

    return { specular, reflections, fresnel };
  }

  /**
   * Get specular texture
   */
  getSpecularTexture(): THREE.Texture {
    return this.specularRenderTarget.texture;
  }

  /**
   * Get reflection texture
   */
  getReflectionTexture(): THREE.Texture {
    return this.reflectionRenderTarget.texture;
  }

  /**
   * Set environment map for reflections
   */
  setEnvironmentMap(texture: THREE.Texture): void {
    this.reflectionParams.environmentMap = texture;
  }

  /**
    * Set normal map for surface detail
    */
   setNormalMap(texture: THREE.Texture): void {
     this.reflectionParams.normalMap = texture;
     this.reflectionMaterial.uniforms.normalMap.value = texture;
   }

  /**
    * Set reflection mask texture
    */
   setReflectionMask(texture: THREE.Texture): void {
     this.reflectionMaterial.uniforms.reflectionMask.value = texture;
   }

  /**
   * Set light direction
   */
  setLightDirection(direction: [number, number, number]): void {
    this.reflectionParams.lightDirection = direction;
  }

  /**
   * Set view position
   */
  setViewPosition(position: [number, number, number]): void {
    this.reflectionParams.viewPosition = position;
  }

  /**
   * Update material properties
   */
  setMaterialProperties(props: Partial<MaterialProperties>): void {
    Object.assign(this.materialProps, props);
    this.reflectionParams.materialProps = this.materialProps;
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    this.reflectionRenderTarget.setSize(width, height);
    this.specularRenderTarget.setSize(width, height);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.reflectionRenderTarget.dispose();
    this.specularRenderTarget.dispose();
    this.specularMaterial.dispose();
    this.reflectionMaterial.dispose();
    this.fresnelMaterial.dispose();
    this.quad.geometry.dispose();
  }

  /**
   * Get current material properties
   */
  getMaterialProperties(): MaterialProperties {
    return { ...this.materialProps };
  }

  /**
   * Get current reflection parameters
   */
  getReflectionParameters(): ReflectionParameters {
    return { ...this.reflectionParams };
  }
}