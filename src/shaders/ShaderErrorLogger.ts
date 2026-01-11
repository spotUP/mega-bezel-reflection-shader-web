/**
 * Shader Error Logger
 *
 * Comprehensive error reporting and logging system for shader compilation issues.
 * Provides structured logging, error categorization, and integration with browser dev tools.
 */

import { DiagnosticResult, ShaderError, ShaderWarning } from './ShaderDiagnosticTool';
import { LoopDetectionResult } from './LoopPreventionSystem';
import { DebugSession } from './DebugShaderMode';
import { ValidationResult } from './AutomatedShaderValidation';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'compilation' | 'diagnostic' | 'loop_prevention' | 'recovery' | 'debug' | 'validation' | 'system';
  message: string;
  details?: any;
  context?: {
    shaderPath?: string;
    sessionId?: string;
    userAgent?: string;
    webglVersion?: string;
    performanceMetrics?: any;
    stackTrace?: string;
  };
  relatedErrors?: string[];
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  primaryError: ShaderError;
  relatedErrors: ShaderError[];
  warnings: ShaderWarning[];
  context: {
    shaderPath: string;
    compilationAttempt: number;
    loopDetected: boolean;
    recoveryAttempted: boolean;
    debugSessionActive: boolean;
  };
  recommendations: string[];
  technicalDetails: {
    diagnosticResult?: DiagnosticResult;
    loopResult?: LoopDetectionResult;
    debugSession?: DebugSession;
    validationResult?: ValidationResult;
  };
}

export interface LoggingOptions {
  enableConsoleLogging: boolean;
  enableStructuredLogging: boolean;
  enablePerformanceLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogEntries: number;
  enableBrowserConsoleIntegration: boolean;
  enableErrorReporting: boolean;
}

export class ShaderErrorLogger {
  private logEntries: LogEntry[] = [];
  private errorReports: ErrorReport[] = [];
  private options: LoggingOptions;

  private static instance: ShaderErrorLogger;

  constructor(options: Partial<LoggingOptions> = {}) {
    this.options = {
      enableConsoleLogging: true,
      enableStructuredLogging: true,
      enablePerformanceLogging: true,
      logLevel: 'info',
      maxLogEntries: 1000,
      enableBrowserConsoleIntegration: true,
      enableErrorReporting: true,
      ...options
    };

    if (this.options.enableBrowserConsoleIntegration) {
      this.setupBrowserConsoleIntegration();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: Partial<LoggingOptions>): ShaderErrorLogger {
    if (!ShaderErrorLogger.instance) {
      ShaderErrorLogger.instance = new ShaderErrorLogger(options);
    }
    return ShaderErrorLogger.instance;
  }

  /**
   * Log a message with context
   */
  log(
    level: LogEntry['level'],
    category: LogEntry['category'],
    message: string,
    details?: any,
    context?: LogEntry['context']
  ): void {
    // Check log level
    const levelPriority = { debug: 0, info: 1, warn: 2, error: 3, critical: 4 };
    if (levelPriority[level] < levelPriority[this.options.logLevel]) {
      return;
    }

    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
      context: {
        userAgent: navigator.userAgent,
        ...context
      }
    };

    // Add to log entries
    this.logEntries.push(entry);

    // Maintain max log entries
    if (this.logEntries.length > this.options.maxLogEntries) {
      this.logEntries.shift();
    }

    // Console logging
    if (this.options.enableConsoleLogging) {
      this.logToConsole(entry);
    }

    // Structured logging
    if (this.options.enableStructuredLogging) {
      this.logStructured(entry);
    }
  }

  /**
   * Log shader compilation error
   */
  logCompilationError(
    shaderPath: string,
    error: Error | string,
    context?: {
      diagnosticResult?: DiagnosticResult;
      loopResult?: LoopDetectionResult;
      attemptNumber?: number;
    }
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;

    this.log('error', 'compilation', `Shader compilation failed: ${shaderPath}`, {
      error: errorMessage,
      stackTrace,
      ...context
    }, {
      shaderPath,
      sessionId: context?.diagnosticResult?.shaderPath
    });

    // Create error report if significant
    if (context?.diagnosticResult && !context.diagnosticResult.success) {
      this.createErrorReport(shaderPath, context.diagnosticResult, context);
    }
  }

