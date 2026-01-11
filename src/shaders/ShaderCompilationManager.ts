/**
 * Shader Compilation Manager
 *
 * Integrated compilation pipeline that combines diagnostic tools, loop prevention,
 * error recovery, and debug capabilities into a unified system.
 */

import * as THREE from 'three';
import { MegaBezelCompiler, MegaBezelPreset, CompilationOptions } from './MegaBezelCompiler';
import { MegaBezelPresetLoader, PresetLoadResult } from './MegaBezelPresetLoader';
import { ShaderDiagnosticTool, DiagnosticResult } from './ShaderDiagnosticTool';
import { LoopPreventionSystem, LoopDetectionResult } from './LoopPreventionSystem';
import { ErrorRecoveryProcedures } from './ErrorRecoveryProcedures';
import { DebugShaderMode, DebugSession } from './DebugShaderMode';
import { AutomatedShaderValidation, ValidationResult } from './AutomatedShaderValidation';

export interface CompilationManagerOptions {
  enableDiagnostics: boolean;
  enableLoopPrevention: boolean;
  enableErrorRecovery: boolean;
  enableDebugMode: boolean;
  enableValidation: boolean;
  autoRecovery: boolean;
  debugMode: boolean;
  validationTimeout: number;
}

export interface CompilationResult {
  success: boolean;
  preset?: MegaBezelPreset;
  diagnostics?: DiagnosticResult;
  loopDetected?: LoopDetectionResult;
  recoveryAttempted?: boolean;
  debugSession?: DebugSession;
  validationResult?: ValidationResult;
  error?: string;
  warnings: string[];
  recommendations: string[];
}

export class ShaderCompilationManager {
  private compiler: MegaBezelCompiler;
  private loader: MegaBezelPresetLoader;
  private diagnosticTool: ShaderDiagnosticTool;
  private loopPrevention: LoopPreventionSystem;
  private errorRecovery: ErrorRecoveryProcedures;
  private debugMode: DebugShaderMode;
  private validation: AutomatedShaderValidation;

  private options: CompilationManagerOptions;
  private webglRenderer: THREE.WebGLRenderer;

  constructor(webglRenderer: THREE.WebGLRenderer, options: Partial<CompilationManagerOptions> = {}) {
    this.webglRenderer = webglRenderer;

    this.options = {
      enableDiagnostics: true,
      enableLoopPrevention: true,
      enableErrorRecovery: true,
      enableDebugMode: false,
      enableValidation: false,
      autoRecovery: true,
      debugMode: false,
      validationTimeout: 30000,
      ...options
    };

    // Initialize core systems
    this.compiler = new MegaBezelCompiler();
    this.loader = new MegaBezelPresetLoader(webglRenderer);
    this.diagnosticTool = new ShaderDiagnosticTool();
    this.loopPrevention = new LoopPreventionSystem();
    this.errorRecovery = new ErrorRecoveryProcedures(webglRenderer, this.loader);
    this.debugMode = new DebugShaderMode(webglRenderer);
    this.validation = new AutomatedShaderValidation();
  }

