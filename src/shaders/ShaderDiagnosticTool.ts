/**
 * Shader Diagnostic Tool
 *
 * Systematically tests shader compilation with detailed error reporting.
 * Provides comprehensive diagnostics for Mega Bezel shader issues.
 */

import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';

export interface DiagnosticResult {
  success: boolean;
  shaderPath: string;
  errors: ShaderError[];
  warnings: ShaderWarning[];
  stats: CompilationStats;
  recommendations: string[];
}

export interface ShaderError {
  type: 'syntax' | 'linking' | 'validation' | 'redefinition' | 'missing_dependency' | 'circular_include';
  message: string;
  line?: number;
  column?: number;
  context?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ShaderWarning {
  type: 'performance' | 'compatibility' | 'deprecated' | 'unused';
  message: string;
  line?: number;
  suggestion?: string;
}

export interface CompilationStats {
  compileTime: number;
  shaderSize: number;
  uniformsCount: number;
  samplersCount: number;
  parametersCount: number;
  includesCount: number;
  definesCount: number;
}

export interface DiagnosticOptions {
  testIndividualFiles: boolean;
  checkRedefinitions: boolean;
  validateDependencies: boolean;
  performanceAnalysis: boolean;
  compatibilityCheck: boolean;
  timeout: number;
}

export class ShaderDiagnosticTool {
  private compiler: SlangShaderCompiler;
  private errorHistory: Map<string, ShaderError[]> = new Map();
  private compilationCache: Map<string, { result: DiagnosticResult; timestamp: number }> = new Map();

  constructor() {
    this.compiler = new SlangShaderCompiler();
  }

