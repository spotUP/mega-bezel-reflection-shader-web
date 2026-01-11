import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

// Setup JSDOM for browser-like environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

// Helper to safely define globals
const defineGlobal = (name, value) => {
  try {
    global[name] = value;
  } catch (e) {
    Object.defineProperty(global, name, {
      value: value,
      writable: true,
      configurable: true
    });
  }
};

defineGlobal('window', dom.window);
defineGlobal('document', dom.window.document);
defineGlobal('navigator', dom.window.navigator);
defineGlobal('HTMLCanvasElement', dom.window.HTMLCanvasElement);
defineGlobal('HTMLDivElement', dom.window.HTMLDivElement);

// Mock global.fetch for local file access
const originalFetch = global.fetch;
defineGlobal('fetch', async (input, init) => {
  let url = input.toString();

  // Handle local relative URLs
  if (url.startsWith('/') || url.startsWith('http://localhost')) {
    // Strip domain if present
    if (url.startsWith('http://localhost')) {
      url = url.replace('http://localhost', '');
    }

    // Strip query parameters
    url = url.split('?')[0];

    // Attempt to find the file in public or assets folders
    const tryPaths = [
      path.join(process.cwd(), 'public', url),
      path.join(process.cwd(), 'assets', url),
      path.join(process.cwd(), 'public', 'shaders', url),
      path.join(process.cwd(), url) // Try absolute path relative to cwd
    ];

    for (const tryPath of tryPaths) {
      if (fs.existsSync(tryPath) && fs.statSync(tryPath).isFile()) {
        const content = fs.readFileSync(tryPath, 'utf8');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => content,
          json: async () => JSON.parse(content),
          headers: new Map()
        };
      }
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'File not found',
      json: async () => ({ error: 'File not found' }),
      headers: new Map()
    };
  }

  // Fallback to original fetch for remote URLs (if needed/available)
  if (originalFetch) {
    return originalFetch(input, init);
  }

  throw new Error(`Fetch not implemented for URL: ${url}`);
});


// Mock WebGL context for headless validation
const mockWebGLContext = {
  getParameter: () => ({}),
  getExtension: () => null,
  createShader: () => ({}),
  shaderSource: () => {},
  compileShader: () => {},
  getShaderParameter: () => true,
  getShaderInfoLog: () => '',
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  getProgramParameter: () => true,
  getProgramInfoLog: () => '',
  useProgram: () => {},
  getUniformLocation: () => ({}),
  uniform1f: () => {},
  uniform2f: () => {},
  uniform3f: () => {},
  uniform4f: () => {},
  uniform1i: () => {},
  uniformMatrix4fv: () => {},
  createTexture: () => ({}),
  bindTexture: () => {},
  texParameteri: () => {},
  texImage2D: () => {},
  createFramebuffer: () => ({}),
  bindFramebuffer: () => {},
  framebufferTexture2D: () => {},
  createRenderbuffer: () => ({}),
  bindRenderbuffer: () => {},
  renderbufferStorage: () => {},
  framebufferRenderbuffer: () => {},
  checkFramebufferStatus: () => 36053, // FRAMEBUFFER_COMPLETE
  viewport: () => {},
  clear: () => {},
  drawArrays: () => {},
  VERTEX_SHADER: 35633,
  FRAGMENT_SHADER: 35632,
  COMPILE_STATUS: 35713,
  LINK_STATUS: 35714,
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  COLOR_ATTACHMENT0: 36064,
  FRAMEBUFFER: 36160,
  RENDERBUFFER: 36161,
  DEPTH_COMPONENT16: 33189,
  TEXTURE_MIN_FILTER: 10241,
  TEXTURE_MAG_FILTER: 10240,
  LINEAR: 9729,
  NEAREST: 9728,
  CLAMP_TO_EDGE: 33071
};

// Mock THREE.js WebGLRenderer
class MockWebGLRenderer {
  constructor() {
    this.context = mockWebGLContext;
    this.capabilities = {
      maxTextures: 16,
      maxVertexTextures: 16,
      maxTextureSize: 4096,
      maxCubemapSize: 4096,
      maxRenderbufferSize: 4096,
      maxViewportDims: [4096, 4096],
      isWebGL2: true
    };
    this.info = {
      render: { calls: 0, triangles: 0 },
      memory: { textures: 0, geometries: 0 }
    };
  }

