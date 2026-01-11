/**
 * Loop Prevention System
 *
 * Detects when the same error occurs repeatedly and provides different fix strategies.
 * Tracks compilation attempts and suggests escalation when needed.
 */

import { ShaderDiagnosticTool, DiagnosticResult, ShaderError } from './ShaderDiagnosticTool';

export interface CompilationAttempt {
  timestamp: number;
  shaderPath: string;
  errorSignature: string;
  errorType: string;
  attemptNumber: number;
  strategyUsed?: string;
  success: boolean;
}

export interface LoopDetectionResult {
  isLoop: boolean;
  loopLength: number;
  repeatedErrors: ShaderError[];
  escalationRecommended: boolean;
  suggestedStrategies: string[];
  confidence: number; // 0-1, how confident we are this is a loop
}

export interface PreventionStrategy {
  name: string;
  description: string;
  priority: number; // Higher = try first
  applicableErrors: string[]; // Error types this strategy applies to
  implementation: (error: ShaderError, context: any) => Promise<boolean>;
}

export class LoopPreventionSystem {
  private attemptHistory: CompilationAttempt[] = [];
  private maxHistorySize = 50;
  private loopThreshold = 3; // Same error 3+ times = potential loop
  private escalationThreshold = 5; // After 5 attempts, escalate

  private strategies: PreventionStrategy[] = [
    {
      name: 'redefinition_fix',
      description: 'Fix redefinition conflicts by renaming symbols',
      priority: 10,
      applicableErrors: ['redefinition'],
      implementation: this.fixRedefinition.bind(this)
    },
    {
      name: 'include_order_fix',
      description: 'Reorder includes to resolve dependency issues',
      priority: 9,
      applicableErrors: ['missing_dependency', 'syntax'],
      implementation: this.fixIncludeOrder.bind(this)
    },
    {
      name: 'precision_qualifier_fix',
      description: 'Add missing precision qualifiers',
      priority: 8,
      applicableErrors: ['syntax'],
      implementation: this.fixPrecisionQualifiers.bind(this)
    },
    {
      name: 'compatibility_fallback',
      description: 'Use WebGL 1.0 compatible syntax',
      priority: 7,
      applicableErrors: ['compatibility'],
      implementation: this.applyCompatibilityFallback.bind(this)
    },
    {
      name: 'stub_function_addition',
      description: 'Add stub implementations for missing functions',
      priority: 6,
      applicableErrors: ['linking', 'validation'],
      implementation: this.addStubFunctions.bind(this)
    },
    {
      name: 'macro_cleanup',
      description: 'Clean up conflicting macro definitions',
      priority: 5,
      applicableErrors: ['redefinition'],
      implementation: this.cleanupMacros.bind(this)
    }
  ];

  /**
   * Record a compilation attempt
   */
  recordAttempt(
    shaderPath: string,
    diagnosticResult: DiagnosticResult,
    strategyUsed?: string
  ): void {
    const errorSignature = this.generateErrorSignature(diagnosticResult.errors);
    const primaryError = diagnosticResult.errors.find(e => e.severity === 'error');

    const attempt: CompilationAttempt = {
      timestamp: Date.now(),
      shaderPath,
      errorSignature,
      errorType: primaryError?.type || 'unknown',
      attemptNumber: this.getAttemptCount(shaderPath, errorSignature) + 1,
      strategyUsed,
      success: diagnosticResult.success
    };

    this.attemptHistory.push(attempt);

    // Maintain history size
    if (this.attemptHistory.length > this.maxHistorySize) {
      this.attemptHistory.shift();
    }

    console.log(`[LoopPrevention] Recorded attempt ${attempt.attemptNumber} for ${shaderPath}: ${diagnosticResult.success ? 'SUCCESS' : 'FAILED'}`);
  }

