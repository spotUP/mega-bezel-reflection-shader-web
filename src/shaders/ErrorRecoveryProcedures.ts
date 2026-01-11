/**
 * Error Recovery Procedures
 *
 * Systematic recovery from shader failures with automatic fallback to simpler shader presets,
 * clear instructions for manual fixes, backup shader configurations, and graceful degradation options.
 */

import * as THREE from 'three';
import { MegaBezelPresetLoader, MegaBezelOptions } from './MegaBezelPresetLoader';
import { ShaderDiagnosticTool, DiagnosticResult, ShaderError } from './ShaderDiagnosticTool';
import { LoopPreventionSystem } from './LoopPreventionSystem';

export interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher = try first
  applicableErrors: string[]; // Error types this strategy handles
  requiresUserIntervention: boolean;
  automaticRecovery: boolean;
  estimatedRecoveryTime: number; // seconds
}

export interface RecoveryAttempt {
  id: string;
  timestamp: number;
  originalError: ShaderError;
  strategy: RecoveryStrategy;
  success: boolean;
  recoveredShader?: string;
  fallbackUsed?: string;
  userInterventionRequired: boolean;
  recoveryTime: number;
  notes?: string;
}

export interface FallbackPreset {
  name: string;
  path: string;
  description: string;
  complexity: 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
  features: string[];
  performance: number; // 0-1, higher = better performance
  quality: number; // 0-1, higher = better quality
}

export interface RecoveryOptions {
  enableAutomaticFallback: boolean;
  maxRecoveryAttempts: number;
  fallbackTimeout: number;
  preserveUserSettings: boolean;
  notifyUserOnFallback: boolean;
}

export class ErrorRecoveryProcedures {
  private presetLoader: MegaBezelPresetLoader;
  private diagnosticTool: ShaderDiagnosticTool;
  private loopPrevention: LoopPreventionSystem;
  private webglRenderer: THREE.WebGLRenderer;

  private recoveryHistory: RecoveryAttempt[] = [];
  private currentRecoverySession: string | null = null;

  private options: RecoveryOptions;

  // Fallback shader presets in order of preference (simplest to most complex)
  private fallbackPresets: FallbackPreset[] = [
    {
      name: 'passthrough',
      path: '/shaders/passthrough.slangp',
      description: 'Minimal passthrough shader - no effects',
      complexity: 'minimal',
      features: ['basic'],
      performance: 1.0,
      quality: 0.1
    },
    {
      name: 'crt-minimal',
      path: '/shaders/crt-minimal.slangp',
      description: 'Basic CRT scanlines only',
      complexity: 'low',
      features: ['scanlines'],
      performance: 0.9,
      quality: 0.3
    },
    {
      name: 'crt-simple',
      path: '/shaders/crt-simple.slangp',
      description: 'Simple CRT with basic color and geometry',
      complexity: 'medium',
      features: ['scanlines', 'color', 'geometry'],
      performance: 0.7,
      quality: 0.5
    },
    {
      name: 'potato',
      path: '/shaders/mega-bezel/potato.slangp',
      description: 'Mega Bezel potato preset - balanced performance/quality',
      complexity: 'high',
      features: ['bezel', 'crt', 'color', 'geometry', 'lighting'],
      performance: 0.5,
      quality: 0.8
    }
  ];

  // Recovery strategies
  private recoveryStrategies: RecoveryStrategy[] = [
    {
      id: 'automatic_fallback',
      name: 'Automatic Fallback',
      description: 'Automatically switch to a simpler shader preset',
      priority: 10,
      applicableErrors: ['linking', 'validation', 'syntax'],
      requiresUserIntervention: false,
      automaticRecovery: true,
      estimatedRecoveryTime: 5
    },
    {
      id: 'precision_qualifiers',
      name: 'Add Precision Qualifiers',
      description: 'Add missing precision qualifiers to fragment shaders',
      priority: 9,
      applicableErrors: ['syntax'],
      requiresUserIntervention: false,
      automaticRecovery: true,
      estimatedRecoveryTime: 2
    },
    {
      id: 'webgl_compatibility',
      name: 'WebGL Compatibility Mode',
      description: 'Convert WebGL 2.0 features to WebGL 1.0 compatible syntax',
      priority: 8,
      applicableErrors: ['compatibility'],
      requiresUserIntervention: false,
      automaticRecovery: true,
      estimatedRecoveryTime: 3
    },
    {
      id: 'stub_functions',
      name: 'Add Stub Functions',
      description: 'Add stub implementations for missing functions',
      priority: 7,
      applicableErrors: ['linking'],
      requiresUserIntervention: false,
      automaticRecovery: true,
      estimatedRecoveryTime: 2
    },
    {
      id: 'parameter_reset',
      name: 'Reset Parameters',
      description: 'Reset shader parameters to default values',
      priority: 6,
      applicableErrors: ['validation'],
      requiresUserIntervention: false,
      automaticRecovery: true,
      estimatedRecoveryTime: 1
    },
    {
      id: 'manual_fix_required',
      name: 'Manual Fix Required',
      description: 'Error requires manual code changes',
      priority: 1,
      applicableErrors: ['redefinition', 'missing_dependency'],
      requiresUserIntervention: true,
      automaticRecovery: false,
      estimatedRecoveryTime: 300 // 5 minutes
    }
  ];