  /**
   * Log diagnostic results
   */
  logDiagnosticResult(shaderPath: string, result: DiagnosticResult): void {
    const level = result.success ? 'info' : 'warn';
    const status = result.success ? 'passed' : 'failed';

    this.log(level, 'diagnostic', `Shader diagnostics ${status}: ${shaderPath}`, {
      success: result.success,
      errors: result.errors.length,
      warnings: result.warnings.length,
      recommendations: result.recommendations.length,
      stats: result.stats
    }, {
      shaderPath
    });

    // Log individual errors and warnings
    result.errors.forEach(error => {
      this.log('error', 'diagnostic', `Diagnostic error: ${error.message}`, error, { shaderPath });
    });

    result.warnings.forEach(warning => {
      this.log('warn', 'diagnostic', `Diagnostic warning: ${warning.message}`, warning, { shaderPath });
    });
  }

  /**
   * Log loop detection
   */
  logLoopDetection(shaderPath: string, loopResult: LoopDetectionResult): void {
    const level = loopResult.isLoop ? 'warn' : 'info';
    const message = loopResult.isLoop
      ? `Compilation loop detected: ${loopResult.loopLength} repeated attempts`
      : 'No compilation loop detected';

    this.log(level, 'loop_prevention', message, {
      loopLength: loopResult.loopLength,
      confidence: loopResult.confidence,
      escalationRecommended: loopResult.escalationRecommended,
      suggestedStrategies: loopResult.suggestedStrategies
    }, {
      shaderPath
    });
  }

  /**
   * Log recovery attempt
   */
  logRecoveryAttempt(
    shaderPath: string,
    strategy: string,
    success: boolean,
    details?: any
  ): void {
    const level = success ? 'info' : 'warn';
    const status = success ? 'successful' : 'failed';

    this.log(level, 'recovery', `Error recovery ${status}: ${strategy}`, details, {
      shaderPath
    });
  }

  /**
   * Log debug session
   */
  logDebugSession(session: DebugSession): void {
    const level = session.status === 'success' ? 'info' :
                  session.status === 'failed' ? 'error' : 'info';

    this.log(level, 'debug', `Debug session ${session.status}: ${session.shaderPath}`, {
      sessionId: session.id,
      duration: Date.now() - session.startTime,
      stepsCompleted: session.steps.filter(s => s.status === 'success').length,
      stepsFailed: session.steps.filter(s => s.status === 'failed').length,
      error: session.error
    }, {
      shaderPath: session.shaderPath,
      sessionId: session.id
    });
  }

  /**
   * Log validation results
   */
  logValidationResult(result: ValidationResult): void {
    const level = result.success ? 'info' : 'error';
    const status = result.success ? 'passed' : 'failed';

    this.log(level, 'validation', `Shader validation ${status}`, {
      totalShaders: result.totalShaders,
      checkedShaders: result.checkedShaders,
      failedShaders: result.failedShaders,
      errors: result.errors,
      warnings: result.warnings,
      criticalFailures: result.criticalFailures.length,
      recommendations: result.summary.recommendations
    });
  }

  /**
   * Create comprehensive error report
   */
  private createErrorReport(
    shaderPath: string,
    diagnosticResult: DiagnosticResult,
    context?: any
  ): ErrorReport {
    const primaryError = this.findPrimaryError(diagnosticResult.errors);
    const severity = this.calculateSeverity(diagnosticResult);

    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: Date.now(),
      summary: `${severity.toUpperCase()}: Shader compilation failed for ${shaderPath}`,
      severity,
      primaryError,
      relatedErrors: diagnosticResult.errors.filter(e => e !== primaryError),
      warnings: diagnosticResult.warnings,
      context: {
        shaderPath,
        compilationAttempt: context?.attemptNumber || 1,
        loopDetected: context?.loopResult?.isLoop || false,
        recoveryAttempted: context?.recoveryAttempted || false,
        debugSessionActive: context?.debugSessionActive || false
      },
      recommendations: [
        ...diagnosticResult.recommendations,
        'Check browser console for detailed error logs',
        'Try using Debug Shader Mode for step-by-step analysis',
        'Consider enabling error recovery for automatic fallback'
      ],
      technicalDetails: {
        diagnosticResult,
        loopResult: context?.loopResult,
        debugSession: context?.debugSession,
        validationResult: context?.validationResult
      }
    };