  /**
   * Detect if we're in a compilation loop
   */
  detectLoop(shaderPath: string, currentErrors: ShaderError[]): LoopDetectionResult {
    const recentAttempts = this.attemptHistory
      .filter(a => a.shaderPath === shaderPath)
      .slice(-10); // Last 10 attempts

    if (recentAttempts.length < this.loopThreshold) {
      return {
        isLoop: false,
        loopLength: 0,
        repeatedErrors: [],
        escalationRecommended: false,
        suggestedStrategies: [],
        confidence: 0
      };
    }

    // Group attempts by error signature
    const signatureGroups = new Map<string, CompilationAttempt[]>();
    for (const attempt of recentAttempts) {
      if (!signatureGroups.has(attempt.errorSignature)) {
        signatureGroups.set(attempt.errorSignature, []);
      }
      signatureGroups.get(attempt.errorSignature)!.push(attempt);
    }

    // Find the most repeated error signature
    let maxRepeats = 0;
    let repeatedSignature = '';
    for (const [signature, attempts] of signatureGroups) {
      if (attempts.length > maxRepeats) {
        maxRepeats = attempts.length;
        repeatedSignature = signature;
      }
    }

    const isLoop = maxRepeats >= this.loopThreshold;
    const confidence = Math.min(maxRepeats / this.loopThreshold, 1.0);
    const escalationRecommended = recentAttempts.length >= this.escalationThreshold;

    // Get suggested strategies for the repeated errors
    const repeatedErrors = this.parseErrorSignature(repeatedSignature);
    const suggestedStrategies = this.getSuggestedStrategies(repeatedErrors, recentAttempts.length);

    return {
      isLoop,
      loopLength: maxRepeats,
      repeatedErrors,
      escalationRecommended,
      suggestedStrategies,
      confidence
    };
  }

