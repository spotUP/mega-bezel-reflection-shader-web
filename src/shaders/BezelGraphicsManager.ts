/**
 * Bezel Graphics Manager for Mega Bezel
 *
 * Handles loading, caching, and management of bezel graphics assets:
 * - Background textures (carbon fiber, wood grain, etc.)
 * - Frame graphics and overlays
 * - Screen placement masks
 * - LUT textures for color correction
 * - Dynamic texture generation for procedural effects
 */

import * as THREE from 'three';

export interface BezelTexture {
  name: string;
  texture: THREE.Texture;
  wrapMode: 'repeat' | 'clamp' | 'mirrored';
  filterMode: 'linear' | 'nearest';
  mipmap: boolean;
  colorSpace: 'srgb' | 'linear';
}

export interface BezelGraphicsConfig {
  backgroundImage?: string;
  backgroundVertImage?: string;
  screenPlacementImage?: string;
  frameGraphics?: string[];
  lutTextures?: string[];
  proceduralTextures?: ProceduralTextureConfig[];
}

export interface ProceduralTextureConfig {
  name: string;
  type: 'gradient' | 'noise' | 'mask';
  size: [number, number];
  parameters: Record<string, any>;
}

export class BezelGraphicsManager {
  private textures: Map<string, BezelTexture> = new Map();
  private textureLoader: THREE.TextureLoader;
  private loadingPromises: Map<string, Promise<BezelTexture>> = new Map();

  constructor() {
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Load bezel graphics configuration
   */
  async loadBezelGraphics(config: BezelGraphicsConfig): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    // Load background images
    if (config.backgroundImage) {
      loadPromises.push(this.loadTexture(config.backgroundImage, {
        wrapMode: 'repeat',
        filterMode: 'linear',
        mipmap: true,
        colorSpace: 'srgb'
      }));
    }

    if (config.backgroundVertImage) {
      loadPromises.push(this.loadTexture(config.backgroundVertImage, {
        wrapMode: 'repeat',
        filterMode: 'linear',
        mipmap: true,
        colorSpace: 'srgb'
      }));
    }

    // Load screen placement mask
    if (config.screenPlacementImage) {
      loadPromises.push(this.loadTexture(config.screenPlacementImage, {
        wrapMode: 'clamp',
        filterMode: 'nearest',
        mipmap: false,
        colorSpace: 'linear'
      }));
    }

    // Load LUT textures
    if (config.lutTextures) {
      for (const lutPath of config.lutTextures) {
        loadPromises.push(this.loadTexture(lutPath, {
          wrapMode: 'clamp',
          filterMode: 'linear',
          mipmap: false,
          colorSpace: 'linear'
        }));
      }
    }

    // Generate procedural textures
    if (config.proceduralTextures) {
      for (const procConfig of config.proceduralTextures) {
        loadPromises.push(this.generateProceduralTexture(procConfig));
      }
    }

    await Promise.all(loadPromises);
  }

  /**
   * Load a texture with specific settings
   */
  private async loadTexture(
    path: string,
    settings: {
      wrapMode: 'repeat' | 'clamp' | 'mirrored';
      filterMode: 'linear' | 'nearest';
      mipmap: boolean;
      colorSpace: 'srgb' | 'linear';
    }
  ): Promise<void> {
    // Avoid duplicate loading
    if (this.textures.has(path)) {
      return Promise.resolve();
    }
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!.then(() => undefined);
    }