  getContext() { return this.context; }
  setSize() {}
  setRenderTarget() {}
  clear() {}
  render() {}
  dispose() {}
}

// Import our validation modules (after JSDOM setup)
let AutomatedShaderValidation;
let ShaderErrorLogger;

async function loadModules() {
  // Dynamic import to work with JSDOM setup
  const validationModule = await import('../src/shaders/AutomatedShaderValidation.ts');
  const loggerModule = await import('../src/shaders/ShaderErrorLogger.ts');

  AutomatedShaderValidation = validationModule.AutomatedShaderValidation;
  ShaderErrorLogger = loggerModule.ShaderErrorLogger;
}

class ShaderValidator {
  constructor(options = {}) {
    this.options = {
      preset: null,
      all: false,
      strict: false,
      json: false,
      junit: false,
      threshold: 90,
      timeout: 30000,
      ...options
    };

    this.results = {
      success: false,
      totalShaders: 0,
      validatedShaders: 0,
      failedShaders: 0,
      errors: [],
      warnings: [],
      startTime: Date.now(),
      endTime: null,
      successRate: 0
    };
  }

  async run() {
    console.log('🚀 Starting Shader Validation...');

    try {
      await loadModules();

      // Create mock renderer for validation
      const mockRenderer = new MockWebGLRenderer();

      // Initialize validation system
      const validator = new AutomatedShaderValidation({
        failOnWarnings: this.options.strict,
        timeout: this.options.timeout
      });

      const logger = ShaderErrorLogger.getInstance();

      let validationResult;

      if (this.options.preset) {
        // Validate specific preset
        console.log(`📋 Validating preset: ${this.options.preset}`);
        validationResult = await this.validatePreset(this.options.preset, validator);
      } else if (this.options.all) {
        // Validate all shaders
        console.log('📋 Validating all shaders...');
        validationResult = await validator.validateAll();
      } else {
        throw new Error('Must specify --preset <path> or --all');
      }

      // Process results
      this.processResults(validationResult);

      // Generate reports
      if (this.options.json) {
        this.outputJsonReport();
      }

      if (this.options.junit) {
        this.outputJUnitReport();
      }

      // Check threshold
      if (this.results.successRate < this.options.threshold) {
        console.error(`❌ Validation failed: Success rate ${this.results.successRate}% below threshold ${this.options.threshold}%`);
        process.exit(1);
      }

      console.log(`✅ Validation completed with ${this.results.successRate}% success rate`);

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      this.results.errors.push(error.message);
      process.exit(1);
    }
  }

  async validatePreset(presetPath, validator) {
    // For preset validation, we need to check if the preset file exists
    // and perform basic structure validation
    try {
      const fullPath = path.join(process.cwd(), 'public', presetPath);
      const content = fs.readFileSync(fullPath, 'utf8');

      // Basic preset validation
      const lines = content.split('\n');
      let hasShaders = false;
      let validStructure = true;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('shader') && trimmed.includes('=')) {
          hasShaders = true;
        }
        if (trimmed.includes('=') && !trimmed.startsWith('#') && !hasShaders) {
          validStructure = false;
          break;
        }
      }

      if (!hasShaders || !validStructure) {
        return {
          success: false,
          totalShaders: 1,
          checkedShaders: 1,
          failedShaders: 1,
          errors: 1,
          warnings: 0,
          criticalFailures: ['Invalid preset structure'],
          shaderResults: [{
            path: presetPath,
            success: false,
            isCritical: true,
            error: 'Invalid preset file structure'
          }],
          summary: {
            compilationErrors: 0,
            missingFiles: 0,
            redefinitionErrors: 0,
            dependencyErrors: 0,
            performanceWarnings: 0,
            compatibilityWarnings: 0,
            recommendations: ['Check preset file format']
          }
        };
      }

