/**
 * Mega Bezel Preset Loader
 *
 * High-level interface for loading and managing Mega Bezel presets.
 * Integrates all components: compiler, renderer, parameters, coordinates, textures.
 */

import * as THREE from 'three';
import { MegaBezelCompiler, MegaBezelPreset } from './MegaBezelCompiler';
import { MultiPassRenderer, RenderContext } from './MultiPassRenderer';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';
import { BezelGraphicsManager } from './BezelGraphicsManager';
import { BezelCompositionRenderer } from './BezelCompositionRenderer';
import { AmbientLightingRenderer } from './AmbientLightingRenderer';
import { SpecularReflectionsRenderer } from './SpecularReflectionsRenderer';
import { TemporalEffectsRenderer } from './TemporalEffectsRenderer';
import { PerformanceManager } from './PerformanceManager';
import { UserInterfaceManager } from './UserInterfaceManager';

export interface MegaBezelOptions {
  webgl2?: boolean;
  debug?: boolean;
  maxPasses?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface PresetLoadResult {
  success: boolean;
  preset?: MegaBezelPreset;
  error?: string;
  stats?: any;
}

export class MegaBezelPresetLoader {
  private compiler: MegaBezelCompiler;
  private multiPassRenderer: MultiPassRenderer | null = null;
  private bezelCompositionRenderer: BezelCompositionRenderer | null = null;
  private ambientLightingRenderer: AmbientLightingRenderer | null = null;
  private specularReflectionsRenderer: SpecularReflectionsRenderer | null = null;
  private temporalEffectsRenderer: TemporalEffectsRenderer | null = null;
  private performanceManager: PerformanceManager | null = null;
  private uiManager: UserInterfaceManager | null = null;
  private currentPreset: MegaBezelPreset | null = null;

  // Core systems
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;
  private bezelGraphics: BezelGraphicsManager;
  private webglRenderer: THREE.WebGLRenderer;

  constructor(webglRenderer: THREE.WebGLRenderer, options: MegaBezelOptions = {}) {
    const opts = {
      webgl2: true,
      debug: false,
      maxPasses: 16,
      viewportWidth: 800,
      viewportHeight: 600,
      ...options
    };

    // Initialize core systems
    this.parameterManager = new ParameterManager();
    this.coordinateSystem = new MegaBezelCoordinateSystem(opts.viewportWidth, opts.viewportHeight);
    this.bezelGraphics = new BezelGraphicsManager();

    // Initialize compiler
    this.compiler = new MegaBezelCompiler();

    // Store WebGL renderer reference
    this.webglRenderer = webglRenderer;

    // Initialize multi-pass renderer
    this.multiPassRenderer = new MultiPassRenderer(
      webglRenderer,
      this.parameterManager,
      this.coordinateSystem,
      this.bezelGraphics
    );

    // Initialize bezel composition renderer
    this.bezelCompositionRenderer = new BezelCompositionRenderer(
      webglRenderer,
      this.coordinateSystem,
      this.parameterManager,
      this.bezelGraphics
    );

    // Initialize ambient lighting renderer
    this.ambientLightingRenderer = new AmbientLightingRenderer(
      webglRenderer,
      this.parameterManager,
      this.coordinateSystem
    );

    // Initialize specular reflections renderer
    this.specularReflectionsRenderer = new SpecularReflectionsRenderer(
      webglRenderer,
      this.parameterManager,
      this.coordinateSystem
    );

    // Initialize temporal effects renderer
    this.temporalEffectsRenderer = new TemporalEffectsRenderer(
      webglRenderer,
      this.parameterManager,
      this.coordinateSystem
    );

    // Initialize performance manager
    this.performanceManager = new PerformanceManager(
      webglRenderer,
      this.parameterManager
    );

    // Initialize UI manager
    this.uiManager = new UserInterfaceManager(
      this.parameterManager,
      this
    );

    // Mega Bezel loader initialized
  }

