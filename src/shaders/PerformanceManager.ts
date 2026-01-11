/**
 * Performance Manager for Mega Bezel
 *
 * Handles performance optimization, quality scaling, and adaptive rendering:
 * - Real-time performance monitoring and profiling
 * - Quality scaling based on performance metrics
 * - Adaptive rendering based on system capabilities
 * - Memory management and resource optimization
 * - GPU performance tracking and optimization
 * - Dynamic quality adjustment for consistent frame rates
 */

import * as THREE from 'three';
import { ParameterManager } from './ParameterManager';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  gpuMemoryUsage: number;
  drawCalls: number;
  triangles: number;
  shaderSwitches: number;
  textureUploads: number;
}

export interface QualitySettings {
  motionBlurSamples: number;
  taaEnabled: boolean;
  lightingQuality: 'low' | 'medium' | 'high' | 'ultra';
  reflectionQuality: 'off' | 'low' | 'medium' | 'high';
  shadowQuality: 'off' | 'low' | 'medium' | 'high';
  textureResolution: number; // 0.25, 0.5, 1.0, etc.
  renderScale: number; // 0.5, 0.75, 1.0, etc.
  maxPasses: number;
}

export interface PerformanceThresholds {
  targetFps: number;
  minFps: number;
  maxFrameTime: number;
  gpuMemoryLimit: number;
  adaptiveQuality: boolean;
}

export class PerformanceManager {
  private renderer: THREE.WebGLRenderer;
  private parameterManager: ParameterManager;

  // Performance tracking
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameTimes: number[] = [];
  private maxFrameHistory: number = 60; // Track last 60 frames

  // Quality scaling
  private currentQuality: QualitySettings;
  private targetQuality: QualitySettings;
  private qualityTransitionSpeed: number = 0.1;

  // Performance thresholds
  private thresholds: PerformanceThresholds;

  // GPU info
  private gpuInfo: any = null;
  private extensions: string[] = [];

  // Adaptive quality control
  private adaptiveEnabled: boolean = true;
  private qualityAdjustmentCooldown: number = 0;
  private lastQualityAdjustment: number = 0;

  // Performance history for trend analysis
  private fpsHistory: number[] = [];
  private frameTimeHistory: number[] = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager: ParameterManager
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager;

