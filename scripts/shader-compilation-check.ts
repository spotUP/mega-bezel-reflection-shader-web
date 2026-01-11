#!/usr/bin/env tsx

import { existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { SlangShaderCompiler } from '../src/shaders/SlangShaderCompiler';

interface ShaderCheck {
  name: string;
  description: string;
  check: () => Promise<{ success: boolean; message: string; details?: string }>;
}

interface ShaderResult {
  success: boolean;
  checks: Array<{
    name: string;
    success: boolean;
    message: string;
    details?: string;
  }>;
}

// Helper methods
function findShaderFiles(dir: string): string[] {
  const files: string[] = [];

  function scanDirectory(currentDir: string) {
    if (!existsSync(currentDir)) return;

    const items = readdirSync(currentDir);

    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        scanDirectory(fullPath);
      } else if (stats.isFile() && (item.endsWith('.slang') || item.endsWith('.slangp'))) {
        files.push(fullPath);
      }
    }
  }

  scanDirectory(dir);
  return files;
}

async function readFileContent(filePath: string): Promise<string> {
  // Use Node.js fs for reading files
  const fs = await import('fs');
  return fs.readFileSync(filePath, 'utf8');
}

function validatePresetFile(content: string, filePath: string): { valid: boolean; error?: string } {
  const lines = content.split('\n');
  let hasShaders = false;
  let hasTextures = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.includes('=')) {
      const [key] = trimmed.split('=', 2).map(s => s.trim());

      if (key.startsWith('shader')) {
        hasShaders = true;
      } else if (key === 'textures') {
        hasTextures = true;
      }
    }
  }

  if (!hasShaders) {
    return { valid: false, error: 'No shader definitions found' };
  }

  // Check for basic syntax
  const bracketCount = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
  if (bracketCount !== 0) {
    return { valid: false, error: 'Unmatched brackets' };
  }

  return { valid: true };
}