  /**
   * Run comprehensive diagnostics on a shader file
   */
  async diagnoseShader(
    shaderPath: string,
    options: Partial<DiagnosticOptions> = {}
  ): Promise<DiagnosticResult> {
    const opts: DiagnosticOptions = {
      testIndividualFiles: true,
      checkRedefinitions: true,
      validateDependencies: true,
      performanceAnalysis: true,
      compatibilityCheck: true,
      timeout: 30000,
      ...options
    };

    console.log(`[ShaderDiagnostic] Starting diagnostics for: ${shaderPath}`);

    const startTime = performance.now();
    const result: DiagnosticResult = {
      success: false,
      shaderPath,
      errors: [],
      warnings: [],
      stats: {
        compileTime: 0,
        shaderSize: 0,
        uniformsCount: 0,
        samplersCount: 0,
        parametersCount: 0,
        includesCount: 0,
        definesCount: 0
      },
      recommendations: []
    };

    try {
      // Check cache first
      const cached = this.compilationCache.get(shaderPath);
      if (cached && (Date.now() - cached.timestamp) < 5000) { // 5 second cache
        console.log(`[ShaderDiagnostic] Using cached result for: ${shaderPath}`);
        return cached.result;
      }

      // Load shader source
      const source = await this.loadShaderSource(shaderPath);
      result.stats.shaderSize = source.length;

      // Extract metadata
      const metadata = this.extractShaderMetadata(source);
      result.stats.includesCount = metadata.includes.length;
      result.stats.definesCount = metadata.defines.length;

      // Test individual file compilation if requested
      if (opts.testIndividualFiles) {
        const individualResult = await this.testIndividualCompilation(source, shaderPath);
        result.errors.push(...individualResult.errors);
        result.warnings.push(...individualResult.warnings);
      }

      // Check for redefinition conflicts
      if (opts.checkRedefinitions) {
        const redefinitionErrors = this.checkRedefinitionConflicts(source, metadata);
        result.errors.push(...redefinitionErrors);
      }

      // Validate dependencies
      if (opts.validateDependencies) {
        const dependencyErrors = await this.validateDependencies(metadata.includes, shaderPath);
        result.errors.push(...dependencyErrors);
      }

      // Full compilation test
      const compileResult = await this.testFullCompilation(shaderPath, opts.timeout);
      if (compileResult.success && compileResult.compiledShader) {
        result.stats.compileTime = performance.now() - startTime;
        result.stats.uniformsCount = compileResult.compiledShader.uniforms.length;
        result.stats.samplersCount = compileResult.compiledShader.samplers.length;
        result.stats.parametersCount = compileResult.compiledShader.parameters.length;

        // Performance analysis
        if (opts.performanceAnalysis) {
          const perfWarnings = this.analyzePerformance(compileResult.compiledShader);
          result.warnings.push(...perfWarnings);
        }

        // Compatibility check
        if (opts.compatibilityCheck) {
          const compatWarnings = this.checkCompatibility(compileResult.compiledShader);
          result.warnings.push(...compatWarnings);
        }
      } else {
        result.errors.push({
          type: 'linking',
          message: compileResult.error || 'Compilation failed',
          severity: 'error'
        });
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result.errors, result.warnings);

      // Determine success
      result.success = result.errors.filter(e => e.severity === 'error').length === 0;

      // Cache result
      this.compilationCache.set(shaderPath, { result, timestamp: Date.now() });

      console.log(`[ShaderDiagnostic] Diagnostics completed for: ${shaderPath}`, {
        success: result.success,
        errors: result.errors.length,
        warnings: result.warnings.length,
        recommendations: result.recommendations.length
      });

    } catch (error) {
      console.error(`[ShaderDiagnostic] Diagnostic error for ${shaderPath}:`, error);
      result.errors.push({
        type: 'validation',
        message: `Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Test compilation of individual shader files
   */
  private async testIndividualCompilation(source: string, shaderPath: string): Promise<{
    errors: ShaderError[];
    warnings: ShaderWarning[];
  }> {
    const errors: ShaderError[] = [];
    const warnings: ShaderWarning[] = [];

    try {
      // Test syntax by attempting compilation
      const compiled = await SlangShaderCompiler.compile(source, true);

      // Check for common syntax issues
      if (source.includes('#version') && !source.includes('#version 300 es') && !source.includes('#version 450')) {
        warnings.push({
          type: 'compatibility',
          message: 'Non-standard #version directive detected',
          suggestion: 'Use #version 300 es for WebGL 2.0 or #version 450 for Vulkan'
        });
      }

      // Check for missing precision qualifiers in fragment shaders
      if (this.isFragmentShader(source) && !source.includes('precision')) {
        errors.push({
          type: 'syntax',
          message: 'Fragment shader missing precision qualifiers',
          severity: 'error'
        });
      }

    } catch (error) {
      errors.push({
        type: 'syntax',
        message: `Individual compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  /**
   * Check for redefinition conflicts (the historical issue)
   */
  private checkRedefinitionConflicts(source: string, metadata: any): ShaderError[] {
    const errors: ShaderError[] = [];
    const seenDefines = new Set<string>();
    const seenFunctions = new Set<string>();
    const seenGlobals = new Set<string>();

    // Check #define redefinitions
    for (const define of metadata.defines) {
      const match = define.match(/^#define\s+(\w+)/);
      if (match) {
        const name = match[1];
        if (seenDefines.has(name)) {
          errors.push({
            type: 'redefinition',
            message: `Macro '${name}' redefined`,
            context: define,
            severity: 'error'
          });
        }
        seenDefines.add(name);
      }
    }

    // Check function redefinitions
    for (const func of metadata.functions) {
      const match = func.match(/^\s*(?:\w+\s+)*(\w+)\s*\(/);
      if (match) {
        const name = match[1];
        if (seenFunctions.has(name)) {
          errors.push({
            type: 'redefinition',
            message: `Function '${name}' redefined`,
            context: func.substring(0, 100),
            severity: 'error'
          });
        }
        seenFunctions.add(name);
      }
    }

    // Check global variable redefinitions
    for (const global of metadata.globals) {
      const match = global.match(/^\s*(?:\w+\s+)+(\w+)\s*[;=]/);
      if (match) {
        const name = match[1];
        if (seenGlobals.has(name)) {
          errors.push({
            type: 'redefinition',
            message: `Global variable '${name}' redefined`,
            context: global,
            severity: 'error'
          });
        }
        seenGlobals.add(name);
      }
    }

    return errors;
  }

  /**
   * Validate shader dependencies
   */
  private async validateDependencies(includes: string[], basePath: string): Promise<ShaderError[]> {
    const errors: ShaderError[] = [];
    const processed = new Set<string>();

    for (const include of includes) {
      if (processed.has(include)) {
        errors.push({
          type: 'circular_include',
          message: `Circular include detected: ${include}`,
          severity: 'error'
        });
        continue;
      }

      try {
        // Try to load the include file
        const includePath = this.resolveIncludePath(include, basePath);
        const response = await fetch(includePath);
        if (!response.ok) {
          errors.push({
            type: 'missing_dependency',
            message: `Include file not found: ${include} (${includePath})`,
            severity: 'error'
          });
        }
        processed.add(include);
      } catch (error) {
        errors.push({
          type: 'missing_dependency',
          message: `Failed to validate include: ${include} - ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Test full compilation pipeline
   */
  private async testFullCompilation(shaderPath: string, timeout: number): Promise<{
    success: boolean;
    compiledShader?: CompiledShader;
    error?: string;
  }> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Compilation timeout')), timeout)
      );

      const compilePromise = SlangShaderCompiler.loadFromURL(shaderPath, true);

      const compiledShader = await Promise.race([compilePromise, timeoutPromise]);

      return { success: true, compiledShader };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error'
      };
    }
  }

  /**
   * Analyze performance characteristics
   */
  private analyzePerformance(compiledShader: CompiledShader): ShaderWarning[] {
    const warnings: ShaderWarning[] = [];

    // Check shader size
    const totalSize = compiledShader.vertex.length + compiledShader.fragment.length;
    if (totalSize > 100000) { // 100KB
      warnings.push({
        type: 'performance',
        message: `Large shader size: ${(totalSize / 1024).toFixed(1)}KB may impact performance`,
        suggestion: 'Consider splitting into multiple passes or optimizing code'
      });
    }

    // Check uniform count
    if (compiledShader.uniforms.length > 50) {
      warnings.push({
        type: 'performance',
        message: `High uniform count: ${compiledShader.uniforms.length} uniforms`,
        suggestion: 'Consider using uniform buffers or reducing parameter count'
      });
    }

    // Check for expensive operations in fragment shader
    const expensiveOps = ['sin(', 'cos(', 'tan(', 'sqrt(', 'pow(', 'exp(', 'log('];
    let expensiveOpCount = 0;
    for (const op of expensiveOps) {
      expensiveOpCount += (compiledShader.fragment.match(new RegExp(op, 'g')) || []).length;
    }

    if (expensiveOpCount > 20) {
      warnings.push({
        type: 'performance',
        message: `High number of expensive operations: ${expensiveOpCount}`,
        suggestion: 'Consider using lookup tables or approximations for trigonometric functions'
      });
    }

    return warnings;
  }

  /**
   * Check WebGL compatibility
   */
  private checkCompatibility(compiledShader: CompiledShader): ShaderWarning[] {
    const warnings: ShaderWarning[] = [];

    // Check for WebGL 1.0 incompatible features
    const webgl1Incompatible = [
      'textureLod',
      'texelFetch',
      'textureSize',
      'uint',
      'uvec2',
      'uvec3',
      'uvec4'
    ];

    for (const feature of webgl1Incompatible) {
      if (compiledShader.vertex.includes(feature) || compiledShader.fragment.includes(feature)) {
        warnings.push({
          type: 'compatibility',
          message: `WebGL 1.0 incompatible feature: ${feature}`,
          suggestion: 'Ensure WebGL 2.0 is enabled or provide WebGL 1.0 fallback'
        });
      }
    }

    return warnings;
  }

  /**
   * Generate recommendations based on errors and warnings
   */
  private generateRecommendations(errors: ShaderError[], warnings: ShaderWarning[]): string[] {
    const recommendations: string[] = [];

    // Error-based recommendations
    const errorTypes = errors.map(e => e.type);
    if (errorTypes.includes('redefinition')) {
      recommendations.push('Fix redefinition conflicts by renaming duplicate symbols');
    }
    if (errorTypes.includes('missing_dependency')) {
      recommendations.push('Ensure all include files exist and are accessible');
    }
    if (errorTypes.includes('syntax')) {
      recommendations.push('Check shader syntax and fix compilation errors');
    }

    // Warning-based recommendations
    const warningTypes = warnings.map(w => w.type);
    if (warningTypes.includes('performance')) {
      recommendations.push('Optimize shader for better performance - consider reducing complexity');
    }
    if (warningTypes.includes('compatibility')) {
      recommendations.push('Ensure WebGL 2.0 compatibility or provide fallbacks');
    }

    // General recommendations
    if (errors.length === 0 && warnings.length === 0) {
      recommendations.push('Shader appears healthy - no issues detected');
    }

    return recommendations;
  }

  /**
   * Extract metadata from shader source
   */
  private extractShaderMetadata(source: string): {
    includes: string[];
    defines: string[];
    functions: string[];
    globals: string[];
  } {
    const includes: string[] = [];
    const defines: string[] = [];
    const functions: string[] = [];
    const globals: string[] = [];

    const lines = source.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Includes
      const includeMatch = trimmed.match(/^#include\s+"([^"]+)"/);
      if (includeMatch) {
        includes.push(includeMatch[1]);
      }

      // Defines
      if (trimmed.startsWith('#define')) {
        defines.push(trimmed);
      }

      // Functions (basic detection)
      if (trimmed.match(/^\w+\s+\w+\s*\(/) && !trimmed.includes('#define')) {
        functions.push(trimmed);
      }

      // Globals (basic detection)
      if (trimmed.match(/^(float|int|vec\d|mat\d)\s+\w+\s*[=;]/) && !trimmed.includes('(')) {
        globals.push(trimmed);
      }
    }

    return { includes, defines, functions, globals };
  }

  /**
   * Load shader source from URL
   */
  private async loadShaderSource(shaderPath: string): Promise<string> {
    const response = await fetch(shaderPath);
    if (!response.ok) {
      throw new Error(`Failed to load shader: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Check if shader is a fragment shader
   */
  private isFragmentShader(source: string): boolean {
    return source.includes('#pragma stage fragment') ||
           source.includes('gl_FragColor') ||
           source.includes('gl_FragCoord');
  }

  /**
   * Resolve include path relative to base shader
   */
  private resolveIncludePath(include: string, basePath: string): string {
    const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    return baseDir + include;
  }

  /**
   * Clear compilation cache
   */
  clearCache(): void {
    this.compilationCache.clear();
  }

  /**
   * Get diagnostic history
   */
  getDiagnosticHistory(): Map<string, ShaderError[]> {
    return new Map(this.errorHistory);
  }
}