    this.initializeQualitySettings();
    this.initializePerformanceThresholds();
    this.detectGPUCapabilities();
    this.initializePerformanceTracking();
  }

  /**
   * Initialize default quality settings
   */
  private initializeQualitySettings(): void {
    this.currentQuality = {
      motionBlurSamples: 8,
      taaEnabled: true,
      lightingQuality: 'high',
      reflectionQuality: 'medium',
      shadowQuality: 'medium',
      textureResolution: 1.0,
      renderScale: 1.0,
      maxPasses: 16
    };

    this.targetQuality = { ...this.currentQuality };
  }

  /**
   * Initialize performance thresholds
   */
  private initializePerformanceThresholds(): void {
    this.thresholds = {
      targetFps: 60,
      minFps: 30,
      maxFrameTime: 1000 / 30, // 33.3ms for 30fps
      gpuMemoryLimit: 512 * 1024 * 1024, // 512MB
      adaptiveQuality: true
    };
  }

  /**
   * Detect GPU capabilities and extensions
   */
  private detectGPUCapabilities(): void {
    const gl = this.renderer.getContext();

    // Get GPU info
    this.gpuInfo = {
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      extensions: gl.getSupportedExtensions() || []
    };

    this.extensions = this.gpuInfo.extensions;

    console.log('[PerformanceManager] GPU Info:', this.gpuInfo);

    // Adjust quality based on GPU capabilities
    this.adjustQualityForGPUCapabilities();
  }

  /**
   * Adjust quality settings based on detected GPU capabilities
   */
  private adjustQualityForGPUCapabilities(): void {
    const gpuName = this.gpuInfo.renderer.toLowerCase();

    // Integrated graphics (lower quality)
    if (gpuName.includes('intel') && gpuName.includes('hd graphics')) {
      this.targetQuality.lightingQuality = 'medium';
      this.targetQuality.reflectionQuality = 'low';
      this.targetQuality.motionBlurSamples = 4;
      this.targetQuality.renderScale = 0.75;
    }
    // Mobile GPUs (medium quality)
    else if (gpuName.includes('mali') || gpuName.includes('adreno')) {
      this.targetQuality.lightingQuality = 'medium';
      this.targetQuality.reflectionQuality = 'low';
      this.targetQuality.motionBlurSamples = 6;
      this.targetQuality.renderScale = 0.875;
    }
    // Discrete GPUs (high quality)
    else if (gpuName.includes('nvidia') || gpuName.includes('radeon') || gpuName.includes('geforce')) {
      this.targetQuality.lightingQuality = 'ultra';
      this.targetQuality.reflectionQuality = 'high';
      this.targetQuality.motionBlurSamples = 12;
      this.targetQuality.renderScale = 1.0;
    }

    // Check for advanced extensions
    const hasFloatTextures = this.extensions.includes('OES_texture_float') ||
                            this.extensions.includes('EXT_color_buffer_float');
    const hasHalfFloatTextures = this.extensions.includes('OES_texture_half_float') ||
                                this.extensions.includes('EXT_color_buffer_half_float');

    if (!hasFloatTextures) {
      // Reduce quality if float textures not supported
      this.targetQuality.lightingQuality = 'medium';
      this.targetQuality.reflectionQuality = 'low';
    }

    console.log('[PerformanceManager] Adjusted quality for GPU:', this.targetQuality);
  }

  /**
   * Initialize performance tracking
   */
  private initializePerformanceTracking(): void {
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    this.fpsHistory = [];
    this.frameTimeHistory = [];
  }

  /**
   * Update performance metrics (call this every frame)
   */
  updatePerformanceMetrics(): PerformanceMetrics {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update frame time history
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxFrameHistory) {
      this.frameTimes.shift();
    }

    // Calculate FPS
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = 1000 / avgFrameTime;

    // Update FPS history
    this.fpsHistory.push(fps);
    this.frameTimeHistory.push(frameTime);

    if (this.fpsHistory.length > this.maxFrameHistory) {
      this.fpsHistory.shift();
      this.frameTimeHistory.shift();
    }

    // Get GPU memory info (approximate)
    const gpuMemoryUsage = this.estimateGPUMemoryUsage();

    // Get renderer info
    const info = this.renderer.info;

    const metrics: PerformanceMetrics = {
      fps: Math.round(fps * 100) / 100,
      frameTime: Math.round(frameTime * 100) / 100,
      gpuMemoryUsage,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      shaderSwitches: info.render.calls, // Approximation
      textureUploads: info.memory.textures
    };

    // Adaptive quality adjustment
    if (this.adaptiveEnabled) {
      this.updateAdaptiveQuality(metrics);
    }

    this.frameCount++;
    return metrics;
  }

  /**
   * Estimate GPU memory usage
   */
  private estimateGPUMemoryUsage(): number {
    const info = this.renderer.info;
    let memoryUsage = 0;

    // Estimate texture memory (rough approximation)
    memoryUsage += info.memory.textures * 4 * 1024 * 1024; // Assume 4MB per texture

    // Estimate geometry memory
    memoryUsage += info.memory.geometries * 1024 * 1024; // Assume 1MB per geometry

    // Estimate render target memory
    // This is a rough estimate - in practice we'd need more detailed tracking
    memoryUsage += 50 * 1024 * 1024; // Assume 50MB for render targets

    return memoryUsage;
  }

  /**
   * Update adaptive quality based on performance metrics
   */
  private updateAdaptiveQuality(metrics: PerformanceMetrics): void {
    const now = performance.now();

    // Cooldown to prevent rapid quality changes
    if (now - this.lastQualityAdjustment < 2000) { // 2 second cooldown
      return;
    }

    let qualityChanged = false;

    // Check FPS thresholds
    if (metrics.fps < this.thresholds.minFps) {
      // Performance is too low, reduce quality
      qualityChanged = this.reduceQuality();
    } else if (metrics.fps > this.thresholds.targetFps + 5) {
      // Performance is good, try to increase quality
      qualityChanged = this.increaseQuality();
    }

    // Check frame time
    if (metrics.frameTime > this.thresholds.maxFrameTime) {
      qualityChanged = this.reduceQuality() || qualityChanged;
    }

    // Check GPU memory
    if (metrics.gpuMemoryUsage > this.thresholds.gpuMemoryLimit) {
      qualityChanged = this.reduceQuality() || qualityChanged;
    }

    if (qualityChanged) {
      this.lastQualityAdjustment = now;
      this.applyQualitySettings();
    }
  }

  /**
   * Reduce quality settings to improve performance
   */
  private reduceQuality(): boolean {
    let changed = false;

    // Reduce motion blur samples
    if (this.targetQuality.motionBlurSamples > 4) {
      this.targetQuality.motionBlurSamples = Math.max(4, this.targetQuality.motionBlurSamples - 2);
      changed = true;
    }

    // Reduce lighting quality
    if (this.targetQuality.lightingQuality === 'ultra') {
      this.targetQuality.lightingQuality = 'high';
      changed = true;
    } else if (this.targetQuality.lightingQuality === 'high') {
      this.targetQuality.lightingQuality = 'medium';
      changed = true;
    }

    // Reduce reflection quality
    if (this.targetQuality.reflectionQuality === 'high') {
      this.targetQuality.reflectionQuality = 'medium';
      changed = true;
    } else if (this.targetQuality.reflectionQuality === 'medium') {
      this.targetQuality.reflectionQuality = 'low';
      changed = true;
    }

    // Reduce render scale
    if (this.targetQuality.renderScale > 0.75) {
      this.targetQuality.renderScale = Math.max(0.75, this.targetQuality.renderScale - 0.125);
      changed = true;
    }

    // Reduce max passes
    if (this.targetQuality.maxPasses > 8) {
      this.targetQuality.maxPasses = Math.max(8, this.targetQuality.maxPasses - 2);
      changed = true;
    }

    if (changed) {
      console.log('[PerformanceManager] Reduced quality to:', this.targetQuality);
    }

    return changed;
  }

  /**
   * Increase quality settings when performance allows
   */
  private increaseQuality(): boolean {
    let changed = false;

    // Increase motion blur samples
    if (this.targetQuality.motionBlurSamples < 12) {
      this.targetQuality.motionBlurSamples = Math.min(12, this.targetQuality.motionBlurSamples + 1);
      changed = true;
    }

    // Increase lighting quality
    if (this.targetQuality.lightingQuality === 'medium') {
      this.targetQuality.lightingQuality = 'high';
      changed = true;
    } else if (this.targetQuality.lightingQuality === 'high') {
      this.targetQuality.lightingQuality = 'ultra';
      changed = true;
    }

    // Increase reflection quality
    if (this.targetQuality.reflectionQuality === 'low') {
      this.targetQuality.reflectionQuality = 'medium';
      changed = true;
    } else if (this.targetQuality.reflectionQuality === 'medium') {
      this.targetQuality.reflectionQuality = 'high';
      changed = true;
    }

    // Increase render scale
    if (this.targetQuality.renderScale < 1.0) {
      this.targetQuality.renderScale = Math.min(1.0, this.targetQuality.renderScale + 0.0625);
      changed = true;
    }

    if (changed) {
      console.log('[PerformanceManager] Increased quality to:', this.targetQuality);
    }

    return changed;
  }

  /**
   * Apply current quality settings to the rendering systems
   */
  private applyQualitySettings(): void {
    // Update parameter manager with quality settings
    this.parameterManager.setValue('HSM_MOTION_BLUR_SAMPLES', this.currentQuality.motionBlurSamples);
    this.parameterManager.setValue('HSM_TAA_ENABLED', this.currentQuality.taaEnabled ? 1 : 0);
    this.parameterManager.setValue('HSM_RENDER_SCALE', this.currentQuality.renderScale);

    // Quality-based parameter adjustments
    switch (this.currentQuality.lightingQuality) {
      case 'low':
        this.parameterManager.setValue('HSM_AMBIENT_LIGHTING_OPACITY', 0.3);
        break;
      case 'medium':
        this.parameterManager.setValue('HSM_AMBIENT_LIGHTING_OPACITY', 0.6);
        break;
      case 'high':
        this.parameterManager.setValue('HSM_AMBIENT_LIGHTING_OPACITY', 0.8);
        break;
      case 'ultra':
        this.parameterManager.setValue('HSM_AMBIENT_LIGHTING_OPACITY', 1.0);
        break;
    }

    switch (this.currentQuality.reflectionQuality) {
      case 'off':
        this.parameterManager.setValue('HSM_BEZEL_REFLECTION_STRENGTH', 0);
        break;
      case 'low':
        this.parameterManager.setValue('HSM_BEZEL_REFLECTION_STRENGTH', 0.2);
        break;
      case 'medium':
        this.parameterManager.setValue('HSM_BEZEL_REFLECTION_STRENGTH', 0.5);
        break;
      case 'high':
        this.parameterManager.setValue('HSM_BEZEL_REFLECTION_STRENGTH', 0.8);
        break;
    }
  }

  /**
   * Smoothly transition current quality towards target quality
   */
  updateQualityTransition(): void {
    let changed = false;

    // Smooth transition for numeric values
    const numericKeys = ['motionBlurSamples', 'textureResolution', 'renderScale', 'maxPasses'] as const;

    for (const key of numericKeys) {
      const current = this.currentQuality[key] as number;
      const target = this.targetQuality[key] as number;

      if (Math.abs(current - target) > 0.01) {
        (this.currentQuality as any)[key] = current + (target - current) * this.qualityTransitionSpeed;
        changed = true;
      } else {
        (this.currentQuality as any)[key] = target;
      }
    }

    // Instant transition for boolean/enum values
    if (this.currentQuality.taaEnabled !== this.targetQuality.taaEnabled) {
      this.currentQuality.taaEnabled = this.targetQuality.taaEnabled;
      changed = true;
    }

    if (this.currentQuality.lightingQuality !== this.targetQuality.lightingQuality) {
      this.currentQuality.lightingQuality = this.targetQuality.lightingQuality;
      changed = true;
    }

    if (this.currentQuality.reflectionQuality !== this.targetQuality.reflectionQuality) {
      this.currentQuality.reflectionQuality = this.targetQuality.reflectionQuality;
      changed = true;
    }

    if (this.currentQuality.shadowQuality !== this.targetQuality.shadowQuality) {
      this.currentQuality.shadowQuality = this.targetQuality.shadowQuality;
      changed = true;
    }

    if (changed) {
      this.applyQualitySettings();
    }
  }

  /**
   * Set target quality preset
   */
  setQualityPreset(preset: 'low' | 'medium' | 'high' | 'ultra'): void {
    switch (preset) {
      case 'low':
        this.targetQuality = {
          motionBlurSamples: 4,
          taaEnabled: false,
          lightingQuality: 'low',
          reflectionQuality: 'off',
          shadowQuality: 'off',
          textureResolution: 0.5,
          renderScale: 0.75,
          maxPasses: 8
        };
        break;

      case 'medium':
        this.targetQuality = {
          motionBlurSamples: 6,
          taaEnabled: true,
          lightingQuality: 'medium',
          reflectionQuality: 'low',
          shadowQuality: 'low',
          textureResolution: 0.75,
          renderScale: 0.875,
          maxPasses: 12
        };
        break;

      case 'high':
        this.targetQuality = {
          motionBlurSamples: 8,
          taaEnabled: true,
          lightingQuality: 'high',
          reflectionQuality: 'medium',
          shadowQuality: 'medium',
          textureResolution: 1.0,
          renderScale: 1.0,
          maxPasses: 16
        };
        break;

      case 'ultra':
        this.targetQuality = {
          motionBlurSamples: 12,
          taaEnabled: true,
          lightingQuality: 'ultra',
          reflectionQuality: 'high',
          shadowQuality: 'high',
          textureResolution: 1.0,
          renderScale: 1.0,
          maxPasses: 20
        };
        break;
    }

    console.log(`[PerformanceManager] Set quality preset to ${preset}:`, this.targetQuality);
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length);
    const fps = 1000 / avgFrameTime;

    return {
      fps: Math.round(fps * 100) / 100,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      gpuMemoryUsage: this.estimateGPUMemoryUsage(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      shaderSwitches: this.renderer.info.render.calls,
      textureUploads: this.renderer.info.memory.textures
    };
  }

  /**
   * Get current quality settings
   */
  getCurrentQuality(): QualitySettings {
    return { ...this.currentQuality };
  }

  /**
   * Get target quality settings
   */
  getTargetQuality(): QualitySettings {
    return { ...this.targetQuality };
  }

  /**
   * Get GPU information
   */
  getGPUInfo(): any {
    return { ...this.gpuInfo };
  }

  /**
   * Get performance history
   */
  getPerformanceHistory(): { fps: number[]; frameTime: number[] } {
    return {
      fps: [...this.fpsHistory],
      frameTime: [...this.frameTimeHistory]
    };
  }

  /**
   * Enable/disable adaptive quality
   */
  setAdaptiveQuality(enabled: boolean): void {
    this.adaptiveEnabled = enabled;
    console.log(`[PerformanceManager] Adaptive quality ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set performance thresholds
   */
  setPerformanceThresholds(thresholds: Partial<PerformanceThresholds>): void {
    Object.assign(this.thresholds, thresholds);
    console.log('[PerformanceManager] Updated performance thresholds:', this.thresholds);
  }

  /**
   * Force quality update (bypass cooldown)
   */
  forceQualityUpdate(): void {
    this.lastQualityAdjustment = 0;
    this.updateAdaptiveQuality(this.getPerformanceMetrics());
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getPerformanceMetrics();

    if (metrics.fps < this.thresholds.minFps) {
      recommendations.push(`FPS is below minimum threshold (${metrics.fps} < ${this.thresholds.minFps}). Consider reducing quality settings.`);
    }

    if (metrics.frameTime > this.thresholds.maxFrameTime) {
      recommendations.push(`Frame time is too high (${metrics.frameTime}ms > ${this.thresholds.maxFrameTime}ms). Performance optimization needed.`);
    }

    if (metrics.gpuMemoryUsage > this.thresholds.gpuMemoryLimit) {
      recommendations.push(`GPU memory usage is high (${Math.round(metrics.gpuMemoryUsage / 1024 / 1024)}MB). Consider reducing texture resolutions.`);
    }

    if (metrics.drawCalls > 100) {
      recommendations.push(`High number of draw calls (${metrics.drawCalls}). Consider batching or reducing complexity.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is good. All metrics within acceptable ranges.');
    }

    return recommendations;
  }

  /**
   * Reset performance tracking
   */
  resetPerformanceTracking(): void {
    this.initializePerformanceTracking();
    console.log('[PerformanceManager] Performance tracking reset');
  }

  /**
   * Get detailed system information
   */
  getSystemInfo(): any {
    return {
      gpu: this.getGPUInfo(),
      performance: this.getPerformanceMetrics(),
      quality: this.getCurrentQuality(),
      thresholds: this.thresholds,
      adaptiveEnabled: this.adaptiveEnabled,
      recommendations: this.getPerformanceRecommendations()
    };
  }
}