  /**
   * Compile a shader preset with full diagnostic and recovery support
   */
  async compilePreset(
    presetPath: string,
    compilationOptions: Partial<CompilationOptions> = {}
  ): Promise<CompilationResult> {
    const result: CompilationResult = {
      success: false,
      warnings: [],
      recommendations: []
    };

    console.log(`[ShaderCompilationManager] Starting compilation of ${presetPath}`);

    try {
      // Step 1: Initial compilation attempt
      console.log(`[ShaderCompilationManager] Step 1: Initial compilation`);
      const initialResult = await this.performInitialCompilation(presetPath, compilationOptions);

      if (initialResult.success && initialResult.preset) {
        result.success = true;
        result.preset = initialResult.preset;
        console.log(`[ShaderCompilationManager] ✓ Initial compilation successful`);
        return result;
      }

      // Step 2: Run diagnostics if enabled
      if (this.options.enableDiagnostics) {
        console.log(`[ShaderCompilationManager] Step 2: Running diagnostics`);
        const diagnosticResult = await this.diagnosticTool.diagnoseShader(`/${presetPath}`);
        result.diagnostics = diagnosticResult;

        if (!diagnosticResult.success) {
          result.warnings.push(...diagnosticResult.warnings.map(w => w.message));
          result.recommendations.push(...diagnosticResult.recommendations);
        }
      }

      // Step 3: Check for compilation loops
      if (this.options.enableLoopPrevention && result.diagnostics) {
        console.log(`[ShaderCompilationManager] Step 3: Checking for loops`);
        const loopResult = this.loopPrevention.detectLoop(presetPath, result.diagnostics.errors);
        result.loopDetected = loopResult;

        if (loopResult.isLoop) {
          console.warn(`[ShaderCompilationManager] ⚠ Loop detected: ${loopResult.loopLength} repeated errors`);
          result.warnings.push(`Compilation loop detected (${loopResult.loopLength} attempts)`);
          result.recommendations.push('Loop detected - trying different recovery strategies');
        }
      }

      // Step 4: Attempt error recovery
      if (this.options.enableErrorRecovery && this.options.autoRecovery && result.diagnostics && !result.diagnostics.success) {
        console.log(`[ShaderCompilationManager] Step 4: Attempting error recovery`);
        const recoveryResult = await this.errorRecovery.attemptRecovery(
          presetPath,
          result.diagnostics,
          { currentPreset: presetPath }
        );

        result.recoveryAttempted = true;

        if (recoveryResult.success && recoveryResult.recovered) {
          console.log(`[ShaderCompilationManager] ✓ Error recovery successful`);
          result.success = true;
          // The recovery system has already loaded a fallback preset
          result.preset = this.loader.getCurrentPreset() || undefined;
          return result;
        } else {
          result.warnings.push('Automatic recovery failed');
          if (recoveryResult.instructions) {
            result.recommendations.push(...recoveryResult.instructions);
          }
        }
      }

      // Step 5: Debug mode (if enabled and compilation failed)
      if (this.options.enableDebugMode && this.options.debugMode && !result.success) {
        console.log(`[ShaderCompilationManager] Step 5: Starting debug session`);
        const debugSession = await this.debugMode.startDebugSession(presetPath);
        result.debugSession = debugSession;

        // Wait for debug session to complete
        await this.waitForDebugCompletion(debugSession);

        if (debugSession.status === 'success' && debugSession.compiledShader) {
          console.log(`[ShaderCompilationManager] ✓ Debug session resolved the issue`);
          result.success = true;
          // Would need to create a preset from the debug result
        }
      }

      // Step 6: Final validation (if enabled)
      if (this.options.enableValidation && result.success) {
        console.log(`[ShaderCompilationManager] Step 6: Running validation`);
        const validationResult = await this.validation.validateAll();
        result.validationResult = validationResult;

        if (!validationResult.success) {
          result.warnings.push(`Validation found ${validationResult.errors} errors`);
          result.recommendations.push(...validationResult.summary.recommendations);
        }
      }

      // Record the compilation attempt for loop prevention
      if (result.diagnostics) {
        this.loopPrevention.recordAttempt(presetPath, result.diagnostics);
      }

      console.log(`[ShaderCompilationManager] Compilation ${result.success ? 'successful' : 'failed'} for ${presetPath}`);

    } catch (error) {
      console.error(`[ShaderCompilationManager] Compilation error:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown compilation error';
      result.warnings.push('Unexpected compilation error occurred');
    }

    return result;
  }

  /**
   * Load a preset with full pipeline support
   */
  async loadPreset(presetPath: string): Promise<PresetLoadResult & { diagnostics?: CompilationResult }> {
    console.log(`[ShaderCompilationManager] Loading preset: ${presetPath}`);

    // First try compilation with diagnostics
    const compilationResult = await this.compilePreset(presetPath);

    if (compilationResult.success) {
      // Compilation successful, now load the preset
      try {
        const loadResult = await this.loader.loadPreset(presetPath);
        return {
          ...loadResult,
          diagnostics: compilationResult
        };
      } catch (error) {
        console.error(`[ShaderCompilationManager] Preset load failed:`, error);
        return {
          success: false,
          error: `Load failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          diagnostics: compilationResult
        };
      }
    } else {
      // Compilation failed, return diagnostic information
      return {
        success: false,
        error: compilationResult.error || 'Compilation failed',
        diagnostics: compilationResult
      };
    }
  }

  /**
   * Perform initial compilation attempt
   */
  private async performInitialCompilation(
    presetPath: string,
    options: Partial<CompilationOptions>
  ): Promise<{ success: boolean; preset?: MegaBezelPreset; error?: string }> {
    try {
      const preset = await this.compiler.compilePreset(presetPath, options);
      return { success: true, preset };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compilation failed'
      };
    }
  }

  /**
   * Wait for debug session to complete
   */
  private async waitForDebugCompletion(session: DebugSession, timeout = 60000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (session.status !== 'running' || Date.now() - startTime > timeout) {
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    compilationStats: any;
    loopPreventionStats: any;
    recoveryStats: any;
    debugStats: any;
    validationStats: any;
  } {
    return {
      compilationStats: {
        // Would track compilation success rates, etc.
      },
      loopPreventionStats: this.loopPrevention.getStatistics(),
      recoveryStats: this.errorRecovery.getRecoveryStats(),
      debugStats: this.debugMode.getDebugStats(),
      validationStats: this.validation.getValidationStats()
    };
  }

  /**
   * Enable/disable diagnostic features
   */
  configureDiagnostics(options: Partial<CompilationManagerOptions>): void {
    this.options = { ...this.options, ...options };

    if (options.enableDebugMode !== undefined) {
      this.debugMode.setVisualFeedback(options.enableDebugMode);
    }

    console.log(`[ShaderCompilationManager] Diagnostics configured:`, this.options);
  }

  /**
   * Force a specific recovery strategy
   */
  async forceRecovery(presetName: string): Promise<boolean> {
    console.log(`[ShaderCompilationManager] Forcing recovery to preset: ${presetName}`);
    return this.errorRecovery.forceFallback(presetName);
  }

  /**
   * Start debug session for a shader
   */
  async startDebugSession(shaderPath: string): Promise<DebugSession> {
    return this.debugMode.startDebugSession(shaderPath);
  }

  /**
   * Run validation on all shaders
   */
  async runValidation(): Promise<ValidationResult> {
    console.log(`[ShaderCompilationManager] Running full validation suite`);
    return this.validation.validateAll();
  }

  /**
   * Clear all diagnostic caches and history
   */
  clearCaches(): void {
    this.diagnosticTool.clearCache();
    this.loopPrevention.reset();
    this.errorRecovery.clearHistory();
    this.validation.reset();
    console.log(`[ShaderCompilationManager] All caches and history cleared`);
  }

  /**
   * Get available fallback presets
   */
  getAvailableFallbacks() {
    return this.errorRecovery.getAvailableFallbacks();
  }

  /**
   * Export diagnostic report
   */
  exportDiagnosticReport(): any {
    const status = this.getSystemStatus();

    return {
      timestamp: new Date().toISOString(),
      systemStatus: status,
      activeDebugSessions: this.debugMode.getActiveSessions().length,
      recommendations: [
        ...status.recoveryStats.commonStrategies ? ['Consider optimizing frequently failing strategies'] : [],
        ...status.loopPreventionStats.loopsDetected > 0 ? ['Address compilation loops in shader development'] : [],
        ...status.validationStats.successRate < 0.8 ? ['Improve shader validation success rate'] : []
      ]
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    this.debugMode.dispose();
    this.loader.dispose();
    console.log(`[ShaderCompilationManager] Resources disposed`);
  }
}