  /**
   * Load a Mega Bezel preset
   */
  async loadPreset(presetPath: string): Promise<PresetLoadResult> {
    try {
      // Compile preset
      const preset = await this.compiler.compilePreset(presetPath, {
        webgl2: true,
        debug: false,
        maxPasses: 16
      });

      // Load into renderer
      await this.multiPassRenderer!.loadPreset(preset);

      // Load bezel textures for composition
      if (this.bezelCompositionRenderer) {
        await this.bezelCompositionRenderer.loadBezelTextures();
      }

      // Store current preset
      this.currentPreset = preset;

      // Get compilation stats
      const stats = this.compiler.getCompilationStats(preset);

      return {
        success: true,
        preset,
        stats
      };

    } catch (error) {
      console.error('[MegaBezelLoader] Failed to load preset:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Render with current preset
   */
  render(inputTexture: THREE.Texture, outputTarget?: THREE.WebGLRenderTarget): void {
    if (!this.currentPreset || !this.multiPassRenderer || !this.bezelCompositionRenderer ||
        !this.ambientLightingRenderer || !this.specularReflectionsRenderer ||
        !this.temporalEffectsRenderer || !this.performanceManager || !this.uiManager) {
      console.warn('[MegaBezelLoader] No preset loaded, skipping render');
      return;
    }

    // Update performance metrics and quality settings
    this.performanceManager.updatePerformanceMetrics();
    this.performanceManager.updateQualityTransition();

    // Step 1: Render through the multi-pass shader pipeline (CRT effects)
    const context: RenderContext = {
      renderer: this.webglRenderer,
      inputTexture,
      outputTarget: undefined, // Render to internal target first
      frameCount: 0, // Will be managed by renderer
      deltaTime: 1/60 // Assume 60fps
    };

    this.multiPassRenderer.renderPipeline(context);

    // Get the final output from the multi-pass renderer
    const processedTexture = this.multiPassRenderer.getRenderTarget()?.texture;
    if (!processedTexture) {
      console.warn('[MegaBezelLoader] No processed texture from multi-pass renderer');
      return;
    }

    // Step 2: Calculate ambient lighting based on screen content
    this.ambientLightingRenderer!.render(processedTexture);

    // Step 3: Set up reflection textures and calculate specular reflections
    const reflectionMaskTexture = this.bezelGraphics.getReflectionMaskTexture();
    if (reflectionMaskTexture) {
      this.specularReflectionsRenderer!.setReflectionMask(reflectionMaskTexture);
    }

    // Render specular reflections using the SpecularReflectionsRenderer
    this.specularReflectionsRenderer!.renderSpecular(processedTexture);
    this.specularReflectionsRenderer!.renderReflections(processedTexture);

    // Step 4: Composite with bezel graphics, lighting, and reflections
    const lightingTexture = this.ambientLightingRenderer!.getLightingTexture();
    const specularTexture = this.specularReflectionsRenderer!.getSpecularTexture();
    const reflectionTexture = this.specularReflectionsRenderer!.getReflectionTexture();

    this.bezelCompositionRenderer.render(processedTexture, outputTarget, lightingTexture, specularTexture, reflectionTexture);

    // Step 5: Apply temporal effects (motion blur, TAA, frame history)
    if (outputTarget) {
      // If we have an output target, apply temporal effects to the final result
      const finalTexture = outputTarget.texture;
      const temporalResult = this.temporalEffectsRenderer!.renderTemporalEffects(finalTexture);

      // Copy temporal result back to output target
      this.webglRenderer.setRenderTarget(outputTarget);
      // Simple copy shader would be used here, but for now we'll just use the temporal result
      // In a full implementation, we'd need a copy shader
    }
  }

  /**
   * Update parameter value
   */
  updateParameter(name: string, value: number): boolean {
    const success = this.parameterManager.setValue(name, value);

    if (success) {
      // Update renderer with new parameters
      if (this.multiPassRenderer) {
        this.multiPassRenderer.updateParameters({ [name]: value });
      }

      // Update Mega Bezel uniforms in shader materials
      this.updateMegaBezelUniforms(name, value);
    }

    return success;
  }

  /**
   * Update Mega Bezel uniforms in all shader materials
   */
  private updateMegaBezelUniforms(name: string, value: number): void {
    if (!this.currentPreset) return;

    // Update uniforms in all passes
    this.currentPreset.passes.forEach(pass => {
      if (pass.uniforms[name] !== undefined) {
        pass.uniforms[name].value = value;
      }
    });

    // Update specific Mega Bezel uniforms that might have different names
    const uniformMappings: Record<string, string[]> = {
      'HSM_BZL_INNER_CORNER_RADIUS_SCALE': ['HSM_BZL_INNER_CORNER_RADIUS_SCALE'],
      'HSM_GLOBAL_CORNER_RADIUS': ['HSM_GLOBAL_CORNER_RADIUS'],
      'HSM_MONOCHROME_MODE': ['HSM_MONOCHROME_MODE'],
      'HSM_POST_CRT_BRIGHTNESS': ['HSM_POST_CRT_BRIGHTNESS'],
      'HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE': ['HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE'],
      'SCREEN_ASPECT': ['SCREEN_ASPECT'],
      'SCREEN_COORD': ['SCREEN_COORD'],
      'HSM_CRT_CURVATURE_SCALE': ['HSM_CRT_CURVATURE_SCALE'],
      'DEFAULT_SRGB_GAMMA': ['DEFAULT_SRGB_GAMMA'],
      'HSM_BG_OPACITY': ['HSM_BG_OPACITY'],
      'HSM_POTATO_COLORIZE_BRIGHTNESS': ['HSM_POTATO_COLORIZE_BRIGHTNESS'],
      'HSM_BG_BRIGHTNESS': ['HSM_BG_BRIGHTNESS']
    };

    const mappedNames = uniformMappings[name] || [name];
    mappedNames.forEach(mappedName => {
      this.currentPreset!.passes.forEach(pass => {
        if (pass.uniforms[mappedName] !== undefined) {
          pass.uniforms[mappedName].value = value;
        }
      });
    });
  }

  /**
   * Update multiple parameters
   */
  updateParameters(parameters: Record<string, number>): void {
    // First update all parameter manager values
    Object.entries(parameters).forEach(([name, value]) => {
      this.parameterManager.setValue(name, value);
    });

    // Update renderer with new parameters
    if (this.multiPassRenderer) {
      this.multiPassRenderer.updateParameters(parameters);
    }

    // Update Mega Bezel uniforms in shader materials
    Object.entries(parameters).forEach(([name, value]) => {
      this.updateMegaBezelUniforms(name, value);
    });
  }

  /**
   * Load parameter preset
   */
  loadParameterPreset(presetName: string): boolean {
    return this.parameterManager.loadPreset(presetName);
  }

  /**
   * Get current parameter values
   */
  getParameterValues(): Record<string, number> {
    return this.parameterManager.getAllValues();
  }

  /**
   * Get parameter definition
   */
  getParameter(name: string) {
    return this.parameterManager.getParameter(name);
  }

  /**
   * Get parameters by category
   */
  getParametersByCategory(category: string) {
    return this.parameterManager.getParametersByCategory(category as any);
  }

  /**
   * Resize viewport
   */
  resize(width: number, height: number): void {
    this.coordinateSystem.updateViewportSize(width, height);

    if (this.multiPassRenderer) {
      this.multiPassRenderer.resize(width, height);
    }

    if (this.bezelCompositionRenderer) {
      this.bezelCompositionRenderer.resize(width, height);
    }

    if (this.ambientLightingRenderer) {
      this.ambientLightingRenderer.resize(width, height);
    }

    if (this.specularReflectionsRenderer) {
      this.specularReflectionsRenderer.resize(width, height);
    }

    if (this.temporalEffectsRenderer) {
      this.temporalEffectsRenderer.resize(width, height);
    }

    // Performance manager doesn't need resize, but we can update viewport info
    if (this.performanceManager) {
      // Performance manager monitors overall system performance
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): any {
    return this.multiPassRenderer ? this.multiPassRenderer.getPerformanceStats() : null;
  }

  /**
   * Get current preset
   */
  getCurrentPreset(): MegaBezelPreset | null {
    return this.currentPreset;
  }

  /**
   * Check if preset is loaded
   */
  isPresetLoaded(): boolean {
    return this.currentPreset !== null;
  }

  /**
   * Get available parameter presets
   */
  getAvailablePresets(): string[] {
    // This would return preset names from a registry
    // For now, return known presets
    return ['potato'];
  }

  /**
   * Export current parameters as preset
   */
  exportParameterPreset(name: string, description: string): any {
    return this.parameterManager.exportAsPreset(name, description);
  }

  /**
   * Reset all parameters to defaults
   */
  resetParameters(): void {
    this.parameterManager.resetToDefaults();

    if (this.multiPassRenderer) {
      this.multiPassRenderer.updateParameters(this.parameterManager.getAllValues());
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.multiPassRenderer) {
      this.multiPassRenderer.dispose();
    }

    if (this.bezelCompositionRenderer) {
      this.bezelCompositionRenderer.dispose();
    }

    if (this.ambientLightingRenderer) {
      this.ambientLightingRenderer.dispose();
    }

    if (this.specularReflectionsRenderer) {
      this.specularReflectionsRenderer.dispose();
    }

    if (this.temporalEffectsRenderer) {
      this.temporalEffectsRenderer.dispose();
    }

    if (this.uiManager) {
      this.uiManager.dispose();
    }

    this.bezelGraphics.dispose();
    this.currentPreset = null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceManager?.getPerformanceMetrics();
  }

  /**
   * Get performance history
   */
  getPerformanceHistory() {
    return this.performanceManager?.getPerformanceHistory();
  }

  /**
   * Set quality preset
   */
  setQualityPreset(preset: 'low' | 'medium' | 'high' | 'ultra'): void {
    this.performanceManager?.setQualityPreset(preset);
  }

  /**
   * Get current quality settings
   */
  getCurrentQuality() {
    return this.performanceManager?.getCurrentQuality();
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    return this.performanceManager?.getPerformanceRecommendations() || [];
  }

  /**
   * Enable/disable adaptive quality
   */
  setAdaptiveQuality(enabled: boolean): void {
    this.performanceManager?.setAdaptiveQuality(enabled);
  }

  /**
   * Force quality update (bypass cooldown)
   */
  forceQualityUpdate(): void {
    this.performanceManager?.forceQualityUpdate();
  }

  /**
   * Create and show the user interface
   */
  createUI(): void {
    this.uiManager?.createUI();
  }

  /**
   * Toggle UI visibility
   */
  toggleUI(): void {
    this.uiManager?.toggleUI();
  }

  /**
   * Toggle dashboard visibility
   */
  toggleDashboard(): void {
    this.uiManager?.toggleDashboard();
  }

  /**
   * Toggle preset panel visibility
   */
  togglePresetPanel(): void {
    this.uiManager?.togglePresetPanel();
  }

  /**
   * Get UI state
   */
  getUIState(): any {
    return this.uiManager?.getUIState();
  }

  /**
   * Get system information
   */
  getSystemInfo(): any {
    const performanceInfo = this.performanceManager?.getSystemInfo();

    return {
      renderer: {
        info: this.webglRenderer.info,
        capabilities: this.webglRenderer.capabilities
      },
      parameters: {
        total: this.parameterManager.getAllParameterNames().length,
        categories: {
          screen_layout: this.parameterManager.getParametersByCategory('screen_layout').length,
          crt_effects: this.parameterManager.getParametersByCategory('crt_effects').length,
          color_grading: this.parameterManager.getParametersByCategory('color_grading').length,
          bezel_settings: this.parameterManager.getParametersByCategory('bezel_settings').length,
          advanced_effects: this.parameterManager.getParametersByCategory('advanced_effects').length,
          performance: this.parameterManager.getParametersByCategory('performance').length
        }
      },
      textures: {
        loaded: this.bezelGraphics.getAllTextures().size,
        loading: this.bezelGraphics.getLoadingProgress()
      },
      preset: this.currentPreset ? {
        name: this.currentPreset.name,
        passes: this.currentPreset.passes.length,
        parameters: Object.keys(this.currentPreset.parameters).length
      } : null,
      performance: performanceInfo
    };
  }
}