  constructor(
    webglRenderer: THREE.WebGLRenderer,
    presetLoader: MegaBezelPresetLoader,
    options: Partial<RecoveryOptions> = {}
  ) {
    this.webglRenderer = webglRenderer;
    this.presetLoader = presetLoader;
    this.diagnosticTool = new ShaderDiagnosticTool();
    this.loopPrevention = new LoopPreventionSystem();

    this.options = {
      enableAutomaticFallback: true,
      maxRecoveryAttempts: 3,
      fallbackTimeout: 10000,
      preserveUserSettings: true,
      notifyUserOnFallback: true,
      ...options
    };
  }

  /**
   * Attempt to recover from a shader error
   */
  async attemptRecovery(
    shaderPath: string,
    diagnosticResult: DiagnosticResult,
    context?: {
      currentPreset?: string;
      userParameters?: Record<string, number>;
      performanceMode?: string;
    }
  ): Promise<{
    success: boolean;
    recovered: boolean;
    recoveryAttempt?: RecoveryAttempt;
    fallbackPreset?: string;
    instructions?: string[];
  }> {
    const sessionId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentRecoverySession = sessionId;

    console.log(`[ErrorRecovery] Starting recovery session ${sessionId} for ${shaderPath}`);

    // Find the most severe error
    const primaryError = this.findPrimaryError(diagnosticResult.errors);
    if (!primaryError) {
      console.log(`[ErrorRecovery] No errors found, no recovery needed`);
      return { success: true, recovered: false };
    }

    // Check if we're in a loop
    const loopResult = this.loopPrevention.detectLoop(shaderPath, diagnosticResult.errors);
    if (loopResult.isLoop && loopResult.escalationRecommended) {
      console.warn(`[ErrorRecovery] Loop detected, escalating to fallback`);
      return this.performAutomaticFallback(primaryError, context);
    }

    // Try recovery strategies in priority order
    for (const strategy of this.recoveryStrategies) {
      if (strategy.applicableErrors.includes(primaryError.type)) {
        console.log(`[ErrorRecovery] Attempting strategy: ${strategy.name}`);

        const attempt: RecoveryAttempt = {
          id: `${sessionId}_${strategy.id}`,
          timestamp: Date.now(),
          originalError: primaryError,
          strategy,
          success: false,
          userInterventionRequired: strategy.requiresUserIntervention,
          recoveryTime: 0,
          notes: `Attempted ${strategy.name} for ${primaryError.type} error`
        };

        const startTime = Date.now();

        try {
          if (strategy.automaticRecovery) {
            const result = await this.executeAutomaticRecovery(strategy, primaryError, context);
            attempt.success = result.success;
            attempt.recoveredShader = result.recoveredShader;
            attempt.fallbackUsed = result.fallbackUsed;
          }

          attempt.recoveryTime = Date.now() - startTime;
          this.recoveryHistory.push(attempt);

          if (attempt.success) {
            console.log(`[ErrorRecovery] Recovery successful using ${strategy.name}`);
            return {
              success: true,
              recovered: true,
              recoveryAttempt: attempt
            };
          }

        } catch (error) {
          console.error(`[ErrorRecovery] Strategy ${strategy.name} failed:`, error);
          attempt.recoveryTime = Date.now() - startTime;
          attempt.notes = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.recoveryHistory.push(attempt);
        }

        // Don't try more strategies if this one requires user intervention
        if (strategy.requiresUserIntervention) {
          break;
        }
      }
    }

    // If all strategies failed, perform automatic fallback
    if (this.options.enableAutomaticFallback) {
      console.log(`[ErrorRecovery] All strategies failed, performing automatic fallback`);
      return this.performAutomaticFallback(primaryError, context);
    }

    // Recovery failed completely
    console.error(`[ErrorRecovery] Recovery failed for ${shaderPath}`);
    return {
      success: false,
      recovered: false,
      instructions: this.generateManualFixInstructions(primaryError)
    };
  }