    const loadPromise = new Promise<BezelTexture>((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          // Apply texture settings
          texture.wrapS = this.getWrapMode(settings.wrapMode);
          texture.wrapT = this.getWrapMode(settings.wrapMode);
          texture.minFilter = settings.mipmap
            ? (settings.filterMode === 'linear' ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapNearestFilter)
            : (settings.filterMode === 'linear' ? THREE.LinearFilter : THREE.NearestFilter);
          texture.magFilter = settings.filterMode === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;

          if (settings.mipmap) {
            texture.generateMipmaps = true;
          }

          // Set color space
          texture.colorSpace = settings.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;

          const bezelTexture: BezelTexture = {
            name: path,
            texture,
            wrapMode: settings.wrapMode,
            filterMode: settings.filterMode,
            mipmap: settings.mipmap,
            colorSpace: settings.colorSpace
          };

          this.textures.set(path, bezelTexture);
          resolve(bezelTexture);
        },
        undefined, // onProgress
        (error) => {
          console.error(`Failed to load texture: ${path}`, error);
          reject(error);
        }
      );
    });

    this.loadingPromises.set(path, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(path);
    }
  }

  /**
   * Generate procedural texture
   */
  private async generateProceduralTexture(config: ProceduralTextureConfig): Promise<void> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = config.size[0];
      canvas.height = config.size[1];
      const ctx = canvas.getContext('2d')!;

      // Generate texture based on type
      switch (config.type) {
        case 'gradient':
          this.generateGradientTexture(ctx, config);
          break;
        case 'noise':
          this.generateNoiseTexture(ctx, config);
          break;
        case 'mask':
          this.generateMaskTexture(ctx, config);
          break;
      }

      // Create Three.js texture from canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const bezelTexture: BezelTexture = {
        name: config.name,
        texture,
        wrapMode: 'clamp',
        filterMode: 'linear',
        mipmap: false,
        colorSpace: 'linear'
      };

      this.textures.set(config.name, bezelTexture);
      resolve();
    });
  }

  /**
   * Generate gradient texture
   */
  private generateGradientTexture(ctx: CanvasRenderingContext2D, config: ProceduralTextureConfig): void {
    const gradient = ctx.createLinearGradient(0, 0, config.size[0], config.size[1]);

    const colors = config.parameters.colors || ['#000000', '#ffffff'];
    const stops = config.parameters.stops || [0, 1];

    for (let i = 0; i < colors.length; i++) {
      gradient.addColorStop(stops[i] || i / (colors.length - 1), colors[i]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.size[0], config.size[1]);
  }

  /**
   * Generate noise texture
   */
  private generateNoiseTexture(ctx: CanvasRenderingContext2D, config: ProceduralTextureConfig): void {
    const imageData = ctx.createImageData(config.size[0], config.size[1]);
    const data = imageData.data;

    const scale = config.parameters.scale || 50;
    const seed = config.parameters.seed || 0;

    for (let y = 0; y < config.size[1]; y++) {
      for (let x = 0; x < config.size[0]; x++) {
        const i = (y * config.size[0] + x) * 4;

        // Simple noise function
        const noise = Math.sin(x * 0.01 * scale + seed) * Math.cos(y * 0.01 * scale + seed);
        const value = ((noise + 1) * 0.5) * 255;

        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = 255;   // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Generate mask texture
   */
  private generateMaskTexture(ctx: CanvasRenderingContext2D, config: ProceduralTextureConfig): void {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, config.size[0], config.size[1]);

    // Draw mask shape based on parameters
    const shape = config.parameters.shape || 'circle';
    ctx.fillStyle = '#ffffff';

    switch (shape) {
      case 'circle':
        const centerX = config.size[0] / 2;
        const centerY = config.size[1] / 2;
        const radius = Math.min(centerX, centerY) * (config.parameters.radius || 0.8);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        break;

      case 'rectangle':
        const width = config.size[0] * (config.parameters.width || 0.8);
        const height = config.size[1] * (config.parameters.height || 0.8);
        const x = (config.size[0] - width) / 2;
        const y = (config.size[1] - height) / 2;

        ctx.fillRect(x, y, width, height);
        break;
    }
  }

  /**
   * Get Three.js wrap mode constant
   */
  private getWrapMode(mode: 'repeat' | 'clamp' | 'mirrored'): THREE.Wrapping {
    switch (mode) {
      case 'repeat': return THREE.RepeatWrapping;
      case 'clamp': return THREE.ClampToEdgeWrapping;
      case 'mirrored': return THREE.MirroredRepeatWrapping;
      default: return THREE.ClampToEdgeWrapping;
    }
  }

  /**
   * Get texture by name
   */
  getTexture(name: string): BezelTexture | undefined {
    return this.textures.get(name);
  }

  /**
   * Get all loaded textures
   */
  getAllTextures(): Map<string, BezelTexture> {
    return new Map(this.textures);
  }

  /**
   * Check if texture is loaded
   */
  isTextureLoaded(name: string): boolean {
    return this.textures.has(name);
  }

  /**
    * Get texture for shader uniform
    */
   getTextureForUniform(name: string): THREE.Texture | null {
     const bezelTexture = this.textures.get(name);
     return bezelTexture ? bezelTexture.texture : null;
   }

  /**
    * Get reflection mask texture
    */
   getReflectionMaskTexture(): THREE.Texture | null {
     // Look for reflection mask texture in loaded textures
     // In Mega Bezel, this would typically be named something like "ReflectionMaskImage"
     const reflectionMaskNames = ['ReflectionMaskImage', 'reflection_mask', 'reflect_mask'];
     for (const name of reflectionMaskNames) {
       const texture = this.getTextureForUniform(name);
       if (texture) return texture;
     }
     return null;
   }

  /**
   * Dispose all textures
   */
  dispose(): void {
    for (const texture of this.textures.values()) {
      texture.texture.dispose();
    }
    this.textures.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get loading progress
   */
  getLoadingProgress(): { loaded: number, total: number } {
    const loaded = this.textures.size;
    const total = loaded + this.loadingPromises.size;
    return { loaded, total };
  }

  /**
   * Public method to load a texture with settings
   */
  async loadTextureFromPath(
    path: string,
    settings: {
      wrapMode: 'repeat' | 'clamp' | 'mirrored';
      filterMode: 'linear' | 'nearest';
      mipmap: boolean;
      colorSpace: 'srgb' | 'linear';
    }
  ): Promise<void> {
    return this.loadTexture(path, settings);
  }

  /**
   * Preload common bezel textures
   */
  async preloadCommonTextures(): Promise<void> {
    const commonTextures = [
      'shaders/textures/Placeholder_Transparent_16x16.png',
      'shaders/textures/Baked_Frame_Carbonfiber_Background.png'
    ];

    const loadPromises = commonTextures.map(path =>
      this.loadTexture(path, {
        wrapMode: 'clamp',
        filterMode: 'linear',
        mipmap: true,
        colorSpace: 'srgb'
      })
    );

    await Promise.all(loadPromises);
  }
}