  /**
   * Get suggested strategies for breaking the loop
   */
  getSuggestedStrategies(errors: ShaderError[], attemptCount: number): string[] {
    const applicableStrategies = new Set<string>();

    for (const error of errors) {
      for (const strategy of this.strategies) {
        if (strategy.applicableErrors.includes(error.type)) {
          applicableStrategies.add(strategy.name);
        }
      }
    }

    // Sort by priority and return strategy names
    return Array.from(applicableStrategies)
      .map(name => this.strategies.find(s => s.name === name)!)
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.name);
  }

  /**
   * Apply a prevention strategy
   */
  async applyStrategy(
    strategyName: string,
    error: ShaderError,
    context: {
      shaderPath: string;
      source: string;
      diagnosticResult: DiagnosticResult;
    }
  ): Promise<{ success: boolean; modifiedSource?: string; explanation: string }> {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      return {
        success: false,
        explanation: `Unknown strategy: ${strategyName}`
      };
    }

    console.log(`[LoopPrevention] Applying strategy: ${strategyName} for error: ${error.message}`);

    try {
      const success = await strategy.implementation(error, context);
      return {
        success,
        explanation: success ? `Successfully applied ${strategyName}` : `Failed to apply ${strategyName}`
      };
    } catch (error) {
      console.error(`[LoopPrevention] Strategy ${strategyName} failed:`, error);
      return {
        success: false,
        explanation: `Strategy ${strategyName} threw exception: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get compilation statistics
   */
  getStatistics(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    loopsDetected: number;
    strategiesApplied: Record<string, number>;
  } {
    const successfulAttempts = this.attemptHistory.filter(a => a.success).length;
    const failedAttempts = this.attemptHistory.filter(a => !a.success).length;

    // Count loops (simplified - consecutive failures with same signature)
    let loopsDetected = 0;
    const shaderStats = new Map<string, CompilationAttempt[]>();

    for (const attempt of this.attemptHistory) {
      if (!shaderStats.has(attempt.shaderPath)) {
        shaderStats.set(attempt.shaderPath, []);
      }
      shaderStats.get(attempt.shaderPath)!.push(attempt);
    }

    for (const attempts of shaderStats.values()) {
      const signatureGroups = new Map<string, number>();
      for (const attempt of attempts) {
        signatureGroups.set(attempt.errorSignature, (signatureGroups.get(attempt.errorSignature) || 0) + 1);
      }
      loopsDetected += Array.from(signatureGroups.values()).filter(count => count >= this.loopThreshold).length;
    }

    // Count strategies applied
    const strategiesApplied: Record<string, number> = {};
    for (const attempt of this.attemptHistory) {
      if (attempt.strategyUsed) {
        strategiesApplied[attempt.strategyUsed] = (strategiesApplied[attempt.strategyUsed] || 0) + 1;
      }
    }

    return {
      totalAttempts: this.attemptHistory.length,
      successfulAttempts,
      failedAttempts,
      loopsDetected,
      strategiesApplied
    };
  }

  /**
   * Reset the system (clear history)
   */
  reset(): void {
    this.attemptHistory = [];
    console.log('[LoopPrevention] System reset - history cleared');
  }

  // Private helper methods

  private generateErrorSignature(errors: ShaderError[]): string {
    return errors
      .filter(e => e.severity === 'error')
      .map(e => `${e.type}:${e.message.substring(0, 100)}`)
      .sort()
      .join('|');
  }

  private parseErrorSignature(signature: string): ShaderError[] {
    return signature.split('|').map(part => {
      const [type, message] = part.split(':', 2);
      return {
        type: type as any,
        message: message || '',
        severity: 'error' as const
      };
    });
  }

  private getAttemptCount(shaderPath: string, errorSignature: string): number {
    return this.attemptHistory
      .filter(a => a.shaderPath === shaderPath && a.errorSignature === errorSignature)
      .length;
  }

  // Strategy implementations

  private async fixRedefinition(error: ShaderError, context: any): Promise<boolean> {
    // This would modify the shader source to fix redefinition conflicts
    // For now, return false to indicate manual intervention needed
    console.log(`[LoopPrevention] Redefinition fix needed for: ${error.message}`);
    return false; // Requires manual intervention
  }

  private async fixIncludeOrder(error: ShaderError, context: any): Promise<boolean> {
    // This would reorder #include directives
    console.log(`[LoopPrevention] Include order fix attempted for: ${error.message}`);
    return false; // Complex to implement automatically
  }

  private async fixPrecisionQualifiers(error: ShaderError, context: any): Promise<boolean> {
    // Add missing precision qualifiers to fragment shaders
    if (context.source && this.isFragmentShader(context.source)) {
      const modifiedSource = this.addPrecisionQualifiers(context.source);
      context.modifiedSource = modifiedSource;
      return true;
    }
    return false;
  }

  private async applyCompatibilityFallback(error: ShaderError, context: any): Promise<boolean> {
    // Convert WebGL 2.0 features to WebGL 1.0 compatible versions
    const modifiedSource = this.convertToWebGL1Compatible(context.source);
    context.modifiedSource = modifiedSource;
    return true;
  }

  private async addStubFunctions(error: ShaderError, context: any): Promise<boolean> {
    // Add stub implementations for missing functions
    const modifiedSource = this.addCommonStubFunctions(context.source);
    context.modifiedSource = modifiedSource;
    return true;
  }

  private async cleanupMacros(error: ShaderError, context: any): Promise<boolean> {
    // Remove or rename conflicting macro definitions
    console.log(`[LoopPrevention] Macro cleanup needed for: ${error.message}`);
    return false; // Requires careful analysis
  }

  // Helper methods for strategies

  private isFragmentShader(source: string): boolean {
    return source.includes('#pragma stage fragment') ||
           source.includes('gl_FragColor') ||
           source.includes('gl_FragCoord');
  }

  private addPrecisionQualifiers(source: string): string {
    if (source.includes('precision ')) {
      return source; // Already has precision qualifiers
    }

    // Add after #version
    const versionMatch = source.match(/#version.*?\n/);
    if (versionMatch) {
      const precisionLines = '\nprecision highp float;\nprecision highp int;\n';
      return source.replace(versionMatch[0], versionMatch[0] + precisionLines);
    }

    return source;
  }

  private convertToWebGL1Compatible(source: string): string {
    let result = source;

    // Convert texture() to texture2D()
    result = result.replace(/\btexture\s*\(/g, 'texture2D(');

    // Remove layout qualifiers (WebGL 1.0 doesn't support them)
    result = result.replace(/layout\s*\([^)]*\)\s*/g, '');

    // Convert 'in' to 'varying' for fragment shaders
    if (this.isFragmentShader(result)) {
      result = result.replace(/\bin\s+(vec\d|float|int)\s+/g, 'varying $1 ');
    }

    return result;
  }

  private addCommonStubFunctions(source: string): string {
    const stubFunctions = [
      'vec2 HSM_GetTubeCurvedCoord(vec2 in_coord, float in_geom_mode, vec2 in_geom_radius_scaled, vec2 in_geom_view_dist, float in_geom_tilt_angle_x, float in_geom_tilt_angle_y, float in_geom_aspect_ratio, vec2 in_geom_overscan, vec2 in_geom_tilted_tangent, vec2 in_geom_tangent_angle, vec2 in_geom_tangent_angle_screen_scale, vec2 in_geom_pos_x, vec2 in_geom_pos_y) { return in_coord; }',
      'float HSM_GetCornerMask(vec2 in_coord, float screen_aspect, float corner_radius, float edge_sharpness) { return 1.0; }',
      'float HSM_GetUseOnCurrentScreenIndex(float vis_mode) { return 1.0; }'
    ];

    let result = source;
    for (const stub of stubFunctions) {
      if (!result.includes(stub.split('(')[0])) { // Check if function name exists
        result += '\n' + stub + '\n';
      }
    }

    return result;
  }
}