  /**
   * Perform automatic fallback to a simpler preset
   */
  private async performAutomaticFallback(
    error: ShaderError,
    context?: any
  ): Promise<{
    success: boolean;
    recovered: boolean;
    recoveryAttempt?: RecoveryAttempt;
    fallbackPreset?: string;
  }> {
    // Find the best fallback preset based on current context
    const fallbackPreset = this.selectFallbackPreset(context);

    if (!fallbackPreset) {
      console.error(`[ErrorRecovery] No suitable fallback preset found`);
      return { success: false, recovered: false };
    }

    console.log(`[ErrorRecovery] Attempting fallback to: ${fallbackPreset.name}`);

    try {
      // Try to load the fallback preset
      const loadResult = await this.presetLoader.loadPreset(fallbackPreset.path);

      if (loadResult.success) {
        // Restore user parameters if requested
        if (this.options.preserveUserSettings && context?.userParameters) {
          this.presetLoader.updateParameters(context.userParameters);
        }

        // Notify user if requested
        if (this.options.notifyUserOnFallback) {
          this.notifyUserOfFallback(fallbackPreset, error);
        }

        const attempt: RecoveryAttempt = {
          id: `fallback_${Date.now()}`,
          timestamp: Date.now(),
          originalError: error,
          strategy: this.recoveryStrategies.find(s => s.id === 'automatic_fallback')!,
          success: true,
          fallbackUsed: fallbackPreset.name,
          userInterventionRequired: false,
          recoveryTime: 0,
          notes: `Fallback to ${fallbackPreset.name} due to ${error.type} error`
        };

        this.recoveryHistory.push(attempt);

        console.log(`[ErrorRecovery] Fallback successful: ${fallbackPreset.name}`);
        return {
          success: true,
          recovered: true,
          recoveryAttempt: attempt,
          fallbackPreset: fallbackPreset.name
        };
      } else {
        console.error(`[ErrorRecovery] Fallback preset load failed: ${loadResult.error}`);
      }
    } catch (error) {
      console.error(`[ErrorRecovery] Fallback attempt failed:`, error);
    }

    return { success: false, recovered: false };
  }

  /**
   * Execute automatic recovery strategy
   */
  private async executeAutomaticRecovery(
    strategy: RecoveryStrategy,
    error: ShaderError,
    context?: any
  ): Promise<{
    success: boolean;
    recoveredShader?: string;
    fallbackUsed?: string;
  }> {
    switch (strategy.id) {
      case 'precision_qualifiers':
        return this.addPrecisionQualifiers(error, context);

      case 'webgl_compatibility':
        return this.applyWebGLCompatibility(error, context);

      case 'stub_functions':
        return this.addStubFunctions(error, context);

      case 'parameter_reset':
        return this.resetParameters(error, context);

      default:
        return { success: false };
    }
  }

  /**
   * Add missing precision qualifiers
   */
  private async addPrecisionQualifiers(
    error: ShaderError,
    context: any
  ): Promise<{ success: boolean; recoveredShader?: string }> {
    // This would modify the shader source to add precision qualifiers
    // For now, return false as this requires source modification
    console.log(`[ErrorRecovery] Precision qualifier fix needed for: ${error.message}`);
    return { success: false };
  }

  /**
   * Apply WebGL compatibility fixes
   */
  private async applyWebGLCompatibility(
    error: ShaderError,
    context: any
  ): Promise<{ success: boolean; recoveredShader?: string }> {
    // This would convert WebGL 2.0 syntax to WebGL 1.0
    console.log(`[ErrorRecovery] WebGL compatibility fix needed for: ${error.message}`);
    return { success: false };
  }

  /**
   * Add stub function implementations
   */
  private async addStubFunctions(
    error: ShaderError,
    context: any
  ): Promise<{ success: boolean; recoveredShader?: string }> {
    // This would add stub implementations for missing functions
    console.log(`[ErrorRecovery] Stub functions needed for: ${error.message}`);
    return { success: false };
  }

  /**
   * Reset shader parameters to defaults
   */
  private async resetParameters(
    error: ShaderError,
    context: any
  ): Promise<{ success: boolean; recoveredShader?: string }> {
    try {
      this.presetLoader.resetParameters();
      console.log(`[ErrorRecovery] Parameters reset to defaults`);
      return { success: true };
    } catch (error) {
      console.error(`[ErrorRecovery] Parameter reset failed:`, error);
      return { success: false };
    }
  }

  /**
   * Select the best fallback preset based on context
   */
  private selectFallbackPreset(context?: any): FallbackPreset | null {
    // If we have performance context, prefer presets that match the performance mode
    if (context?.performanceMode === 'low') {
      return this.fallbackPresets.find(p => p.complexity === 'low') || this.fallbackPresets[0];
    }

    // Otherwise, try presets in order of increasing complexity
    // Start with medium complexity as a good balance
    return this.fallbackPresets.find(p => p.complexity === 'medium') ||
           this.fallbackPresets.find(p => p.complexity === 'low') ||
           this.fallbackPresets[0];
  }