// Shader compilation verification checks
const SHADER_CHECKS: ShaderCheck[] = [
  {
    name: 'Shader Directory Structure',
    description: 'Verify shader directories and file organization',
    check: async () => {
      const shaderDir = join(process.cwd(), 'public', 'shaders');

      if (!existsSync(shaderDir)) {
        return {
          success: false,
          message: 'Shader directory not found',
          details: 'public/shaders directory is missing'
        };
      }

      const megaBezelDir = join(shaderDir, 'mega-bezel');
      if (!existsSync(megaBezelDir)) {
        return {
          success: false,
          message: 'Mega Bezel shader directory not found',
          details: 'public/shaders/mega-bezel directory is missing'
        };
      }

      const shadersSubDir = join(megaBezelDir, 'shaders');
      if (!existsSync(shadersSubDir)) {
        return {
          success: false,
          message: 'Mega Bezel shaders subdirectory not found',
          details: 'public/shaders/mega-bezel/shaders directory is missing'
        };
      }

      // Count shader files
      const shaderFiles = findShaderFiles(shaderDir);
      const slangFiles = shaderFiles.filter((f: string) => f.endsWith('.slang'));
      const slangpFiles = shaderFiles.filter((f: string) => f.endsWith('.slangp'));

      return {
        success: true,
        message: `Shader directories exist with ${slangFiles.length} .slang files and ${slangpFiles.length} .slangp files`
      };
    }
  },

  {
    name: 'Shader File Integrity',
    description: 'Check shader files for basic integrity (non-empty, readable)',
    check: async () => {
      const shaderDir = join(process.cwd(), 'public', 'shaders');
      const shaderFiles = findShaderFiles(shaderDir);
      const issues: string[] = [];

      for (const filePath of shaderFiles) {
        try {
          const stats = statSync(filePath);
          if (stats.size === 0) {
            issues.push(`${filePath.split('/').pop()} is empty`);
          } else if (stats.size < 100) {
            issues.push(`${filePath.split('/').pop()} is suspiciously small (${stats.size} bytes)`);
          }
        } catch (error: any) {
          issues.push(`${filePath.split('/').pop()}: ${error.message}`);
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Shader file integrity issues detected',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: `All ${shaderFiles.length} shader files are readable and non-empty`
      };
    }
  },

  {
    name: 'Preset File Validation',
    description: 'Validate Mega Bezel preset files (.slangp)',
    check: async () => {
      const megaBezelDir = join(process.cwd(), 'public', 'shaders', 'mega-bezel');
      const presetFiles = readdirSync(megaBezelDir)
        .filter(f => f.endsWith('.slangp'))
        .map(f => join(megaBezelDir, f));

      const issues: string[] = [];

      for (const presetPath of presetFiles) {
        try {
          const content = await readFileContent(presetPath);
          const validation = validatePresetFile(content, presetPath);

          if (!validation.valid) {
            issues.push(`${presetPath.split('/').pop()}: ${validation.error}`);
          }
        } catch (error: any) {
          issues.push(`${presetPath.split('/').pop()}: ${error.message}`);
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Preset file validation issues',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: `All ${presetFiles.length} preset files are valid`
      };
    }
  },

  {
    name: 'Shader Compilation Test',
    description: 'Test compilation of key shader files',
    check: async () => {
      const issues: string[] = [];
      const compiledShaders: string[] = [];

      // Test compilation of a few key shaders
      const testShaders = [
        'public/shaders/passthrough.slang',
        'public/shaders/pong-crt.slang',
        'public/shaders/mega-bezel/shaders/dogway/hsm-grade.slang'
      ];

      for (const shaderPath of testShaders) {
        const fullPath = join(process.cwd(), shaderPath);

        if (!existsSync(fullPath)) {
          issues.push(`${shaderPath}: file not found`);
          continue;
        }

        try {
          console.log(`Testing compilation of ${shaderPath}...`);
          const compiled = await SlangShaderCompiler.loadFromURL(`file://${fullPath}`, true);

          if (!compiled.vertex || !compiled.fragment) {
            issues.push(`${shaderPath}: compilation produced empty shaders`);
          } else if (compiled.vertex.length < 100 || compiled.fragment.length < 100) {
            issues.push(`${shaderPath}: compiled shaders are suspiciously small`);
          } else {
            compiledShaders.push(shaderPath.split('/').pop()!);
          }
        } catch (error: any) {
          issues.push(`${shaderPath}: compilation failed - ${error.message}`);
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Shader compilation issues detected',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: `Successfully compiled ${compiledShaders.length} test shaders: ${compiledShaders.join(', ')}`
      };
    }
  },

  {
    name: 'Common Shader Issues Check',
    description: 'Check for common shader compilation issues',
    check: async () => {
      const shaderDir = join(process.cwd(), 'public', 'shaders');
      const shaderFiles = findShaderFiles(shaderDir);
      const issues: string[] = [];

      for (const filePath of shaderFiles) {
        try {
          const content = await readFileContent(filePath);

          // Check for common issues
          const checks = [
            {
              pattern: /#define\s+(\w+)\s+.*\n.*#define\s+\1\s+/g,
              issue: 'Duplicate #define macro'
            },
            {
              pattern: /\bundefined\b/g,
              issue: 'Use of undefined identifier'
            },
            {
              pattern: /layout\s*\([^)]*\)\s*uniform\s+\w+\s*\{[^}]*$/g,
              issue: 'Unclosed uniform block'
            },
            {
              pattern: /#include\s+"[^"]*"[^}]*$/g,
              issue: 'Malformed #include directive'
            }
          ];

          for (const check of checks) {
            const matches = content.match(check.pattern);
            if (matches && matches.length > 0) {
              issues.push(`${filePath.split('/').pop()}: ${check.issue} (${matches.length} instances)`);
            }
          }

          // Check for syntax issues in .slang files
          if (filePath.endsWith('.slang')) {
            const syntaxChecks = [
              {
                pattern: /void\s+\w+\s*\([^)]*$/g,
                issue: 'Unclosed function declaration'
              },
              {
                pattern: /if\s*\([^)]*$/g,
                issue: 'Unclosed if statement'
              },
              {
                pattern: /for\s*\([^)]*$/g,
                issue: 'Unclosed for loop'
              }
            ];

            for (const check of syntaxChecks) {
              const matches = content.match(check.pattern);
              if (matches && matches.length > 0) {
                issues.push(`${filePath.split('/').pop()}: ${check.issue}`);
              }
            }
          }

        } catch (error: any) {
          issues.push(`${filePath.split('/').pop()}: ${error.message}`);
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          message: 'Common shader issues detected',
          details: issues.join('; ')
        };
      }

      return {
        success: true,
        message: `No common shader issues found in ${shaderFiles.length} files`
      };
    }
  }
];


// Run all shader compilation checks
async function runShaderCompilationChecks(): Promise<ShaderResult> {
  console.log('🔍 Shader Compilation Verification');
  console.log('===================================\n');

  const result: ShaderResult = {
    success: true,
    checks: []
  };

  for (const check of SHADER_CHECKS) {
    console.log(`🔍 Running: ${check.name}`);
    console.log(`   ${check.description}`);

    try {
      const checkResult = await check.check();
      result.checks.push({
        name: check.name,
        success: checkResult.success,
        message: checkResult.message,
        details: checkResult.details
      });

      if (checkResult.success) {
        console.log(`   ✅ ${checkResult.message}`);
        if (checkResult.details) {
          console.log(`      ${checkResult.details}`);
        }
      } else {
        console.log(`   ❌ ${checkResult.message}`);
        if (checkResult.details) {
          console.log(`      ${checkResult.details}`);
        }
        result.success = false;
      }
    } catch (error: any) {
      result.checks.push({
        name: check.name,
        success: false,
        message: `Check failed with error: ${error.message}`
      });

      console.log(`   💥 ${check.name} failed: ${error.message}`);
      result.success = false;
    }

    console.log('');
  }

  return result;
}

// Display results
function displayShaderResults(result: ShaderResult) {
  const passed = result.checks.filter(c => c.success);
  const failed = result.checks.filter(c => !c.success);

  console.log('📊 SHADER COMPILATION SUMMARY');
  console.log('==============================');

  if (passed.length > 0) {
    console.log(`✅ Passed: ${passed.length}`);
    passed.forEach(check => {
      console.log(`   • ${check.name}`);
    });
  }

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach(check => {
      console.log(`   • ${check.name}: ${check.message}`);
      if (check.details) {
        console.log(`     ${check.details}`);
      }
    });
  }

  console.log('');

  if (result.success) {
    console.log('🎉 SHADER COMPILATION VERIFIED');
    console.log('===============================');
    console.log('All shader compilation checks passed.');
  } else {
    console.log('❌ SHADER COMPILATION ISSUES DETECTED');
    console.log('======================================');
    console.log('Fix the failed checks before proceeding with deployment.');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    const result = await runShaderCompilationChecks();
    displayShaderResults(result);
  } catch (error: any) {
    console.error('💥 Shader compilation check system crashed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runShaderCompilationChecks, SHADER_CHECKS };