      return {
        success: true,
        totalShaders: 1,
        checkedShaders: 1,
        failedShaders: 0,
        errors: 0,
        warnings: 0,
        criticalFailures: [],
        shaderResults: [{
          path: presetPath,
          success: true,
          isCritical: true
        }],
        summary: {
          compilationErrors: 0,
          missingFiles: 0,
          redefinitionErrors: 0,
          dependencyErrors: 0,
          performanceWarnings: 0,
          compatibilityWarnings: 0,
          recommendations: []
        }
      };

    } catch (error) {
      return {
        success: false,
        totalShaders: 1,
        checkedShaders: 1,
        failedShaders: 1,
        errors: 1,
        warnings: 0,
        criticalFailures: [error.message],
        shaderResults: [{
          path: presetPath,
          success: false,
          isCritical: true,
          error: error.message
        }],
        summary: {
          compilationErrors: 1,
          missingFiles: 0,
          redefinitionErrors: 0,
          dependencyErrors: 0,
          performanceWarnings: 0,
          compatibilityWarnings: 0,
          recommendations: ['Check if preset file exists']
        }
      };
    }
  }

  processResults(validationResult) {
    this.results.endTime = Date.now();
    this.results.totalShaders = validationResult.totalShaders;
    this.results.validatedShaders = validationResult.checkedShaders;
    this.results.failedShaders = validationResult.failedShaders;
    this.results.errors = validationResult.criticalFailures;
    this.results.warnings = validationResult.warnings || [];
    this.results.success = validationResult.success;
    this.results.successRate = this.results.totalShaders > 0
      ? ((this.results.totalShaders - this.results.failedShaders) / this.results.totalShaders) * 100
      : 0;

    // Output results
    console.log(`
📊 Validation Results:`);
    console.log(`   Total shaders: ${this.results.totalShaders}`);
    console.log(`   Validated: ${this.results.validatedShaders}`);
    console.log(`   Failed: ${this.results.failedShaders}`);
    console.log(`   Success rate: ${this.results.successRate.toFixed(1)}%`);

    if (validationResult.shaderResults) {
        const failed = validationResult.shaderResults.filter(r => !r.success);
        if (failed.length > 0) {
            console.log(`
🔍 Failed Shader Details:`);
            failed.forEach(f => {
                console.log(`
   ❌ ${f.path}`);
                if (f.error) console.log(`      Error: ${f.error}`);
                
                if (f.diagnosticResult && f.diagnosticResult.errors && f.diagnosticResult.errors.length > 0) {
                    f.diagnosticResult.errors.forEach(e => console.log(`      - [${e.type}] ${e.message} ${e.line ? `(Line ${e.line})` : ''}`));
                }
            });
        }
    }

    if (this.results.errors.length > 0) {
      console.log(`
❌ Critical Errors:`);
      this.results.errors.forEach(error => console.log(`   - ${error}`));
    }
  }

  outputJsonReport() {
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      metadata: {
        command: process.argv.join(' '),
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };

    const reportPath = 'shader-validation-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report saved to: ${reportPath}`);
  }

  outputJUnitReport() {
    const testSuites = [{
      name: 'Shader Validation',
      tests: this.results.totalShaders,
      failures: this.results.failedShaders,
      time: (this.results.endTime - this.results.startTime) / 1000,
      testcases: []
    }];

    // Add test cases for each shader
    // Note: In a real implementation, we'd have detailed per-shader results

    const xml = this.generateJUnitXML(testSuites);
    const reportPath = 'shader-validation-junit.xml';
    fs.writeFileSync(reportPath, xml);
    console.log(`📄 JUnit report saved to: ${reportPath}`);
  }

  generateJUnitXML(testSuites) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<testsuites>\n';

    testSuites.forEach(suite => {
      xml += `  <testsuite name="${suite.name}" tests="${suite.tests}" failures="${suite.failures}" time="${suite.time}">\n`;

      // Add individual test cases
      for (let i = 0; i < suite.tests; i++) {
        const status = i < suite.failures ? 'failure' : 'success';
        xml += `    <testcase name="shader_${i}" time="0.1">\n`;
        if (status === 'failure') {
          xml += `      <failure message="Shader validation failed"/>\n`;
        }
        xml += '    </testcase>\n';
      }

      xml += '  </testsuite>\n';
    });

    xml += '</testsuites>\n';
    return xml;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--preset':
        options.preset = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--junit':
        options.junit = true;
        break;
      case '--threshold':
        options.threshold = parseInt(args[++i]);
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

// Main execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs();
  const validator = new ShaderValidator(options);
  validator.run().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { ShaderValidator };