    this.errorReports.push(report);

    // Log the error report creation
    this.log('error', 'system', `Error report created: ${report.summary}`, {
      reportId: report.id,
      severity: report.severity
    }, {
      shaderPath
    });

    return report;
  }

  /**
   * Find the primary (most severe) error
   */
  private findPrimaryError(errors: ShaderError[]): ShaderError {
    if (errors.length === 0) {
      return {
        type: 'validation',
        message: 'Unknown error',
        severity: 'error'
      };
    }

    // Sort by severity and type priority
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
   * Calculate overall severity
   */
  private calculateSeverity(result: DiagnosticResult): 'low' | 'medium' | 'high' | 'critical' {
    const errorCount = result.errors.length;
    const hasCriticalErrors = result.errors.some(e =>
      e.type === 'linking' || e.type === 'validation'
    );

    if (hasCriticalErrors || errorCount > 5) return 'critical';
    if (errorCount > 2) return 'high';
    if (errorCount > 0) return 'medium';
    if (result.warnings.length > 0) return 'low';
    return 'low';
  }

  /**
   * Log to browser console with appropriate formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.category.toUpperCase()}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.details);
        break;
      case 'info':
        console.info(message, entry.details);
        break;
      case 'warn':
        console.warn(message, entry.details);
        break;
      case 'error':
      case 'critical':
        console.error(message, entry.details);
        if (entry.context?.stackTrace) {
          console.error('Stack trace:', entry.context.stackTrace);
        }
        break;
    }
  }

  /**
   * Log structured data for analysis
   */
  private logStructured(entry: LogEntry): void {
    // In a real implementation, this would send to a logging service
    // For now, store in memory for retrieval
    if (entry.level === 'error' || entry.level === 'critical') {
      // Could send to error reporting service
      console.log('Structured error log:', JSON.stringify(entry, null, 2));
    }
  }

  /**
   * Setup browser console integration
   */
  private setupBrowserConsoleIntegration(): void {
    // Override console methods to capture shader-related logs
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Add shader-specific console methods
    (console as any).logShader = (message: string, details?: any) => {
      this.log('info', 'system', message, details);
    };

    (console as any).logShaderError = (message: string, error?: any) => {
      this.log('error', 'system', message, error);
    };

    (console as any).logShaderWarn = (message: string, warning?: any) => {
      this.log('warn', 'system', message, warning);
    };
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 50): LogEntry[] {
    return this.logEntries.slice(-count);
  }

  /**
   * Get error reports
   */
  getErrorReports(): ErrorReport[] {
    return [...this.errorReports];
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: LogEntry['category']): LogEntry[] {
    return this.logEntries.filter(entry => entry.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logEntries.filter(entry => entry.level === level);
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): {
    entries: LogEntry[];
    reports: ErrorReport[];
    summary: {
      totalEntries: number;
      errorCount: number;
      warningCount: number;
      categories: Record<string, number>;
      timeRange: { start: number; end: number };
    };
  } {
    const categories: Record<string, number> = {};
    let errorCount = 0;
    let warningCount = 0;

    this.logEntries.forEach(entry => {
      categories[entry.category] = (categories[entry.category] || 0) + 1;
      if (entry.level === 'error' || entry.level === 'critical') errorCount++;
      if (entry.level === 'warn') warningCount++;
    });

    const timestamps = this.logEntries.map(e => e.timestamp);
    const timeRange = {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };

    return {
      entries: [...this.logEntries],
      reports: [...this.errorReports],
      summary: {
        totalEntries: this.logEntries.length,
        errorCount,
        warningCount,
        categories,
        timeRange
      }
    };
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logEntries = [];
    this.errorReports = [];
    console.log('[ShaderErrorLogger] Logs cleared');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Performance logging
   */
  logPerformance(operation: string, duration: number, details?: any): void {
    if (this.options.enablePerformanceLogging) {
      this.log('info', 'system', `Performance: ${operation} took ${duration.toFixed(1)}ms`, details);
    }
  }
}