  /**
   * Find the primary (most severe) error
   */
  private findPrimaryError(errors: ShaderError[]): ShaderError | null {
    if (errors.length === 0) return null;

    // Prioritize by severity and type
    const severityOrder = { error: 3, warning: 2, info: 1 };
    const typePriority = {
      linking: 10,
      validation: 9,
      syntax: 8,
      redefinition: 7,
      missing_dependency: 6,
      circular_include: 5
    };

    return errors.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      return (typePriority[b.type as keyof typeof typePriority] || 0) -
             (typePriority[a.type as keyof typeof typePriority] || 0);
    })[0];
  }

  /**
   * Generate manual fix instructions
   */
  private generateManualFixInstructions(error: ShaderError): string[] {
    const instructions: string[] = [];

    switch (error.type) {
      case 'redefinition':
        instructions.push('Fix redefinition conflicts by renaming duplicate symbols');
        instructions.push('Check for multiple definitions of the same function, variable, or macro');
        break;

      case 'missing_dependency':
        instructions.push('Ensure all #include files exist and are accessible');
        instructions.push('Check file paths in #include directives');
        break;

      case 'syntax':
        instructions.push('Check shader syntax for errors');
        instructions.push('Verify all brackets, semicolons, and GLSL syntax');
        break;

      case 'linking':
        instructions.push('Check for undefined functions or variables');
        instructions.push('Ensure all required functions are implemented');
        break;

      default:
        instructions.push('Review shader code for errors');
        instructions.push('Check browser console for detailed error messages');
    }

    instructions.push('Consider using the Debug Shader Mode for step-by-step analysis');
    instructions.push('Check the shader compilation logs for more details');

    return instructions;
  }

  /**
   * Notify user of fallback
   */
  private notifyUserOfFallback(fallbackPreset: FallbackPreset, originalError: ShaderError): void {
    const message = `
Shader Error Recovery:
Original shader failed due to: ${originalError.message}
Automatically switched to: ${fallbackPreset.name}
Features: ${fallbackPreset.features.join(', ')}
Performance: ${Math.round(fallbackPreset.performance * 100)}%
Quality: ${Math.round(fallbackPreset.quality * 100)}%
    `.trim();

    console.warn(message);

    // In a real implementation, this would show a UI notification
    // For now, just log to console
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    automaticRecoveries: number;
    manualInterventions: number;
    commonStrategies: Record<string, number>;
    fallbackUsage: Record<string, number>;
  } {
    const successful = this.recoveryHistory.filter(a => a.success);
    const automatic = this.recoveryHistory.filter(a => a.success && !a.userInterventionRequired);
    const manual = this.recoveryHistory.filter(a => a.userInterventionRequired);

    const strategyCounts: Record<string, number> = {};
    const fallbackCounts: Record<string, number> = {};

    for (const attempt of this.recoveryHistory) {
      strategyCounts[attempt.strategy.id] = (strategyCounts[attempt.strategy.id] || 0) + 1;
      if (attempt.fallbackUsed) {
        fallbackCounts[attempt.fallbackUsed] = (fallbackCounts[attempt.fallbackUsed] || 0) + 1;
      }
    }

    return {
      totalAttempts: this.recoveryHistory.length,
      successfulRecoveries: successful.length,
      automaticRecoveries: automatic.length,
      manualInterventions: manual.length,
      commonStrategies: strategyCounts,
      fallbackUsage: fallbackCounts
    };
  }

  /**
   * Get available fallback presets
   */
  getAvailableFallbacks(): FallbackPreset[] {
    return [...this.fallbackPresets];
  }

  /**
   * Manually trigger fallback to a specific preset
   */
  async forceFallback(presetName: string): Promise<boolean> {
    const preset = this.fallbackPresets.find(p => p.name === presetName);
    if (!preset) {
      console.error(`[ErrorRecovery] Unknown fallback preset: ${presetName}`);
      return false;
    }

    try {
      const result = await this.presetLoader.loadPreset(preset.path);
      if (result.success) {
        console.log(`[ErrorRecovery] Manually switched to fallback preset: ${presetName}`);
        return true;
      }
    } catch (error) {
      console.error(`[ErrorRecovery] Failed to load fallback preset ${presetName}:`, error);
    }

    return false;
  }

  /**
   * Clear recovery history
   */
  clearHistory(): void {
    this.recoveryHistory = [];
    console.log('[ErrorRecovery] Recovery history cleared');
  }
}