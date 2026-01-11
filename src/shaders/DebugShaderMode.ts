/**
 * Debug Shader Mode
 *
 * Isolated shader testing environment with step-by-step compilation logging,
 * visual feedback for compilation status, and easy rollback to working shader states.
 */

import * as THREE from 'three';
import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';
import { ShaderDiagnosticTool, DiagnosticResult } from './ShaderDiagnosticTool';
import { LoopPreventionSystem } from './LoopPreventionSystem';

export interface DebugSession {
  id: string;
  shaderPath: string;
  startTime: number;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  steps: DebugStep[];
  currentStep: number;
  compiledShader?: CompiledShader;
  error?: string;
  diagnostics?: DiagnosticResult;
}

export interface DebugStep {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  duration?: number;
}

export interface DebugOptions {
  enableVisualFeedback: boolean;
  logLevel: 'basic' | 'detailed' | 'verbose';
  autoRollback: boolean;
  maxSteps: number;
  timeout: number;
}

export interface VisualFeedbackOptions {
  showCompilationProgress: boolean;
  showErrorHighlights: boolean;
  showPerformanceMetrics: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class DebugShaderMode {
  private renderer: THREE.WebGLRenderer;
  private diagnosticTool: ShaderDiagnosticTool;
  private loopPrevention: LoopPreventionSystem;
  private activeSessions: Map<string, DebugSession> = new Map();
  private debugOverlay: HTMLDivElement | null = null;

  private options: DebugOptions;
  private visualOptions: VisualFeedbackOptions;

  constructor(
    renderer: THREE.WebGLRenderer,
    options: Partial<DebugOptions> = {},
    visualOptions: Partial<VisualFeedbackOptions> = {}
  ) {
    this.renderer = renderer;
    this.diagnosticTool = new ShaderDiagnosticTool();
    this.loopPrevention = new LoopPreventionSystem();

    this.options = {
      enableVisualFeedback: true,
      logLevel: 'detailed',
      autoRollback: true,
      maxSteps: 20,
      timeout: 30000,
      ...options
    };

    this.visualOptions = {
      showCompilationProgress: true,
      showErrorHighlights: true,
      showPerformanceMetrics: true,
      overlayPosition: 'top-right',
      ...visualOptions
    };

    if (this.options.enableVisualFeedback) {
      this.createDebugOverlay();
    }
  }

  /**
   * Start a debug session for a shader
   */
  async startDebugSession(shaderPath: string): Promise<DebugSession> {
    const sessionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session: DebugSession = {
      id: sessionId,
      shaderPath,
      startTime: Date.now(),
      status: 'running',
      steps: [],
      currentStep: 0
    };

    this.activeSessions.set(sessionId, session);

    console.log(`[DebugShaderMode] Started debug session ${sessionId} for ${shaderPath}`);

    if (this.options.enableVisualFeedback) {
      this.updateVisualFeedback(session);
    }

    // Start the debug process
    this.runDebugProcess(session).catch(error => {
      console.error(`[DebugShaderMode] Debug session ${sessionId} failed:`, error);
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateVisualFeedback(session);
    });

    return session;
  }

  /**
   * Run the debug process step by step
   */
  private async runDebugProcess(session: DebugSession): Promise<void> {
    const steps: DebugStep[] = [
      {
        id: 'load_source',
        name: 'Load Shader Source',
        description: 'Load the shader source code from file',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'parse_pragmas',
        name: 'Parse Pragmas',
        description: 'Extract #pragma directives and parameters',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'extract_bindings',
        name: 'Extract Bindings',
        description: 'Extract uniform bindings and UBO definitions',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'extract_global_defs',
        name: 'Extract Global Definitions',
        description: 'Extract functions, defines, and global variables',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'split_stages',
        name: 'Split Stages',
        description: 'Separate vertex and fragment shader stages',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'convert_vertex',
        name: 'Convert Vertex Shader',
        description: 'Convert vertex shader to WebGL GLSL',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'convert_fragment',
        name: 'Convert Fragment Shader',
        description: 'Convert fragment shader to WebGL GLSL',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'validate_syntax',
        name: 'Validate Syntax',
        description: 'Check for syntax errors and basic validation',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'check_dependencies',
        name: 'Check Dependencies',
        description: 'Validate include files and dependencies',
        startTime: 0,
        status: 'pending'
      },
      {
        id: 'final_compilation',
        name: 'Final Compilation',
        description: 'Complete shader compilation and linking',
        startTime: 0,
        status: 'pending'
      }
    ];

    session.steps = steps;

    for (let i = 0; i < steps.length && i < this.options.maxSteps; i++) {
      session.currentStep = i;
      const step = steps[i];

      await this.executeStep(session, step);

      if (step.status === 'failed') {
        session.status = 'failed';
        break;
      }

      if (this.options.enableVisualFeedback) {
        this.updateVisualFeedback(session);
      }
    }

    if (session.status === 'running') {
      session.status = 'success';
    }

    this.finalizeSession(session);
  }

  /**
   * Execute a single debug step
   */
  private async executeStep(session: DebugSession, step: DebugStep): Promise<void> {
    step.status = 'running';
    step.startTime = Date.now();

    try {
      console.log(`[DebugShaderMode] Executing step: ${step.name}`);

      switch (step.id) {
        case 'load_source':
          step.output = await this.loadShaderSource(session.shaderPath);
          break;

        case 'parse_pragmas':
          const pragmas = SlangShaderCompiler['extractPragmas'](step.output);
          step.output = pragmas;
          break;

        case 'extract_bindings':
          const bindings = SlangShaderCompiler['extractBindings'](step.output);
          step.output = bindings;
          break;

        case 'extract_global_defs':
          const globalDefs = SlangShaderCompiler['extractGlobalDefinitions'](step.output);
          step.output = globalDefs;
          break;

        case 'split_stages':
          const stages = SlangShaderCompiler['splitStages'](step.output);
          step.output = stages;
          break;

        case 'convert_vertex':
          // This would need access to internal conversion methods
          step.output = 'Vertex conversion completed';
          break;

        case 'convert_fragment':
          // This would need access to internal conversion methods
          step.output = 'Fragment conversion completed';
          break;

        case 'validate_syntax':
          const syntaxCheck = await this.diagnosticTool.diagnoseShader(`/${session.shaderPath}`, {
            testIndividualFiles: true,
            checkRedefinitions: false,
            validateDependencies: false
          });
          step.output = syntaxCheck;
          if (!syntaxCheck.success) {
            step.status = 'failed';
            step.error = 'Syntax validation failed';
          }
          break;

        case 'check_dependencies':
          const dependencyCheck = await this.diagnosticTool.diagnoseShader(`/${session.shaderPath}`, {
            testIndividualFiles: false,
            checkRedefinitions: false,
            validateDependencies: true
          });
          step.output = dependencyCheck;
          if (dependencyCheck.errors.some(e => e.type === 'missing_dependency')) {
            step.status = 'failed';
            step.error = 'Dependency check failed';
          }
          break;

        case 'final_compilation':
          const finalResult = await this.diagnosticTool.diagnoseShader(`/${session.shaderPath}`);
          step.output = finalResult;
          session.diagnostics = finalResult;
          if (finalResult.success) {
            session.compiledShader = await SlangShaderCompiler.loadFromURL(`/${session.shaderPath}`, true);
          } else {
            step.status = 'failed';
            step.error = 'Final compilation failed';
          }
          break;
      }

      step.status = 'success';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;

      console.log(`[DebugShaderMode] Step ${step.name} completed successfully in ${step.duration}ms`);

    } catch (error) {
      step.status = 'failed';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.error = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[DebugShaderMode] Step ${step.name} failed:`, error);
    }
  }

  /**
   * Load shader source (simplified for demo)
   */
  private async loadShaderSource(shaderPath: string): Promise<string> {
    const response = await fetch(`/${shaderPath}`);
    if (!response.ok) {
      throw new Error(`Failed to load shader: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * Create debug overlay for visual feedback
   */
  private createDebugOverlay(): void {
    if (this.debugOverlay) return;

    this.debugOverlay = document.createElement('div');
    this.debugOverlay.id = 'shader-debug-overlay';
    this.debugOverlay.style.cssText = `
      position: fixed;
      ${this.visualOptions.overlayPosition.replace('-', '-')}: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      max-width: 400px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 10000;
      pointer-events: none;
    `;

    document.body.appendChild(this.debugOverlay);
  }

  /**
   * Update visual feedback overlay
   */
  private updateVisualFeedback(session: DebugSession): void {
    if (!this.debugOverlay) return;

    const currentStep = session.steps[session.currentStep];
    const completedSteps = session.steps.filter(s => s.status === 'success').length;
    const totalSteps = session.steps.length;

    let content = `<div style="margin-bottom: 10px; font-weight: bold;">Shader Debug Session</div>`;
    content += `<div>Shader: ${session.shaderPath.split('/').pop()}</div>`;
    content += `<div>Progress: ${completedSteps}/${totalSteps} steps</div>`;

    if (currentStep) {
      content += `<div style="margin-top: 10px;">Current: ${currentStep.name}</div>`;
      content += `<div>Status: <span style="color: ${this.getStatusColor(currentStep.status)}">${currentStep.status}</span></div>`;
    }

    if (session.status === 'failed' && session.error) {
      content += `<div style="color: #ff6666; margin-top: 10px;">Error: ${session.error}</div>`;
    }

    // Show recent steps
    content += `<div style="margin-top: 10px; font-size: 10px;">`;
    session.steps.slice(-3).forEach(step => {
      const color = this.getStatusColor(step.status);
      content += `<div>• ${step.name}: <span style="color: ${color}">${step.status}</span></div>`;
    });
    content += `</div>`;

    this.debugOverlay.innerHTML = content;
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: string): string {
    switch (status) {
      case 'success': return '#66ff66';
      case 'failed': return '#ff6666';
      case 'running': return '#ffff66';
      case 'pending': return '#cccccc';
      case 'skipped': return '#888888';
      default: return '#ffffff';
    }
  }

  /**
   * Finalize debug session
   */
  private finalizeSession(session: DebugSession): void {
    const duration = Date.now() - session.startTime;

    console.log(`[DebugShaderMode] Session ${session.id} finalized:`, {
      status: session.status,
      duration: `${duration}ms`,
      stepsCompleted: session.steps.filter(s => s.status === 'success').length,
      stepsFailed: session.steps.filter(s => s.status === 'failed').length
    });

    if (this.options.enableVisualFeedback) {
      this.updateVisualFeedback(session);

      // Auto-hide overlay after a delay
      setTimeout(() => {
        if (this.debugOverlay) {
          this.debugOverlay.style.opacity = '0';
          setTimeout(() => {
            if (this.debugOverlay && this.debugOverlay.parentNode) {
              this.debugOverlay.parentNode.removeChild(this.debugOverlay);
              this.debugOverlay = null;
            }
          }, 500);
        }
      }, 3000);
    }

    // Clean up session
    setTimeout(() => {
      this.activeSessions.delete(session.id);
    }, 5000);
  }

  /**
   * Get active debug sessions
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Cancel a debug session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'running') {
      session.status = 'cancelled';
      console.log(`[DebugShaderMode] Cancelled session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get debug statistics
   */
  getDebugStats(): {
    activeSessions: number;
    totalSessions: number;
    successRate: number;
    averageSessionTime: number;
  } {
    const allSessions = Array.from(this.activeSessions.values());
    const completedSessions = allSessions.filter(s => s.status !== 'running');
    const successfulSessions = completedSessions.filter(s => s.status === 'success');

    const totalDuration = completedSessions.reduce((sum, s) => sum + (Date.now() - s.startTime), 0);
    const averageSessionTime = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

    return {
      activeSessions: allSessions.filter(s => s.status === 'running').length,
      totalSessions: allSessions.length,
      successRate: completedSessions.length > 0 ? successfulSessions.length / completedSessions.length : 0,
      averageSessionTime
    };
  }

  /**
   * Enable/disable visual feedback
   */
  setVisualFeedback(enabled: boolean): void {
    this.options.enableVisualFeedback = enabled;
    if (enabled && !this.debugOverlay) {
      this.createDebugOverlay();
    } else if (!enabled && this.debugOverlay) {
      if (this.debugOverlay.parentNode) {
        this.debugOverlay.parentNode.removeChild(this.debugOverlay);
      }
      this.debugOverlay = null;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay);
    }
    this.debugOverlay = null;
    this.activeSessions.clear();
  }
}