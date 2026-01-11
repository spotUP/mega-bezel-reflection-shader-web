/**
 * SlangShaderCompiler - Converts Slang GLSL shaders to WebGL GLSL
 *
 * Handles:
 * - Pragma directive extraction (#pragma parameter, #pragma stage, etc.)
 * - Slang uniform bindings → WebGL uniforms
 * - Vulkan GLSL → WebGL GLSL conversion
 * - Vertex and fragment shader stage separation
 */

// GLOBAL DEBUG FLAG - Set to false to silence verbose compilation logs
const VERBOSE_SHADER_LOGS = false;

import { IncludePreprocessor } from './IncludePreprocessor';
import { GlobalToVaryingConverter } from './GlobalToVaryingConverter';

export interface ShaderParameter {
  name: string;
  displayName: string;
  default: number;
  min: number;
  max: number;
  step: number;
}

export interface ShaderStage {
  source: string;
  type: 'vertex' | 'fragment';
}

export interface SamplerBinding {
  name: string;        // Sampler name (e.g., "LinearizePass", "Source")
  type: string;        // Sampler type (e.g., "sampler2D", "sampler3D")
  set: number;         // Vulkan descriptor set (usually 0)
  binding: number;     // Binding point within set
}

export interface CompiledShader {
  vertex: string;
  fragment: string;
  parameters: ShaderParameter[];
  uniforms: string[];
  samplers: string[];           // Legacy: just sampler names for backward compatibility
  samplerBindings: SamplerBinding[];  // Full sampler binding info for dynamic texture resolution
  name?: string;
  format?: string;
}

export interface UBOMember {
  type: string; // GLSL type (float, vec4, mat4, int, uint, etc.)
  name: string; // Member name
}

export interface UBOInfo {
  name: string;
  binding: number;
  members: UBOMember[];
  instanceName?: string;
}
export interface SlangUniformBinding {
  set: number;
  binding: number;
  type: 'ubo' | 'sampler' | 'pushConstant';
  name: string; // Type name for UBO/pushConstant, variable name for sampler
  instanceName?: string; // Instance name for pushConstant (e.g., "params")
  members?: UBOMember[]; // UBO members with type information
}

export interface GlobalDefinitions {
  functions: string[]; // Function definitions (e.g., "vec3 foo() { ... }")
  defines: string[];   // #define macros (e.g., "#define RW vec3(0.95, 1.0, 1.09)")
  consts: string[];    // const declarations (e.g., "const float PI = 3.14;")
  globals: string[];   // Mutable global variables (e.g., "vec2 SCREEN_SCALE = vec2(1);")
}

export class SlangShaderCompiler {
  /**
   * C Preprocessor - Resolve #if, #ifdef, #ifndef, #elif, #else, #endif directives
   * This handles conditional compilation that GLSL doesn't support natively
   */
  private static preprocessConditionals(source: string): string {
    const lines = source.split('\n');
    const defines = new Map<string, string>(); // Track defined macros
    const output: string[] = [];

    // Stack to track conditional blocks: {active: boolean, hasExecuted: boolean}
    const conditionalStack: Array<{active: boolean, hasExecuted: boolean}> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle #define
      if (trimmed.startsWith('#define ')) {
        const match = trimmed.match(/#define\s+(\w+)(?:\s+(.+))?/);
        if (match) {
          const name = match[1];
          const value = match[2] || '1'; // Default to 1 if no value
          defines.set(name, value);
        }
        // Keep the define line in output
        if (conditionalStack.length === 0 || conditionalStack.every(c => c.active)) {
          output.push(line);
        }
        continue;
      }

      // Handle #ifdef
      if (trimmed.startsWith('#ifdef ')) {
        const match = trimmed.match(/#ifdef\s+(\w+)/);
        if (match) {
          const name = match[1];
          const isDefined = defines.has(name);
          const parentActive = conditionalStack.length === 0 || conditionalStack.every(c => c.active);
          conditionalStack.push({active: parentActive && isDefined, hasExecuted: isDefined});
        }
        continue;
      }

      // Handle #ifndef
      if (trimmed.startsWith('#ifndef ')) {
        const match = trimmed.match(/#ifndef\s+(\w+)/);
        if (match) {
          const name = match[1];
          const isNotDefined = !defines.has(name);
          const parentActive = conditionalStack.length === 0 || conditionalStack.every(c => c.active);
          conditionalStack.push({active: parentActive && isNotDefined, hasExecuted: isNotDefined});
        }
        continue;
      }

      // Handle #if
      if (trimmed.startsWith('#if ')) {
        const condition = trimmed.substring(4).trim();
        const result = this.evaluateCondition(condition, defines);
        const parentActive = conditionalStack.length === 0 || conditionalStack.every(c => c.active);
        conditionalStack.push({active: parentActive && result, hasExecuted: result});
        continue;
      }

      // Handle #elif
      if (trimmed.startsWith('#elif ')) {
        if (conditionalStack.length > 0) {
          const current = conditionalStack[conditionalStack.length - 1];
          if (!current.hasExecuted) {
            const condition = trimmed.substring(6).trim();
            const result = this.evaluateCondition(condition, defines);
            const parentActive = conditionalStack.length === 1 || conditionalStack.slice(0, -1).every(c => c.active);
            current.active = parentActive && result;
            current.hasExecuted = result;
          } else {
            current.active = false;
          }
        }
        continue;
      }

      // Handle #else
      if (trimmed.startsWith('#else')) {
        if (conditionalStack.length > 0) {
          const current = conditionalStack[conditionalStack.length - 1];
          const parentActive = conditionalStack.length === 1 || conditionalStack.slice(0, -1).every(c => c.active);
          current.active = parentActive && !current.hasExecuted;
        }
        continue;
      }

      // Handle #endif
      if (trimmed.startsWith('#endif')) {
        if (conditionalStack.length > 0) {
          conditionalStack.pop();
        }
        continue;
      }

      // Regular line - include if all conditions are active
      if (conditionalStack.length === 0 || conditionalStack.every(c => c.active)) {
        // Skip lines that are just standalone numeric literals or expressions
        // These are likely artifacts from unresolved ternary operators
        const trimmedLine = trimmed;
        if (trimmedLine && /^[\d.]+$/.test(trimmedLine)) {
          // Skip standalone numbers like "0.0" or "1.0"
          console.warn('[Preprocessor] Skipping standalone numeric literal:', trimmedLine);
          continue;
        }
        output.push(line);
      }
    }

    return output.join('\n');
  }

  /**
   * Evaluate a preprocessor condition (#if expression)
   */
  private static evaluateCondition(condition: string, defines: Map<string, string>): boolean {
    try {
      // Replace defined(X) with true/false
      let expr = condition.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, name) => {
        return defines.has(name) ? '1' : '0';
      });

      // Replace macro names with their values
      defines.forEach((value, name) => {
        // Use word boundaries to avoid partial replacements
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        expr = expr.replace(regex, value);
      });

      // Handle ternary operators: replace (condition) ? true_val : false_val with the appropriate value
      // This is needed for defines like: #define FOO (X > 0) ? 1.0 : 0.0
      expr = expr.replace(/\(([^)]+)\)\s*\?\s*([^:]+)\s*:\s*(.+)/g, (match, cond, trueVal, falseVal) => {
        try {
          const condResult = Function(`'use strict'; return (${cond});`)();
          return condResult ? trueVal : falseVal;
        } catch {
          return falseVal; // Default to false value on error
        }
      });

      // Handle parentheses in conditions like #if (FXAA_PRESET == 5)
      expr = expr.replace(/[()]/g, '');

      // Simple expression evaluator for ==, !=, <, >, <=, >=, &&, ||
      // Convert to JavaScript and evaluate
      expr = expr.replace(/\s+/g, ' ').trim();

      // Convert C operators to JS
      expr = expr.replace(/&&/g, '&&').replace(/\|\|/g, '||');

      // Evaluate as JavaScript boolean expression
      // Note: This is safe because we control the input (shader source)
      const result = Function(`'use strict'; return (${expr});`)();
      return Boolean(result);
    } catch (e) {
      console.warn('[Preprocessor] Failed to evaluate condition:', condition, e);
      return false;
    }
  }

  /**
   * Compile a Slang shader to WebGL-compatible GLSL
   */
  public static compile(slangSource: string, webgl2 = true): CompiledShader {
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Starting compilation of shader, webgl2:', webgl2);

    // STEP 1: Run C preprocessor to resolve all conditional compilation
    slangSource = this.preprocessConditionals(slangSource);
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] C preprocessor pass completed');

    // Extract pragma directives first to get shader parameters
    const pragmas = this.extractPragmas(slangSource);
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Extracted pragmas:', pragmas);

    // Extract uniforms and bindings
    const bindings = this.extractBindings(slangSource);

    // Extract global definitions (functions, #defines, consts) before first #pragma stage
    // Pass parameter names AND UBO member names to avoid extracting constants that conflict
    const parameterNames = new Set(pragmas.parameters.map(p => p.name));
    const uboMemberNames = new Set<string>();
    for (const binding of bindings) {
      if (binding.type === 'ubo' && binding.members) {
        for (const member of binding.members) {
          uboMemberNames.add(member.name);
        }
      }
    }
    const excludeNames = new Set([...parameterNames, ...uboMemberNames]);

    // CRITICAL FIX: Strip UBO initializer lines BEFORE extracting globals
    // These lines like "float HSM_POTATO_COLORIZE_CRT_WITH_BG = global.HSM_POTATO_COLORIZE_CRT_WITH_BG / 100;"
    // cause redefinition errors because:
    // 1. The pragma creates a uniform with the name HSM_POTATO_COLORIZE_CRT_WITH_BG
    // 2. extractGlobalDefinitions would extract the assignment line as a "global"
    // 3. Both get injected, causing redefinition
    // Must happen BEFORE extraction AND BEFORE global./params. replacement
    // IMPORTANT: Only strip lines where variable name matches the UBO member name
    // Example: float X = global.X / 100; (strip this, it's redundant with uniform X)
    // But NOT: float y = global.X * global.Z; (keep this, it's a derived calculation)
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Stripping redundant UBO initializer lines before global extraction...');

    // Match pattern: float VARNAME = global.VARNAME or float VARNAME = params.VARNAME
    // Using backreference \1 to ensure variable name matches UBO member name
    // IMPORTANT: Only match EXACT assignment (no math operations like * or / after)
    // So "float X = global.X;" matches but "float X = global.X * 0.5;" does NOT
    const redundantUBOInitializers = /^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*(?:global\.|params\.)\1\s*;.*$/gm;
    const redundantMatches = slangSource.match(redundantUBOInitializers);
    if (redundantMatches && redundantMatches.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stripping ${redundantMatches.length} redundant UBO initializer lines (e.g., "${redundantMatches[0].trim().substring(0, 70)}...")`);
      slangSource = slangSource.replace(redundantUBOInitializers, '// [Stripped redundant UBO initializer]');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] No redundant UBO initializer lines found to strip`);
    }

    const globalDefs = this.extractGlobalDefinitions(slangSource, excludeNames);

    // Debug: Check if DEFAULT defines were extracted
    const defaultDefinesExtracted = globalDefs.defines.filter(d => d.includes('DEFAULT_'));

    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Extracted global definitions:', {
      functions: globalDefs.functions.length,
      defines: globalDefs.defines.length,
      consts: globalDefs.consts.length,
      globals: globalDefs.globals.length,
      excludedNames: excludeNames.size,
      defaultDefines: defaultDefinesExtracted.length
    });

    if (defaultDefinesExtracted.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] DEFAULT defines extracted:', defaultDefinesExtracted.slice(0, 5).map(d => d.substring(0, 60)));
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] WARNING: No DEFAULT_* defines extracted from source!');
    }

    // CRITICAL: Apply params./global. replacement BEFORE stage splitting
    // This ensures both vertex and fragment stages get the replacements
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Applying UBO prefix replacements before stage split...');

    // Replace params.X with just X (UBO instance name prefix removal)
    const beforeParamsCount = (slangSource.match(/\bparams\.\w+/g) || []).length;
    slangSource = slangSource.replace(/\bparams\.(\w+)\b/g, '$1');
    const afterParamsCount = (slangSource.match(/\bparams\.\w+/g) || []).length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] params. replacement: ${beforeParamsCount} -> ${afterParamsCount}`);

    // Replace global.X with just X (UBO instance name prefix removal)
    // BUT: Don't replace when it would create circular initialization
    // Pattern: float X = global.X * calc; should NOT become float X = X * calc;
    // Solution: Use negative lookbehind to avoid replacing when preceded by "float X ="
    const beforeGlobalCount = (slangSource.match(/\bglobal\.\w+/g) || []).length;

    // First pass: Replace global.X with X EXCEPT when it's a self-referential initialization
    // We'll do this line-by-line to check context
    const lines = slangSource.split('\n');
    const processedLines = lines.map(line => {
      // Check if this is a variable initialization: float VARNAME = global.VARNAME ...
      const initMatch = line.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*global\.(\w+)\b/);
      if (initMatch && initMatch[1] === initMatch[2]) {
        // This is self-referential! Don't replace global.VARNAME on this line
        // Instead, comment out the entire line
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Commenting out self-referential init: ${line.trim().substring(0, 80)}`);
        return '// ' + line + ' // REMOVED: self-referential initialization';
      }
      // Not self-referential, safe to replace all global.X with X on this line
      return line.replace(/\bglobal\.(\w+)\b/g, '$1');
    });
    slangSource = processedLines.join('\n');

    const afterGlobalCount = (slangSource.match(/\bglobal\.\w+/g) || []).length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] global. replacement: ${beforeGlobalCount} -> ${afterGlobalCount}`);

    // CRITICAL: After params./global. replacement, remove self-referential #defines AND variable initializations
    // Example #define: #define CSHARPEN params.CSHARPEN -> #define CSHARPEN CSHARPEN (after replacement) -> REMOVED
    // Example variable: float X = global.X * 0.5 -> float X = X * 0.5 (circular!) -> COMMENTED OUT
    // These become circular references after params./global. prefix removal
    const beforeSelfRefCount = (slangSource.match(/#define\s+(\w+)\s+\1\b/g) || []).length;
    slangSource = slangSource.replace(/#define\s+(\w+)\s+\1\b/g, '// Removed self-referential define: $1');
    const afterSelfRefCount = (slangSource.match(/#define\s+(\w+)\s+\1\b/g) || []).length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Self-referential #define removal: ${beforeSelfRefCount} -> ${afterSelfRefCount}`);

    // CRITICAL: Also remove self-referential global variable initializations
    // Pattern: float HSM_FRM_OUTER_EDGE_THICKNESS = HSM_FRM_OUTER_EDGE_THICKNESS * 0.00006;
    // This happens when: float X = global.X * calc becomes float X = X * calc (circular!)
    // We need to comment out the entire initialization line
    const beforeSelfRefVarCount = (slangSource.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*\1\b/gm) || []).length;
    slangSource = slangSource.replace(/^(\s*)((?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*\3\b[^;]*;)/gm, '$1// Removed self-referential variable init: $2');
    const afterSelfRefVarCount = (slangSource.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*\1\b/gm) || []).length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Self-referential variable init removal: ${beforeSelfRefVarCount} -> ${afterSelfRefVarCount}`);

    // CRITICAL: Also clean globalDefs.defines to remove self-referential defines
    // The defines in globalDefs were extracted BEFORE params./global. replacement
    // So they contain #define CSHARPEN params.CSHARPEN, which after replacement becomes #define CSHARPEN CSHARPEN
    // We need to apply the same params./global. replacement to globalDefs.defines and remove self-referential ones
    const beforeGlobalDefsCount = globalDefs.defines.length;
    globalDefs.defines = globalDefs.defines.map(def => {
      // Apply params./global. replacement to each define
      return def.replace(/\bparams\.(\w+)\b/g, '$1').replace(/\bglobal\.(\w+)\b/g, '$1');
    }).filter(def => {
      // Remove self-referential defines (e.g., #define CSHARPEN CSHARPEN)
      const match = def.match(/^#define\s+(\w+)\s+(\w+)/);
      if (match && match[1] === match[2]) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removing self-referential define from globalDefs: ${def.trim()}`);
        return false;
      }
      return true;
    });
    const afterGlobalDefsCount = globalDefs.defines.length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] globalDefs.defines cleaned: ${beforeGlobalDefsCount} -> ${afterGlobalDefsCount}`);

    // CRITICAL: Also clean globalDefs.globals to remove self-referential variable initializations
    // Pattern: float HSM_FRM_OUTER_EDGE_THICKNESS = global.HSM_FRM_OUTER_EDGE_THICKNESS * 0.00006;
    // After replacement: float HSM_FRM_OUTER_EDGE_THICKNESS = HSM_FRM_OUTER_EDGE_THICKNESS * 0.00006; (circular!)
    const beforeGlobalDefsGlobalsCount = globalDefs.globals.length;
    globalDefs.globals = globalDefs.globals.map(glob => {
      // Apply params./global. replacement to each global
      return glob.replace(/\bparams\.(\w+)\b/g, '$1').replace(/\bglobal\.(\w+)\b/g, '$1');
    }).filter(glob => {
      // Remove self-referential variable initializations
      // Pattern: float VARNAME = VARNAME ...
      const match = glob.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*=\s*(\w+)\b/);
      if (match && match[1] === match[2]) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removing self-referential global init from globalDefs: ${glob.trim().substring(0, 80)}`);
        return false;
      }
      return true;
    });
    const afterGlobalDefsGlobalsCount = globalDefs.globals.length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] globalDefs.globals cleaned: ${beforeGlobalDefsGlobalsCount} -> ${afterGlobalDefsGlobalsCount}`);

    // CRITICAL: Also clean globalDefs.functions to replace params./global. prefixes
    // Functions were extracted BEFORE params./global. replacement, so they still contain the prefixes
    // Example: global.no_scanlines must become no_scanlines (which will then use PARAM_no_scanlines uniform)
    const beforeGlobalDefsFunctionsCount = globalDefs.functions.length;
    globalDefs.functions = globalDefs.functions.map(func => {
      // Apply params./global. replacement to each function
      return func.replace(/\bparams\.(\w+)\b/g, '$1').replace(/\bglobal\.(\w+)\b/g, '$1');
    });
    const afterGlobalDefsFunctionsCount = globalDefs.functions.length;
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] globalDefs.functions cleaned: ${beforeGlobalDefsFunctionsCount} -> ${afterGlobalDefsFunctionsCount} (params./global. prefixes removed)`);

    // Split into stages
    const stages = this.splitStages(slangSource);

    // Convert vertex shader
    const vertexStage = stages.find(s => s.type === 'vertex');
    let vertexShader = vertexStage
      ? this.convertToWebGL(vertexStage.source, 'vertex', bindings, webgl2, pragmas.parameters, globalDefs)
      : this.generateDefaultVertexShader(webgl2);

    // Convert fragment shader
    const fragmentStage = stages.find(s => s.type === 'fragment');
    if (!fragmentStage) {
      throw new Error('No fragment shader stage found');
    }

    // Guest CRT function injection is no longer needed - functions are extracted from globalDefs

    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] About to convert fragment shader, fragmentStage.source.length =', fragmentStage.source.length);
    let fragmentShader: string;
    try {
      fragmentShader = this.convertToWebGL(fragmentStage.source, 'fragment', bindings, webgl2, pragmas.parameters, globalDefs);
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Fragment shader conversion completed, length =', fragmentShader.length);

      // DEBUG: Dump uniforms and defines for afterglow shader (has PARAM_PR)
      if (fragmentShader.includes('PARAM_PR') || fragmentShader.includes('PARAM_PG')) {
        const lines = fragmentShader.split('\n').slice(0, 100);
        console.log(`[DEBUG AFTERGLOW FRAGMENT - Uniforms and Defines in first 100 lines]`);
        lines.forEach((line, i) => {
          if (line.includes('uniform') || line.includes('#define P') || line.includes('PARAM_')) {
            console.log(`  ${i+1}: ${line}`);
          }
        });
        console.log(`[DEBUG AFTERGLOW END]`);
      }

    } catch (error) {
      console.error('[SlangCompiler] FATAL ERROR during fragment shader conversion:', error);
      console.error('[SlangCompiler] Error type:', typeof error);
      console.error('[SlangCompiler] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[SlangCompiler] Error stack:', error instanceof Error ? error.stack : 'no stack');
      throw error;
    }

    // CRITICAL: Convert mutable globals to varyings for WebGL compatibility
    // This fixes the architectural issue where globals set in vertex shader are accessed in fragment shader
    // TEMPORARILY DISABLED for Pure WebGL2 testing - the converter has redefinition bugs
    if (false && globalDefs.globals.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Applying global-to-varying conversion...');
      const converter = new GlobalToVaryingConverter(webgl2);

      // Reconstruct globals.inc source from globalDefs.globals
      const globalsIncSource = globalDefs.globals.join('\n');

      const converted = converter.convertGlobalsToVaryings(
        vertexShader,
        fragmentShader,
        globalsIncSource
      );

      vertexShader = converted.vertex;
      fragmentShader = converted.fragment;
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Global-to-varying conversion complete');
    } else if (globalDefs.globals.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] SKIPPING global-to-varying conversion (testing without it)');
    }

    // Fix WebGL incompatibilities based on target version
    // DEBUG: Check if layout qualifiers exist BEFORE fixWebGLIncompatibilities
    const hasLayoutBeforeFix = /layout\s*\(\s*location\s*=\s*\d+\s*\)\s*in\s+vec[24]\s+(Position|TexCoord)/.test(vertexShader);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Before fixWebGLIncompatibilities: layout qualifiers present = ${hasLayoutBeforeFix}`);

    const fixedVertex = this.fixWebGLIncompatibilities(vertexShader, webgl2);

    // DEBUG: Check if layout qualifiers exist AFTER fixWebGLIncompatibilities
    const hasLayoutAfterFix = /layout\s*\(\s*location\s*=\s*\d+\s*\)\s*in\s+vec[24]\s+(Position|TexCoord)/.test(fixedVertex);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] After fixWebGLIncompatibilities: layout qualifiers present = ${hasLayoutAfterFix}`);

    let fixedFragment = this.fixWebGLIncompatibilities(fragmentShader, webgl2);

    // Fix float/int comparison issues (mainly in fragment shader for layer comparisons)
    fixedFragment = this.fixFloatIntComparisons(fixedFragment);

    const result = {
      vertex: fixedVertex,
      fragment: fixedFragment,
      parameters: pragmas.parameters,
      uniforms: this.extractUniformNames(bindings),
      samplers: this.extractSamplerNames(bindings),
      samplerBindings: this.extractSamplerBindings(bindings),
      name: pragmas.name,
      format: pragmas.format
    };

    // DEBUG: Dump Guest CRT fragment shader source around line 3166 if it's the right shader
    if (pragmas.name && pragmas.name.includes('guest-advanced')) {
      const lines = fixedFragment.split('\n');
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] DEBUG Guest CRT fragment source around line 3166:');
      for (let i = 3160; i < 3170 && i < lines.length; i++) {
        console.log(`${i + 1}: ${lines[i]}`);
      }
    }

    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Compilation completed successfully');
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Final result:', {
      vertexLength: result.vertex.length,
      fragmentLength: result.fragment.length,
      parameters: result.parameters.length,
      uniforms: result.uniforms.length,
      samplers: result.samplers.length
    });

    return result;
  }

  /**
   * Extract #pragma directives
   */
  private static extractPragmas(source: string): {
    parameters: ShaderParameter[];
    name?: string;
    format?: string;
  } {
    const parameters: ShaderParameter[] = [];
    let name: string | undefined;
    let format: string | undefined;

    const lines = source.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // #pragma parameter NAME "Display Name" DEFAULT MIN MAX STEP
      if (trimmed.startsWith('#pragma parameter')) {
        const match = trimmed.match(
          /#pragma\s+parameter\s+(\w+)\s+"([^"]+)"\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)/
        );

        if (match) {
          parameters.push({
            name: match[1],
            displayName: match[2],
            default: parseFloat(match[3]),
            min: parseFloat(match[4]),
            max: parseFloat(match[5]),
            step: parseFloat(match[6])
          });
        }
      }

      // #pragma name ShaderName
      if (trimmed.startsWith('#pragma name')) {
        const match = trimmed.match(/#pragma\s+name\s+(\w+)/);
        if (match) {
          name = match[1];
        }
      }

      // #pragma format FORMAT_NAME
      if (trimmed.startsWith('#pragma format')) {
        const match = trimmed.match(/#pragma\s+format\s+([\w_]+)/);
        if (match) {
          format = match[1];
        }
      }
    }

    return { parameters, name, format };
  }

  /**
   * Extract global definitions (functions, #defines, consts) from before first #pragma stage
   */
  private static extractGlobalDefinitions(source: string, excludeNames: Set<string> = new Set()): GlobalDefinitions {
    const functions: string[] = [];
    const defines: string[] = [];
    const consts: string[] = [];
    const globals: string[] = [];

    const lines = source.split('\n');

    // Find the first #pragma stage directive
    let firstStageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#pragma stage')) {
        firstStageIndex = i;
        break;
      }
    }

    // If no stage found, return empty
    if (firstStageIndex === -1) {
      return { functions, defines, consts, globals };
    }

    // Extract everything before first #pragma stage
    const globalSection = lines.slice(0, firstStageIndex).join('\n');

    // Debug: Check if HRG_MAX_POINT_CLOUD_SIZE is in global section
    if (globalSection.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] HRG_MAX_POINT_CLOUD_SIZE is in globalSection');
      const hrgDefineMatch = globalSection.match(/#define\s+HRG_MAX_POINT_CLOUD_SIZE\s+\d+/);
      if (hrgDefineMatch) {
        if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Found HRG define:', hrgDefineMatch[0]);
      }
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] WARNING: HRG_MAX_POINT_CLOUD_SIZE NOT in globalSection!');
    }

    // Extract #define macros (single line)
    // CRITICAL: Must match both simple defines AND macro functions
    // Simple: #define TAPS 4
    // Macro function: #define kernel(x) exp(-GLOW_FALLOFF * (x) * (x))
    // Pattern: #define followed by identifier, optionally followed by (params), then rest of line
    const definePattern = /^[ \t]*#define\s+\w+(?:\([^)]*\))?(?:\s+.*)?$/gm;
    let defineMatch;
    let defineCount = 0;
    while ((defineMatch = definePattern.exec(globalSection)) !== null) {
      const defineLine = defineMatch[0].trim();

      // Don't skip defines that reference UBO members - they need to be extracted
      // and will have prefixes stripped after UBO-to-uniform conversion
      // Examples: #define beamg global.g_CRT_bg, #define signal params.g_signal_type

      defines.push(defineLine);
      defineCount++;

      // Debug: Log if we extract HRG define
      if (defineLine.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] EXTRACTED HRG define at match ${defineCount}:`, defineLine);
      }
    }

    // Debug: Check if we extracted HRG define
    const hasHrgDefine = defines.some(d => d.includes('HRG_MAX_POINT_CLOUD_SIZE'));
    if (globalSection.includes('HRG_MAX_POINT_CLOUD_SIZE') && !hasHrgDefine) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ERROR: HRG define was in globalSection but NOT extracted!');
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Total defines extracted:', defines.length);
    }

    // IMPORTANT: Extract function definitions FIRST to track their positions
    // This prevents extracting local variables inside functions as globals
    // Pattern: return_type function_name(params) { ... }
    // Match common GLSL types: void, float, int, vec2-4, mat2-4, mat3x3, etc.
    // Handle multi-line function signatures: params and opening brace can span multiple lines
    // Use a simpler pattern that just matches the start, then manually find the matching parens
    const functionStartPattern = /^[ \t]*(?:void|float|int|uint|bool|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4])\s+(\w+)\s*\(/gm;
    const functionRanges: Array<{start: number, end: number}> = [];

    let funcMatch;
    let extractedCount = 0;
    while ((funcMatch = functionStartPattern.exec(globalSection)) !== null) {
      const startPos = funcMatch.index;
      const funcName = funcMatch[1];

      // Find matching closing parenthesis for parameters
      let parenCount = 1;
      let pos = funcMatch.index + funcMatch[0].length;

      while (pos < globalSection.length && parenCount > 0) {
        if (globalSection[pos] === '(') parenCount++;
        if (globalSection[pos] === ')') parenCount--;
        pos++;
      }

      if (parenCount !== 0) {
        console.warn(`[SlangCompiler] Failed to find closing parenthesis for function: ${funcName}`);
        continue;
      }

      // Now find the opening brace (may be after whitespace/newlines and comments)
      while (pos < globalSection.length) {
        const char = globalSection[pos];
        if (/\s/.test(char)) {
          // Skip whitespace
          pos++;
        } else if (char === '/' && pos + 1 < globalSection.length && globalSection[pos + 1] === '/') {
          // Skip single-line comment
          while (pos < globalSection.length && globalSection[pos] !== '\n') {
            pos++;
          }
          // Skip the newline too
          if (pos < globalSection.length && globalSection[pos] === '\n') {
            pos++;
          }
        } else if (char === '/' && pos + 1 < globalSection.length && globalSection[pos + 1] === '*') {
          // Skip multi-line comment
          pos += 2; // Skip /*
          while (pos + 1 < globalSection.length && !(globalSection[pos] === '*' && globalSection[pos + 1] === '/')) {
            pos++;
          }
          if (pos + 1 < globalSection.length) {
            pos += 2; // Skip */
          }
        } else if (char === '{') {
          // Found the opening brace
          break;
        } else {
          // Unexpected character - check if it's a valid function signature continuation
          // Allow letters, numbers, underscores, commas, parentheses (for complex signatures)
          if (/[a-zA-Z0-9_,()[\]]/.test(char)) {
            // This might be part of a multi-line function signature, continue
            pos++;
          } else {
            // Unexpected character
            console.warn(`[SlangCompiler] Unexpected character '${char}' at position ${pos} when looking for opening brace for function: ${funcName}`);
            pos = -1; // Mark as failed
            break;
          }
        }
      }

      if (pos === -1 || pos >= globalSection.length || globalSection[pos] !== '{') {
        console.warn(`[SlangCompiler] Failed to find opening brace for function: ${funcName}`);
        continue;
      }

      // DON'T skip the opening brace - we want to include it in the extracted function
      // pos now points to '{', and we'll include it by starting braceCount at 0

      // Find matching closing brace for function body
      let braceCount = 0; // Start at 0 so first { increments to 1
      while (pos < globalSection.length && braceCount >= 0) {
        if (globalSection[pos] === '{') braceCount++;
        if (globalSection[pos] === '}') braceCount--;
        pos++;
        if (braceCount === 0) break; // Found matching closing brace
      }

      if (braceCount === 0) {
        const functionCode = globalSection.substring(startPos, pos).trim();

        // Extract ALL functions - no stubs, extract the real implementations
        functions.push(functionCode);
        functionRanges.push({ start: startPos, end: pos });
        extractedCount++;

        // Debug: Log first few extracted functions and critical ones
        if (extractedCount <= 5 || funcName === 'HSM_GetNoScanlineMode' || funcName === 'HSM_GetUseFakeScanlines' || funcName === 'hrg_get_ideal_global_eye_pos_for_points' || funcName === 'hrg_get_ideal_global_eye_pos') {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Extracted function ${extractedCount}: ${funcName} (${functionCode.length} chars, first 100): ${functionCode.substring(0, 100).replace(/\n/g, ' ')}`);
        }
      } else {
        console.warn(`[SlangCompiler] Failed to find closing brace for function: ${funcName}`);
      }
    }

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Total functions extracted from global section: ${extractedCount}`);

    // Track UBO/push constant block ranges to avoid extracting members as globals
    const uboBlockRanges: Array<{start: number, end: number}> = [];
    const uboPattern = /layout\s*\([^)]*\)\s*uniform\s+\w+\s*\{/g;
    let uboMatch;
    while ((uboMatch = uboPattern.exec(globalSection)) !== null) {
      const startPos = uboMatch.index;
      let pos = startPos + uboMatch[0].length;
      let braceCount = 1;

      // Find closing brace
      while (pos < globalSection.length && braceCount > 0) {
        if (globalSection[pos] === '{') braceCount++;
        if (globalSection[pos] === '}') braceCount--;
        pos++;
      }

      if (braceCount === 0) {
        uboBlockRanges.push({ start: startPos, end: pos });
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Tracked UBO block range: ${startPos}-${pos}`);
      }
    }

    // Helper function to check if a position is inside any function body or UBO block
    const isInsideFunction = (pos: number): boolean => {
      return functionRanges.some(range => pos >= range.start && pos < range.end);
    };

    const isInsideUBOBlock = (pos: number): boolean => {
      return uboBlockRanges.some(range => pos >= range.start && pos < range.end);
    };

    // Extract const declarations (single line) - skip if inside functions
    const constPattern = /^[ \t]*const\s+\w+\s+\w+\s*=\s*[^;]+;/gm;
    let constMatch;
    while ((constMatch = constPattern.exec(globalSection)) !== null) {
      if (!isInsideFunction(constMatch.index)) {
        consts.push(constMatch[0].trim());
      }
    }

    // Extract mutable global scalar/vector/matrix/bool variables (NOT const - these are reassigned in shader code)
    // IMPORTANT: Skip variables inside function bodies (local variables)
    // Note: Making these mutable (not const) because many are reassigned in shader code (e.g., SCREEN_INDEX)
    // Allow both UPPERCASE and lowercase variable names

    const extractedGlobalNames = new Set<string>();

    // Common uniform names that should never be extracted as globals
    const commonUniformNames = new Set([
      'SourceSize', 'OriginalSize', 'OutputSize', 'FrameCount', 'FrameDirection',
      'MVP', 'FinalViewportSize', 'DerezedPassSize', 'OriginalFeedbackSize'
    ]);

    // Pattern 1: Initialized globals - float/vec2/mat4/bool variable_name = value;
    const mutableGlobalPattern = /^[ \t]*((?:float|int|uint|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4]|bool))\s+(\w+)\s*=\s*([^;]+);/gm;
    let mutableMatch;
    let mutableGlobalsProcessed = 0;
    while ((mutableMatch = mutableGlobalPattern.exec(globalSection)) !== null) {
      if (isInsideFunction(mutableMatch.index) || isInsideUBOBlock(mutableMatch.index)) continue;

      const type = mutableMatch[1];
      const name = mutableMatch[2];
      let value = mutableMatch[3];
      mutableGlobalsProcessed++;

      // Debug first 5 HSM_ variables
      if (name.startsWith('HSM_') && mutableGlobalsProcessed <= 5) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Processing HSM global ${mutableGlobalsProcessed}: ${name} = ${value.substring(0, 50)}, inExcludeNames=${excludeNames.has(name)}`);
      }

      // Skip if this name conflicts with a shader parameter or common uniform
      // SOLUTION A (DUAL DECLARATION): For pragma parameters in excludeNames,
      // they ALL become PARAM_-prefixed uniforms, so skip them entirely
      // We'll provide default values when setting uniforms instead
      if (excludeNames.has(name)) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Skipping pragma parameter '${name}' (will become PARAM_ uniform)`);
        continue;
      }

      if (commonUniformNames.has(name)) {
        continue;
      }

      // CRITICAL FIX: Skip globals that initialize from global.X or params.X
      // These reference UBO members that will become uniforms, and extracting the global causes redefinition
      // Example: float HSM_POTATO_COLORIZE_CRT_WITH_BG = global.HSM_POTATO_COLORIZE_CRT_WITH_BG / 100;
      // The pragma parameter creates uniform HSM_POTATO_COLORIZE_CRT_WITH_BG, so don't also create a global
      if (value.includes('global.') || value.includes('params.')) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping global '${name}' (initializes from UBO: ${value.trim().substring(0, 50)})`);
        continue;
      }

      // AGGRESSIVE FIX: Skip ALL HSM_* variables that initialize from calculations
      // These are Mega Bezel shader parameters that get uniforms from pragmas
      // but also have local assignment statements like: float HSM_X = global.HSM_X / 100;
      // The pragma creates the uniform, so we should NOT extract the assignment as a global
      if (name.startsWith('HSM_') && (value.includes('/') || value.includes('*') || value.includes('+') || value.includes('-'))) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping HSM_ parameter calculation: ${name} = ${value.trim().substring(0, 40)}`);
        continue;
      }

      // CRITICAL FIX: For coordinate/scale/mask variables that get calculated dynamically,
      // declare them WITHOUT initializers (they're recalculated in shader functions)
      // Initializing them causes "l-value required (can't modify a const)" errors
      const isDynamicVariable =
        name.includes('_COORD') || name.includes('_CURVED_') ||
        name.includes('_SCALE') || name.includes('_MASK') ||
        name.includes('_SIZE') || name.includes('_ASPECT') ||
        name.includes('_POS') || name.includes('_OFFSET') ||
        name.includes('NEGATIVE_CROP') || name.includes('SAMPLING_') ||
        name.includes('USE_VERTICAL') || name.includes('USE_GEOM') ||
        name.includes('CACHE_INFO_CHANGED') || name.includes('CURRENT_FRAME') ||
        name.includes('AVERAGE_LUMA') || name.includes('VIEWPORT_') ||
        name.includes('FOLLOW_MODE') ||
        name.includes('INFOCACHE') || name.includes('DEFAULT_BEZEL') ||
        name.includes('DEFAULT_SCREEN') ||
        name === 'interm' || name === 'iscan';  // Interlacing variables

      if (isDynamicVariable) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Dynamic variable (declared without initializer): ${name}`);
        // Add as uninitialized global (declaration only, no initializer)
        globals.push(`${type} ${name};`);
        extractedGlobalNames.add(name);
        continue;
      }

      // Skip if initializer contains function calls or undefined references
      // (these are likely inside function bodies that weren't caught by isInsideFunction)
      if (value.includes('min(') || value.includes('max(') || value.includes('sqrt(') ||
          value.includes('in_coord') || value.includes('screen_aspect') ||
          value.includes('corner_radius') || value.includes('edge_sharpness')) {
        continue;
      }

      // Convert integer literals to float literals for float type (GLSL requires float = 1.0, not 1)
      if (type === 'float' && /^-?\d+$/.test(value.trim())) {
        value = value.trim() + '.0';
      }

      // Keep as mutable global (no const) - these variables are reassigned in shader code
      globals.push(`${type} ${name} = ${value};`);
      extractedGlobalNames.add(name);
    }

    // Pattern 2: Uninitialized globals - float variable_name;
    // IMPORTANT: Handle multiple declarations on same line (e.g., "float X; float Y;")
    // Split by newline first, then process each line to find all declarations
    const globalLines = globalSection.split('\n');
    for (let lineIdx = 0; lineIdx < globalLines.length; lineIdx++) {
      const line = globalLines[lineIdx];

      // CRITICAL FIX: Skip lines that start with "uniform" - those are uniform declarations, not globals
      // Example: "uniform float PARAM_PR;" should NOT be extracted as a global
      if (line.trim().startsWith('uniform ')) {
        continue;
      }

      // Match ALL uninitialized variable declarations on this line
      // Pattern: (type) (name);
      const uninitPattern = /(float|int|uint|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4]|bool)\s+(\w+)\s*;/g;
      let match;

      while ((match = uninitPattern.exec(line)) !== null) {
        // Estimate position in globalSection for isInsideFunction check
        const lineStartPos = globalLines.slice(0, lineIdx).join('\n').length + lineIdx;
        const matchPosInLine = match.index;
        const absolutePos = lineStartPos + matchPosInLine;

        if (isInsideFunction(absolutePos) || isInsideUBOBlock(absolutePos)) continue;

        const type = match[1];
        const name = match[2];

        // Skip if already extracted (Pattern 1 takes precedence - initialized version wins)
        if (extractedGlobalNames.has(name)) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping uninitialized global '${name}' (already extracted with initializer)`);
          continue;
        }

        // Skip if conflicts with common uniform
        if (commonUniformNames.has(name)) {
          continue;
        }

        // SOLUTION A (DUAL DECLARATION): Extract ALL uninitialized globals, including pragma parameters
        // For pragma parameters:
        // - We create BOTH a global declaration AND a PARAM_-prefixed uniform
        // - Assignment code will be injected in main() to copy from uniform to global
        // For non-pragma parameters:
        // - Just extract as normal global
        globals.push(`${type} ${name};`);
        extractedGlobalNames.add(name);

        if (excludeNames.has(name)) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Extracted pragma parameter '${name}' as global (will also create PARAM_${name} uniform)`);
        }
      }
    }

    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] extractGlobalDefinitions - found:');
    console.log(`  - ${defines.length} #defines`);
    console.log(`  - ${consts.length} consts`);
    console.log(`  - ${globals.length} mutable globals`);
    console.log(`  - ${functions.length} functions`);

    if (defines.length > 0) {
      console.log('  First few defines:', defines.slice(0, 5));
    }
    if (globals.length > 0) {
      console.log('  First few globals:', globals.slice(0, 5));
    }
    if (functions.length > 0) {
      console.log('  Function names:', functions.map(f => {
        const nameMatch = f.match(/\s+(\w+)\s*\(/);
        return nameMatch ? nameMatch[1] : 'unknown';
      }).slice(0, 10));
    }

    return { functions, defines, consts, globals };
  }

  /**
   * Split shader into vertex and fragment stages
   */
  private static splitStages(source: string): ShaderStage[] {
    const stages: ShaderStage[] = [];
    const lines = source.split('\n');

    // CRITICAL FIX: Extract specific lines from global section that must be preserved
    // Only extract: #version, #pragma parameter, standalone uniform declarations
    // Everything else (functions, defines, globals) gets extracted and injected separately
    let firstStageIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('#pragma stage')) {
        firstStageIndex = i;
        break;
      }
    }

    // Filter global section to only include:
    // - #pragma parameter (needed for parameter resolution)
    // - #define directives (connect uniforms to their usage, e.g., "#define PR PARAM_PR")
    // - Conditional compilation directives (#if, #ifndef, #ifdef, #elif, #else, #endif)
    // - standalone uniform declarations (like "uniform float PARAM_PR;")
    // NOTE: Exclude #version - convertToWebGL() will add it at the correct position
    const globalSection: string[] = [];
    if (firstStageIndex !== -1) {
      for (let i = 0; i < firstStageIndex; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('#pragma parameter') ||
            trimmed.startsWith('#define ') ||
            trimmed.startsWith('#if ') ||
            trimmed.startsWith('#ifdef ') ||
            trimmed.startsWith('#ifndef ') ||
            trimmed.startsWith('#elif ') ||
            trimmed.startsWith('#else') ||
            trimmed.startsWith('#endif') ||
            trimmed.startsWith('uniform ')) {
          globalSection.push(line);
        }
      }
    }
    console.log(`[splitStages] Extracted ${globalSection.length} critical lines from global section (pragma params, defines, uniforms, conditionals)`);

    let currentStage: 'vertex' | 'fragment' | null = null;
    let currentSource: string[] = [];
    let inStage = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect #pragma stage
      if (trimmed.startsWith('#pragma stage')) {
        // Save previous stage
        if (currentStage && currentSource.length > 0) {
          // Prepend global section to stage source
          const stageWithGlobals = [...globalSection, ...currentSource];
          stages.push({
            type: currentStage,
            source: stageWithGlobals.join('\n')
          });
        }

        // Start new stage
        if (trimmed.includes('vertex')) {
          currentStage = 'vertex';
        } else if (trimmed.includes('fragment')) {
          currentStage = 'fragment';
        }

        currentSource = [];
        inStage = true;
        continue;
      }

      // Skip pragma lines in stage
      if (trimmed.startsWith('#pragma')) {
        continue;
      }

      // Collect stage source
      if (inStage && currentStage) {
        currentSource.push(line);
      }
    }

    // Save last stage (with global section prepended)
    if (currentStage && currentSource.length > 0) {
      const stageWithGlobals = [...globalSection, ...currentSource];
      stages.push({
        type: currentStage,
        source: stageWithGlobals.join('\n')
      });
    }

    return stages;
  }

  /**
   * Extract Slang uniform bindings
   */
  private static extractBindings(source: string): SlangUniformBinding[] {
    const bindings: SlangUniformBinding[] = [];
    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // layout(set = 0, binding = 1) uniform sampler2D Name;
      const samplerMatch = line.match(
        /layout\s*\(\s*set\s*=\s*(\d+)\s*,\s*binding\s*=\s*(\d+)\s*\)\s*uniform\s+sampler\w+\s+(\w+)/
      );

      if (samplerMatch) {
        bindings.push({
          set: parseInt(samplerMatch[1]),
          binding: parseInt(samplerMatch[2]),
          type: 'sampler',
          name: samplerMatch[3]
        });
        continue;
      }

      // layout(push_constant) uniform Push { ... } params;
      // Check push_constant BEFORE generic UBO to avoid matching it as UBO
      if (line.includes('push_constant')) {
        const pushMatch = line.match(/uniform\s+(\w+)/);
        if (pushMatch) {
          const pushTypeName = pushMatch[1];
          const members: UBOMember[] = [];
          let instanceName: string | undefined;

          // Extract push constant members with types
          for (let j = i + 1; j < lines.length; j++) {
            const memberLine = lines[j].trim();

            if (memberLine === '}' || memberLine.startsWith('}')) {
              // Check for instance name after closing brace: } params;
              const instanceMatch = memberLine.match(/}\s*(\w+)\s*;/);
              if (instanceMatch) {
                instanceName = instanceMatch[1];
              }
              break;
            }

            // CRITICAL FIX: Handle comma-separated member declarations
            // Example: float AS, sat; should extract both AS and sat
            const memberMatch = memberLine.match(/^([\w]+)\s+([\w,\s]+);/);
            if (memberMatch) {
              const type = memberMatch[1];
              const names = memberMatch[2].split(',').map(n => n.trim());

              for (const name of names) {
                if (name) {
                  members.push({
                    type: type,
                    name: name
                  });
                }
              }
            }
          }

          bindings.push({
            set: 0,
            binding: 0,
            type: 'pushConstant',
            name: pushTypeName, // Type name (e.g., "Push")
            instanceName, // Instance name (e.g., "params")
            members
          });
        }
        continue;
      }

      // layout(std140, set = 0, binding = 0) uniform UBO { ... }
      // Note: Opening brace { may be on this line or the next line
      // This check comes AFTER push_constant to avoid matching push constants
      // Allow optional qualifiers like std140 before set/binding
      const uboMatch = line.match(
        /layout\s*\([^)]*set\s*=\s*\d+[^)]*binding\s*=\s*\d+[^)]*\)\s*uniform\s+(\w+)/
      );

      if (uboMatch) {
        const uboName = uboMatch[1];
        const members: UBOMember[] = [];
        let instanceName: string | undefined;

        // Find the opening brace (may be on current line or next line)
        let startJ = i;
        if (!line.includes('{') && i + 1 < lines.length && lines[i + 1].trim().startsWith('{')) {
          startJ = i + 1; // Brace is on next line
        }

        // Extract UBO members with types
        for (let j = startJ + 1; j < lines.length; j++) {
          const memberLine = lines[j].trim();

          if (memberLine === '}' || memberLine.startsWith('}')) {
            // Check for instance name after closing brace: } global;
            const instanceMatch = memberLine.match(/}\s*(\w+)\s*;/);
            if (instanceMatch) {
              instanceName = instanceMatch[1];
            }
            break;
          }

          // Extract member type and name: "mat4 MVP;" or "vec4 OutputSize;" or "float HSM_PARAM;"
          // CRITICAL FIX: Handle comma-separated member declarations (e.g., "float x, y;")
          const memberMatch = memberLine.match(/^([\w]+)\s+([\w,\s]+);/);
          if (memberMatch) {
            const type = memberMatch[1];
            const names = memberMatch[2].split(',').map(n => n.trim());

            for (const name of names) {
              if (name) {
                members.push({
                  type: type,
                  name: name
                });
              }
            }
          }
        }

        bindings.push({
          set: 0,
          binding: 0,
          type: 'ubo',
          name: uboName,
          instanceName, // Add instance name (e.g., "global")
          members
        });
        continue;
      }
    }

    return bindings;
  }

  /**
   * Build code block from global definitions
   */
  public static buildGlobalDefinitionsCode(globalDefs: GlobalDefinitions, source: string, stage: 'vertex' | 'fragment' = 'vertex', bindings: SlangUniformBinding[] = []): string {
    const parts: string[] = [];
    const isVertex = stage === 'vertex';

    console.log(`❗❗❗ [buildGlobalDefinitionsCode] Building for ${stage} stage with ${globalDefs.functions.length} functions`);

    // DEBUG: Check if critical functions are in source or globalDefs
    const hasHrgInSource = source.includes('hrg_get_ideal_global_eye_pos');
    const hasCornerMaskInSource = source.includes('HSM_GetCornerMask');
    const hasHrgInDefs = globalDefs.functions.some(f => f.includes('hrg_get_ideal_global_eye_pos'));
    const hasCornerMaskInDefs = globalDefs.functions.some(f => f.includes('HSM_GetCornerMask'));

    console.log(`🔍 hrg_get_ideal_global_eye_pos: inSource=${hasHrgInSource}, inDefs=${hasHrgInDefs}`);
    console.log(`🔍 HSM_GetCornerMask: inSource=${hasCornerMaskInSource}, inDefs=${hasCornerMaskInDefs}`);

    console.log(`[buildGlobalDefinitionsCode] Building for ${stage} stage:`, {
      defines: globalDefs.defines.length,
      consts: globalDefs.consts.length,
      globals: globalDefs.globals.length,
      functions: globalDefs.functions.length
    });

    // Helper function to check if a definition already exists in source
    const definitionExists = (definition: string): boolean => {
      // For variables: check for variable declarations with word boundaries
      if (definition.includes(' = ') && !definition.startsWith('#define')) {
        const varMatch = definition.match(/^\s*(?:float|int|vec\d|mat\d|bool)\s+(\w+)\s*=/);
        if (varMatch) {
          const varName = varMatch[1];
          // Use word boundaries to avoid partial matches
          const varPattern = new RegExp(`\\b${varName}\\b`);
          return varPattern.test(source);
        }
      }
      // For functions: check for function DEFINITIONS (not just calls)
      // Must have return type + function name + parameters + opening brace
      else if (definition.includes('(') && definition.includes(')')) {
        const funcMatch = definition.match(/^\s*(?:\w+)\s+(\w+)\s*\(/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          // Check for DEFINITION: "returnType functionName(...) {" pattern
          // NOT just calls: "functionName(...)"
          const funcDefPattern = new RegExp(`\\b\\w+\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'm');
          return funcDefPattern.test(source);
        }
      }
      // For #defines: check for macro definitions
      else if (definition.startsWith('#define ')) {
        const macroMatch = definition.match(/^#define\s+(\w+)/);
        if (macroMatch) {
          const macroName = macroMatch[1];
          // Use multiline flag and anchors to ensure it's not a comment
          const macroPattern = new RegExp(`^[ \\t]*#define\\s+${macroName}\\b`, 'm');
          return macroPattern.test(source);
        }
      }
      return false;
    };

    // Add stub definitions for missing Mega Bezel variables and functions (only if not already present)
    // Add to both vertex and fragment shaders (they're needed in both)
    parts.push('// Stub definitions for missing Mega Bezel variables and functions');
    const stubDefines = [
      '#define LPOS vec3(0.0, 0.0, 1.0)',
      '#define LCOL vec3(1.0, 1.0, 1.0)',
      '#define FIX(c) max(abs(c), 1e-5)',
      '#define HRG_MAX_POINT_CLOUD_SIZE 9',
      '#define IS_POTATO_PRESET',
      // FXAA constants (reasonable defaults for simple shaders without FXAA params)
      '#define FXAA_EDGE_THRESHOLD 0.125',
      '#define FXAA_EDGE_THRESHOLD_MIN 0.0312',
      '#define FXAA_SUBPIX_TRIM 0.25',
      '#define FXAA_SUBPIX_TRIM_SCALE 1.0',
      '#define FXAA_SUBPIX_CAP 0.75',
      '#define FXAA_SEARCH_STEPS 8.0',
      '#define FXAA_SEARCH_THRESHOLD 0.25',
      // DEFAULT constants - Workaround for extraction issue
      '#define DEFAULT_CRT_GAMMA 2.4',
      '#define DEFAULT_SRGB_GAMMA 2.2',
      '#define DEFAULT_SCREEN_HEIGHT 0.8297',
      // Don't define DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER - it's calculated in globals.inc
      '#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)',
      '#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)',
      '#define DEFAULT_SCREEN_CORNER_RADIUS 10.0'
      // Don't define MAX_NEGATIVE_CROP - it's a mutable global in globals.inc, not a #define
    ];

    // Note: TEXTURE_ASPECT_MODE_* and SHOW_ON_DUALSCREEN_MODE_* are defined in globals.inc
    // DEFAULT_* should also come from globals.inc but adding as fallback for now

    // Handle SOURCE_MATTE_*/BLEND_MODE_* constants from helper-functions.inc
    // These are defined as initialized float globals in helper-functions.inc, but GLSL doesn't allow
    // global initialization. Convert them to #defines and remove from globals.
    const helperConstantNames = [
      'SOURCE_MATTE_PREMULTIPLIED', 'SOURCE_MATTE_WHITE', 'SOURCE_MATTE_NONE',
      'BLEND_MODE_OFF', 'BLEND_MODE_NORMAL', 'BLEND_MODE_ADD', 'BLEND_MODE_MULTIPLY'
    ];

    const hasHelperFunctions = globalDefs.globals.some(g =>
      helperConstantNames.some(name => g.includes(name))
    );

    if (hasHelperFunctions) {
      // Remove these constants from globals (they have initializers which cause syntax errors)
      globalDefs.globals = globalDefs.globals.filter(g =>
        !helperConstantNames.some(name => g.includes(name))
      );

      // Add them as #defines instead
      stubDefines.push(
        '#define SOURCE_MATTE_PREMULTIPLIED 0.0',
        '#define SOURCE_MATTE_WHITE 1.0',
        '#define SOURCE_MATTE_NONE 2.0',
        '#define BLEND_MODE_OFF 0.0',
        '#define BLEND_MODE_NORMAL 1.0',
        '#define BLEND_MODE_ADD 2.0',
        '#define BLEND_MODE_MULTIPLY 3.0'
      );
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] helper-functions.inc detected - converting float constants to #defines');
    } else {
      // Fallback #defines for shaders that don't include helper-functions.inc
      stubDefines.push(
        '#define SOURCE_MATTE_WHITE 0',
        '#define SOURCE_MATTE_NONE 1',
        '#define BLEND_MODE_OFF 0',
        '#define BLEND_MODE_NORMAL 1',
        '#define BLEND_MODE_ADD 2',
        '#define BLEND_MODE_MULTIPLY 3'
      );
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] helper-functions.inc NOT detected - adding SOURCE_MATTE_*/BLEND_MODE_* stubs');
    }

    // Only add DEFAULT_* constants if globals.inc was NOT included
    // (globals.inc has the correct calculated macros - ours would conflict)
    const hasGlobalsInc = globalDefs.defines.some(d =>
      d.includes('DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER') ||
      d.includes('SHOW_ON_DUALSCREEN_MODE_BOTH')
    );

    if (!hasGlobalsInc) {
      stubDefines.push(
        // DEFAULT constants from globals.inc (fallback for simple shaders)
        '#define DEFAULT_CRT_GAMMA 2.4',
        '#define DEFAULT_SRGB_GAMMA 2.2',
        '#define DEFAULT_SCREEN_HEIGHT 0.8297',
        '#define DEFAULT_SCREEN_HEIGHT_PORTRAIT_MULTIPLIER 0.42229',
        '#define DEFAULT_UNCORRECTED_SCREEN_SCALE vec2(1.10585, 0.8296)',
        '#define DEFAULT_UNCORRECTED_BEZEL_SCALE vec2(1.2050, 0.9110)',
        '#define DEFAULT_SCREEN_CORNER_RADIUS 10.0',
        // Note: MAX_NEGATIVE_CROP is a mutable global in globals.inc, NOT a #define, so don't add it here
        // TEXTURE_ASPECT_MODE constants from globals.inc
        '#define TEXTURE_ASPECT_MODE_VIEWPORT 0',
        '#define TEXTURE_ASPECT_MODE_EXPLICIT 1',
        '#define TEXTURE_ASPECT_MODE_4_3 2',
        '#define TEXTURE_ASPECT_MODE_3_4 3',
        '#define TEXTURE_ASPECT_MODE_16_9 4',
        '#define TEXTURE_ASPECT_MODE_9_16 5',
        // SHOW_ON_DUALSCREEN_MODE constants from globals.inc
        '#define SHOW_ON_DUALSCREEN_MODE_BOTH 0',
        '#define SHOW_ON_DUALSCREEN_MODE_SCREEN_1 1',
        '#define SHOW_ON_DUALSCREEN_MODE_SCREEN_2 2'
      );
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] globals.inc NOT detected - adding DEFAULT_*, TEXTURE_ASPECT_MODE_*, SHOW_ON_DUALSCREEN_MODE_* stubs');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] globals.inc detected - skipping stubs to avoid conflicts');
    }

    // Add bezel-images constants (needed by bezel-and-image-layers.slang)
    // Only add if they're not already defined in globals.inc
    const hasBezelConstants = globalDefs.defines.some(d =>
      d.includes('MASK_MODE_') || d.includes('FOLLOW_LAYER_')
    );

    if (!hasBezelConstants) {
      stubDefines.push(
        // MASK_MODE constants
        '#define MASK_MODE_ALL 0.0',
        '#define MASK_MODE_SCREEN 1.0',
        '#define MASK_MODE_TUBE 2.0',
        '#define MASK_MODE_INSIDE_BEZEL 3.0',
        '#define MASK_MODE_BEZEL 4.0',
        '#define MASK_MODE_OUTSIDE_TUBE 5.0',
        '#define MASK_MODE_FRAME 6.0',
        '#define MASK_MODE_OUTSIDE_BEZEL 7.0',
        '#define MASK_MODE_OUTSIDE_FRAME 8.0',
        // CUTOUT_MODE constants
        '#define CUTOUT_MODE_INSIDE 1.0',
        '#define CUTOUT_MODE_OUTSIDE 2.0',
        // FOLLOW_LAYER constants
        '#define FOLLOW_LAYER_VIEWPORT 0.0',
        '#define FOLLOW_LAYER_SCREEN 1.0',
        '#define FOLLOW_LAYER_TUBE_DIFFUSE 2.0',
        '#define FOLLOW_LAYER_BEZEL_OUTSIDE 3.0',
        '#define FOLLOW_LAYER_BG 4.0',
        '#define FOLLOW_LAYER_DEVICE 5.0',
        '#define FOLLOW_LAYER_DECAL 6.0',
        '#define FOLLOW_LAYER_CAB_GLASS 7.0',
        '#define FOLLOW_LAYER_TOP 8.0'
      );
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Added bezel-images constants (MASK_MODE_*, CUTOUT_MODE_*, FOLLOW_LAYER_*)');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Bezel constants already present in defines - skipping stubs');
    }

    if (isVertex) {
      // Vertex-specific stubs (if any)
    }

    // Add stub defines to both vertex and fragment
    for (const define of stubDefines) {
      if (!definitionExists(define)) {
        parts.push(define);
      }
    }

    // Guest CRT compatibility
    // Note: COMPAT_TEXTURE is defined in hsm-crt-guest-advanced.inc, don't define it here
    // Note: no_scanlines is declared locally in Guest CRT shaders, so we DON'T define it here
    // (defining it causes "float no_scanlines = X" to become "float 0.0 = X" - syntax error)

    // Constants/variables needed by HSM_GetNoScanlineMode
    // Note: All these are already defined in the shader's globals:
    // - HSM_INTERLACE_MODE and HSM_INTERLACE_TRIGGER_RES (shader params)
    // - USE_VERTICAL_SCANLINES (global variable)
    // - CROPPED_ROTATED_SIZE_WITH_RES_MULT (global variable)
    // No additional defines needed

    parts.push('');

    // Function stubs disabled - functions ARE being extracted from includes
    // The "function already has a body" errors show they exist in globalDefs.functions
    // They should be injected below in the globalDefs.functions section

    // CRITICAL: Add TUBE_* variables to BOTH vertex and fragment shaders
    // They're used in fragment shader functions like HSM_GetPostCrtPreppedColorPotato
    // Mega Bezel coordinate and parameter variables
    // Only add these stubs if they haven't been extracted from globals.inc
    // Check if TUBE_MASK exists in globalDefs (means globals.inc was included)
    const hasMegaBezelGlobals = globalDefs.globals.some(g => /TUBE_MASK|TUBE_SCALE|TUBE_DIFFUSE_COORD/.test(g));

    // ALWAYS declare cache variables (needed in both vertex and fragment)
    // These must be mutable for HSM_UpdateGlobalScreenValuesFromCache()
    parts.push('// Cache variables (mutable - updated by HSM_UpdateGlobalScreenValuesFromCache)');
    parts.push('vec2 CROPPED_ROTATED_SIZE;');  // Read from cache-info pass
    parts.push('vec2 CROPPED_ROTATED_SIZE_WITH_RES_MULT;');  // Read from cache-info pass
    parts.push('vec2 SAMPLE_AREA_START_PIXEL_COORD;');  // Read from cache-info pass
    parts.push('');

    if (!hasMegaBezelGlobals) {
      parts.push('// Mega Bezel coordinate and parameter variables (stubs for simple shaders)');
      parts.push('vec2 TUBE_DIFFUSE_COORD;');
      parts.push('vec2 TUBE_DIFFUSE_SCALE;');
      parts.push('vec2 TUBE_SCALE;');
      parts.push('float TUBE_DIFFUSE_ASPECT;');
      parts.push('float TUBE_MASK;');
      parts.push('float SCREEN_ASPECT;');
      parts.push('vec2 SCREEN_COORD;');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Mega Bezel globals found - they will be included from globalDefs');
    }

    // Add helper-functions.inc constants ONLY if not already defined
    // These are needed by linearize.slang but may not be extracted from includes
    // We check the current compiled parts to avoid duplicates
    const currentCode = parts.join('\n');
    const needsHelperConstants = !currentCode.includes('SOURCE_MATTE_') && !currentCode.includes('BLEND_MODE_');

    if (needsHelperConstants) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Adding helper-functions.inc constants (not found in compiled code yet)');
      parts.push('// Constants from helper-functions.inc');
      parts.push('#ifndef SOURCE_MATTE_PREMULTIPLIED');
      parts.push('#define SOURCE_MATTE_PREMULTIPLIED 0.0');
      parts.push('#define SOURCE_MATTE_WHITE 1.0');
      parts.push('#define SOURCE_MATTE_NONE 2.0');
      parts.push('#define BLEND_MODE_OFF 0.0');
      parts.push('#define BLEND_MODE_NORMAL 1.0');
      parts.push('#define BLEND_MODE_ADD 2.0');
      parts.push('#define BLEND_MODE_MULTIPLY 3.0');
      parts.push('#endif');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Helper constants already present in compiled code - skipping');
    }

    // Add stub functions for missing Mega Bezel functions (used but not defined anywhere)
    // These functions are called by shaders but don't exist in the source files
    // Verified by searching entire shader directory - no definitions found
    if (!currentCode.includes('HSM_IsOutsideReflectionBoundary')) {
      parts.push('// Stub function for reflection boundary check (function not defined in shader sources)');
      parts.push('bool HSM_IsOutsideReflectionBoundary() { return false; }');
    }

    if (!currentCode.includes('HSM_ApplyPackedTubeLayers')) {
      parts.push('// Stub function for tube layers (returns input color without tube effects)');
      parts.push('vec4 HSM_ApplyPackedTubeLayers(vec4 color, vec4 layers) { return color; }');
    }

    if (!currentCode.includes('HSM_UpdateGlobalScreenValuesFromCache')) {
      parts.push('// Function to read cached screen values from cache-info pass');
      parts.push('// Based on cache-info.inc structure - reads from specific texture coordinates');
      parts.push('void HSM_UpdateGlobalScreenValuesFromCache(sampler2D cache, vec2 coord) {');
      parts.push('  // Cache layout: 8x8 grid, samples at CENTER of each cell');
      parts.push('  // Sample (1,2) contains: rg=CROPPED_ROTATED_SIZE, ba=SAMPLE_AREA_START_PIXEL_COORD');
      parts.push('  // Sample (4,1) contains: rg=CROPPED_ROTATED_SIZE_WITH_RES_MULT');
      parts.push('  ');
      parts.push('  // Read CROPPED_ROTATED_SIZE and SAMPLE_AREA_START_PIXEL_COORD from cache(1,2)');
      parts.push('  // HSM_GetCacheSampleCoord returns center: (column/8 + 1/16, row/8 + 1/16)');
      parts.push('  vec2 cache_coord_1_2 = vec2((1.0/8.0) + (1.0/16.0), (2.0/8.0) + (1.0/16.0));');
      parts.push('  vec4 cache_sample_1_2 = texture(cache, cache_coord_1_2);');
      parts.push('  CROPPED_ROTATED_SIZE = cache_sample_1_2.rg;');
      parts.push('  SAMPLE_AREA_START_PIXEL_COORD = cache_sample_1_2.ba;');
      parts.push('  ');
      parts.push('  // Read CROPPED_ROTATED_SIZE_WITH_RES_MULT from cache(4,1)');
      parts.push('  vec2 cache_coord_4_1 = vec2((4.0/8.0) + (1.0/16.0), (1.0/8.0) + (1.0/16.0));');
      parts.push('  vec4 cache_sample_4_1 = texture(cache, cache_coord_4_1);');
      parts.push('  CROPPED_ROTATED_SIZE_WITH_RES_MULT = cache_sample_4_1.rg;');
      parts.push('}');
    }

    parts.push('');

    // NO STUBS - All functions should come from globalDefs extracted from .inc files
    // Track which functions would have been stubs (for filtering globalDefs)
    const stubFunctionNames = new Set<string>();


    if (globalDefs.defines.length > 0) {
      // Deduplicate #defines by macro name (keep first occurrence)
      const seenDefines = new Set<string>();
      const uniqueDefines: string[] = [];

      // Prevent stub definitions from being overridden by extracted versions
      // (our stubs are simpler and added first)
      seenDefines.add('LPOS');
      seenDefines.add('LCOL');
      seenDefines.add('FIX');
      seenDefines.add('HRG_MAX_POINT_CLOUD_SIZE');
      seenDefines.add('FXAA_EDGE_THRESHOLD');
      seenDefines.add('FXAA_EDGE_THRESHOLD_MIN');
      seenDefines.add('FXAA_SUBPIX_TRIM');
      seenDefines.add('FXAA_SUBPIX_TRIM_SCALE');
      seenDefines.add('FXAA_SUBPIX_CAP');
      seenDefines.add('FXAA_SEARCH_STEPS');
      seenDefines.add('FXAA_SEARCH_THRESHOLD');

      // CRITICAL FIX: Skip #defines that conflict with uniform bindings (UBO/push constant members)
      // Example: push constant has "float lsmooth;" AND shader has "#define lsmooth 0.7"
      // This would create: uniform float PARAM_lsmooth; + float lsmooth; + #define lsmooth 0.7 -> conflict!
      // Solution: Skip the #define, keep the uniform+global (they provide dynamic value)
      //
      // IMPORTANT: Check global variable names, NOT bindings, because by this point push constants
      // have already been converted to individual uniforms + globals (Solution A)
      const globalVarNames = new Set<string>();
      globalDefs.globals.forEach(g => {
        // Extract variable name from declarations like "float lsmooth;" or "vec2 SCREEN_COORD;"
        const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*[;=]/);
        if (match) globalVarNames.add(match[1]);
      });

      // Also check bindings for completeness (though most will be in globals already)
      for (const binding of bindings) {
        if (binding.type === 'ubo' || binding.type === 'pushConstant') {
          binding.members?.forEach(m => globalVarNames.add(m.name));
        }
      }

      if (globalVarNames.size > 0) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found ${globalVarNames.size} global/binding names to check against #defines`);
      }

      for (const define of globalDefs.defines) {
        const macroName = define.match(/#define\s+(\w+)/)?.[1];

        // Skip if this #define conflicts with a global variable name (from UBO/push constant)
        if (macroName && globalVarNames.has(macroName)) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SKIPPING #define ${macroName} (conflicts with global variable)`);
          continue;
        }

        if (macroName && !seenDefines.has(macroName)) {
          seenDefines.add(macroName);
          uniqueDefines.push(define);

          // Debug: Log important defines
          if (macroName.startsWith('DEFAULT_') || macroName === 'HRG_MAX_POINT_CLOUD_SIZE') {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Adding define to shader:`, macroName);
          }
        } else if (macroName && macroName.startsWith('DEFAULT_')) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SKIPPING define (already seen):`, macroName);
        }
      }

      // Debug: Check if DEFAULT defines are in uniqueDefines
      const defaultDefines = uniqueDefines.filter(d => d.includes('DEFAULT_'));
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Total DEFAULT_* defines in shader: ${defaultDefines.length}`);

      parts.push('// Global #define macros');
      parts.push(...uniqueDefines);
      parts.push('');

      // Debug: Check if HRG define is in parts
      const hasHrgInParts = parts.some(p => p.includes('HRG_MAX_POINT_CLOUD_SIZE'));
      if (globalDefs.defines.some(d => d.includes('HRG_MAX_POINT_CLOUD_SIZE')) && !hasHrgInParts) {
        if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ERROR: HRG define was in globalDefs.defines but NOT added to parts!');
      }
    }

    if (globalDefs.consts.length > 0) {
      // Deduplicate consts by name (keep first occurrence)
      const seenConsts = new Set<string>();
      const uniqueConsts: string[] = [];

      // CRITICAL FIX: Check for push constant/UBO member names
      // If a const has the same name as a push constant member, skip it
      // because it will get a PARAM_-prefixed uniform + mutable global instead
      const paramMemberNames = new Set<string>();
      for (const binding of bindings) {
        if (binding.type === 'pushConstant' || binding.type === 'ubo') {
          binding.members?.forEach(m => paramMemberNames.add(m.name));
        }
      }

      for (const constDecl of globalDefs.consts) {
        const constName = constDecl.match(/const\s+\w+\s+(\w+)/)?.[1];

        // Don't skip - we'll convert const to mutable below
        if (constName && !seenConsts.has(constName) && !definitionExists(constDecl)) {
          seenConsts.add(constName);
          uniqueConsts.push(constDecl);
        }
      }

      if (uniqueConsts.length > 0) {
        // CRITICAL FIX: Remove 'const' qualifier from any const that matches a push constant/UBO member
        // These need to be mutable because they get assigned from PARAM_ uniforms
        const mutableConsts = uniqueConsts.map(constDecl => {
          // Match both: "const float lsmooth = ..." and "const float lsmooth;"
          const constMatch = constDecl.match(/const\s+(\w+)\s+(\w+)/);
          if (constMatch && paramMemberNames.has(constMatch[2])) {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Converting const ${constMatch[2]} to mutable global (matches push constant/UBO member)`);
            return constDecl.replace(/\bconst\s+/, ''); // Remove 'const' keyword
          }
          return constDecl;
        });

        parts.push('// Global const declarations');
        parts.push(...mutableConsts);
        parts.push('');
      }
    }

    if (globalDefs.globals.length > 0) {
      // CRITICAL: Only inject globals into VERTEX shader
      // Fragment shader will receive them as varyings via GlobalToVaryingConverter
      // Injecting into both causes 897 redefinition errors
      if (isVertex) {
        // Deduplicate globals by name (keep first occurrence)
        const seenGlobals = new Set<string>();
        const uniqueGlobals: string[] = [];

        // Skip cache variables (already declared explicitly above)
        const cacheVars = new Set(['CROPPED_ROTATED_SIZE', 'CROPPED_ROTATED_SIZE_WITH_RES_MULT', 'SAMPLE_AREA_START_PIXEL_COORD']);

        // CRITICAL FIX: Check if a global name conflicts with a #define
        // If there's a conflict, REMOVE the #define and KEEP the mutable global
        // This allows shaders to assign to the variable
        // Example: "#define lsmooth 0.7" conflicts with "float lsmooth;" -> remove the #define, keep the global
        const conflictingDefineNames = new Set<string>();
        const globalNames = new Set<string>();

        // First, collect all global variable names
        for (const globalDecl of globalDefs.globals) {
          const globalMatch = globalDecl.match(/(?:float|int|vec\d|mat\d|bool)\s+(\w+)/);
          if (globalMatch) {
            globalNames.add(globalMatch[1]);
          }
        }

        // Check which #defines conflict with globals
        for (const define of globalDefs.defines) {
          const macroMatch = define.match(/#define\s+(\w+)\s+([^(])/);
          if (macroMatch && globalNames.has(macroMatch[1])) {
            // This #define conflicts with a global variable
            // Check if it's a simple constant (not a function-like macro or uniform mapping)
            const value = define.substring(define.indexOf(macroMatch[1]) + macroMatch[1].length).trim();
            const isSimpleConstant = !value.startsWith('PARAM_') && !value.includes('(');

            if (isSimpleConstant) {
              conflictingDefineNames.add(macroMatch[1]);
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removing conflicting #define ${macroMatch[1]} (global variable needs to be mutable)`);
            }
          }
        }

        // Remove conflicting #defines from globalDefs
        globalDefs.defines = globalDefs.defines.filter(define => {
          const macroMatch = define.match(/#define\s+(\w+)/);
          return !macroMatch || !conflictingDefineNames.has(macroMatch[1]);
        });

        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removed ${conflictingDefineNames.size} conflicting #defines to preserve mutable globals`);
        if (stage === 'vertex' && conflictingDefineNames.size > 0) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removed defines:`, Array.from(conflictingDefineNames).join(', '));
        }

        for (const globalDecl of globalDefs.globals) {
          const globalMatch = globalDecl.match(/(?:float|int|vec\d|mat\d|bool)\s+(\w+)/);
          const globalName = globalMatch?.[1];

          // Skip cache variables (already declared)
          if (globalName && cacheVars.has(globalName)) {
            continue;
          }

          // Include Mega Bezel global patterns AND any UPPERCASE globals
          const isMegaBezelGlobal = /SCREEN_|TUBE_|AVERAGE_LUMA|SAMPLING_|CROPPED_|ROTATED_|SAMPLE_AREA|VIEWPORT_|CORE_|CACHE_|NEGATIVE_CROP|BEZEL_|GRID_|REFLECTION_|FRAME_|ASPECT|SCALE|COORD|MASK/.test(globalName || '');
          const isUppercaseGlobal = globalName && /^[A-Z_][A-Z0-9_]*$/.test(globalName);

          const shouldInclude = isMegaBezelGlobal || isUppercaseGlobal || !definitionExists(globalDecl);

          if (globalName && !seenGlobals.has(globalName) && shouldInclude) {
            seenGlobals.add(globalName);
            uniqueGlobals.push(globalDecl);
          }
        }

        if (uniqueGlobals.length > 0) {
          parts.push('// Global mutable variables (vertex only - fragment gets varyings)');
          // CRITICAL FIX for WebGL: Split initialized globals into declarations + initializations
          // WebGL doesn't allow "vec2 VARIABLE = vec2(1);" at global scope (only const allowed)
          // Must split into: "vec2 VARIABLE;" (global) and "VARIABLE = vec2(1);" (in main())
          for (const globalDecl of uniqueGlobals) {
            // Check if this global has an initializer
            const initMatch = globalDecl.match(/^([\w\s]+)\s+(\w+)\s*=\s*(.+);$/);
            if (initMatch) {
              // Has initializer - split into declaration without initializer
              const type = initMatch[1].trim();
              const name = initMatch[2];
              parts.push(`${type} ${name};  // Initialized in main()`);
            } else {
              // No initializer - use as-is
              parts.push(globalDecl);
            }
          }
          parts.push('');
        }
      } else {
        // Fragment shader: ALSO needs global declarations (global-to-varying converter is disabled)
        // Mega Bezel shaders use globals in both vertex and fragment shaders
        if (globalDefs.globals.length > 0) {
          console.log(`[buildGlobalDefinitionsCode] Fragment stage: injecting ${globalDefs.globals.length} global declarations`);
          parts.push('// Global mutable variables (shared between vertex and fragment)');

          // Skip cache variables (already declared explicitly above)
          const cacheVars = new Set(['CROPPED_ROTATED_SIZE', 'CROPPED_ROTATED_SIZE_WITH_RES_MULT', 'SAMPLE_AREA_START_PIXEL_COORD']);

          // CRITICAL FIX: Same as vertex - remove conflicting #defines, keep mutable globals
          // (The defines were already filtered in vertex shader processing, but check again for fragment)

          // Same as vertex: split initialized globals
          for (const globalDecl of globalDefs.globals) {
            const globalMatch = globalDecl.match(/(?:float|int|vec\d|mat\d|bool)\s+(\w+)/);
            const globalName = globalMatch?.[1];

            // Skip cache variables (already declared)
            if (globalName && cacheVars.has(globalName)) {
              continue;
            }

            const initMatch = globalDecl.match(/^([\w\s]+)\s+(\w+)\s*=\s*(.+);$/);
            if (initMatch) {
              const type = initMatch[1].trim();
              const name = initMatch[2];
              parts.push(`${type} ${name};  // Initialized in main()`);
            } else {
              parts.push(globalDecl);
            }
          }
          parts.push('');
        }
      }
    }

    if (globalDefs.functions.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] 🔧 Processing ${globalDefs.functions.length} extracted functions for deduplication`);

      // Deduplicate functions by name (keep first occurrence)
      const seenFunctions = new Set<string>();
      const uniqueFunctions: string[] = [];

      for (const funcDef of globalDefs.functions) {
        // Extract function name: match "returnType functionName(" pattern
        // The function name is the LAST word before the opening parenthesis
        const funcName = funcDef.match(/(\w+)\s*\(/)?.[1];

        // DEBUG: Log if we find the critical functions
        if (funcName === 'hrg_get_ideal_global_eye_pos' || funcName === 'HSM_GetCornerMask' || funcName === 'hrg_get_ideal_global_eye_pos_for_points') {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] 🔍 Found function: ${funcName}, length: ${funcDef.length} chars`);
        }

        // Add all extracted functions - no stubs
        if (funcName && !seenFunctions.has(funcName) && !definitionExists(funcDef)) {
          seenFunctions.add(funcName);
          uniqueFunctions.push(funcDef);

          // DEBUG: Log when adding critical functions
          if (funcName === 'hrg_get_ideal_global_eye_pos' || funcName === 'HSM_GetCornerMask' || funcName === 'hrg_get_ideal_global_eye_pos_for_points') {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ✅ Adding function to shader: ${funcName}`);
          }
        } else if (funcName === 'hrg_get_ideal_global_eye_pos' || funcName === 'HSM_GetCornerMask' || funcName === 'hrg_get_ideal_global_eye_pos_for_points') {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ❌ NOT adding ${funcName}: seen=${seenFunctions.has(funcName)}, exists=${definitionExists(funcDef)}`);
        }
      }

      if (uniqueFunctions.length === 0) {
        // No functions to add
        return parts.join('\n');
      }

      parts.push('// Global function definitions');

      // Fix int/float division and arithmetic in extracted functions
      const fixedFunctions = uniqueFunctions.map(func => {
        let fixed = func;

        // Fix array declarations and variable assignments with HRG_MAX_POINT_CLOUD_SIZE
        // WebGL needs the actual value, not a #define constant, especially for arrays and int assignments
        // Replace all uses of HRG_MAX_POINT_CLOUD_SIZE with the literal value 9
        fixed = fixed.replace(/\bHRG_MAX_POINT_CLOUD_SIZE\b/g, '9');

        // Fix division: int / float → float / float
        // Use negative lookahead/lookbehind to avoid matching digits in floating-point numbers
        // (?<![.\d]) = not preceded by . or digit (avoids matching 0 from 1.0)
        // (?!\.) = not followed by . (avoids matching 1 from 1.0)
        fixed = fixed.replace(/(?<![.\d])(\d+)(?!\.)\s*\/\s*([a-zA-Z_][\w.]*)/g, (match, num, varName) => {
          return `${num}.0 / ${varName}`;
        });

        // Fix division in expressions like: 1 / (something)
        fixed = fixed.replace(/(?<![.\d])(\d+)(?!\.)\s*\/\s*\(/g, (match, num) => {
          return `${num}.0 / (`;
        });

        // Fix multiplication and subtraction with integers in expressions
        // Pattern: (1 - something) where 1 should be 1.0
        fixed = fixed.replace(/\((\d+)(?!\.)\s*([+\-*])\s*([a-zA-Z_][\w.]*)/g, (match, num, op, varName) => {
          if (parseInt(num) < 100) { // Only fix small ints likely to be constants
            return `(${num}.0 ${op} ${varName}`;
          }
          return match;
        });

        // NOTE: Aggressive function argument conversion disabled due to false positives
        // (converts loop counters, parts of float literals like 12.9898, etc.)

        // CRITICAL FIX: Ensure opening brace is preserved
        // Some functions have brace on separate line which can get lost during processing
        // Pattern: ")\n\s*{" should be preserved (function signature followed by opening brace)
        // Make sure there's at least a newline before the opening brace
        fixed = fixed.replace(/\)\s*\n\s*\{/g, ')\n{');

        return fixed;
      });

      parts.push(...fixedFunctions);
      parts.push('');

      // TEMPORARY: Add stub for hrg_get_ideal_global_eye_pos_for_points if not already defined
      // This function exists in royale-geometry-functions.inc but isn't being extracted
      // TODO: Fix extraction logic to handle array parameters with #define constants
      const hasHrgDefinition = uniqueFunctions.some(f => f.includes('hrg_get_ideal_global_eye_pos_for_points('));
      if (!hasHrgDefinition) {
        if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Adding stub for hrg_get_ideal_global_eye_pos_for_points');
        parts.push('// STUB: hrg_get_ideal_global_eye_pos_for_points');
        parts.push('vec3 hrg_get_ideal_global_eye_pos_for_points(vec3 eye_pos, vec2 output_aspect, vec3 global_coords[9], int num_points, float in_geom_radius, float in_geom_view_dist) {');
        parts.push('  return eye_pos; // Simplified stub - just return input eye position');
        parts.push('}');
        parts.push('');
      }
    }

    const result = parts.join('\n');

    // DEBUG: Check if HSM_GetNoScanlineMode function body is in result
    if (result.includes('HSM_GetNoScanlineMode')) {
      const lines = result.split('\n');
      // Debug logging for HSM_GetNoScanlineMode (DISABLED - produces too much console noise)
      // const relevantLines = lines.filter(l =>
      //   l.includes('HSM_GetNoScanlineMode') ||
      //   l.trim() === 'return 0.0;' ||
      //   l.trim() === '// Always use Guest scanlines'
      // );
      // console.error(`[buildGlobalDefinitionsCode] HSM_GetNoScanlineMode in result (${stage}):`);
      // relevantLines.forEach(l => console.error(`  ${l}`));
    }

    return result;
  }

  /**
   * Convert Slang GLSL to WebGL GLSL
   */
  private static convertToWebGL(
    source: string,
    stage: 'vertex' | 'fragment',
    bindings: SlangUniformBinding[],
    webgl2: boolean,
    parameters: ShaderParameter[] = [],
    globalDefs: GlobalDefinitions = { functions: [], defines: [], consts: [], globals: [] }
  ): string {
    console.log(`[convertToWebGL] *** Called for ${stage} stage, globalDefs.globals.length=${globalDefs.globals.length} ***`);

    // Debug: Check if HHLP_GetMaskCenteredOnValue is in the input
    if (source.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = source.indexOf('HHLP_GetMaskCenteredOnValue');
      const context = source.substring(Math.max(0, idx - 30), Math.min(source.length, idx + 150));
      console.log(`[convertToWebGL ${stage}] INPUT contains HHLP, context:`, context);
    } else {
      console.log(`[convertToWebGL ${stage}] HHLP_GetMaskCenteredOnValue NOT in input source`);
    }

    let output = source;

    // Replace or add #version directive
    // Note: The regex needs to match decimal versions too (like 300.0)
    const versionMatch = output.match(/#version\s+([\d.]+)/);
    if (versionMatch) {
      console.log(`[convertToWebGL] Found version directive: "${versionMatch[0]}", version number: "${versionMatch[1]}"`);
    }

    const hasVersion = /#version\s+[\d.]+/.test(output);
    if (webgl2) {
      if (hasVersion) {
        // Replace any version (including decimal like 300.0) with proper format
        // Make sure to handle both integer and decimal versions
        output = output.replace(/#version\s+[\d.]+\s*(?:es)?/g, '#version 300 es');
      } else {
        // Add #version 300 es at the very beginning
        output = '#version 300 es\n' + output;
      }
    } else {
      // Remove version directive for WebGL1
      output = output.replace(/#version\s+[\d.]+\s*(?:es)?/g, '');
    }

    // Strip #pragma parameter lines (they become uniforms instead)
    output = output.replace(/#pragma\s+parameter\s+.*$/gm, '');

    // NOTE: C preprocessor conditionals (#if, #ifdef, etc.) are now handled
    // by preprocessConditionals() at the start of compile(), so we don't need
    // to manually resolve them here anymore

    // Strip #define directives that alias UBO members (we're converting UBO to individual uniforms)
    // Common patterns: #define SourceSize params.OriginalSize, #define MVP global.MVP
    // Strip #defines that alias UBO members (e.g., #define OutputSize global.OutputSize)
    // BUT keep the defines if they're already simple (not referencing global/params)
    const uboDefines = /^\s*#define\s+(SourceSize|OriginalSize|OriginalFeedbackSize|OutputSize|FinalViewportSize|DerezedPassSize|FrameCount|FrameDirection|MVP)\s+(global\.|params\.)/gm;
    const strippedUboDefines = (output.match(uboDefines) || []).length;
    if (strippedUboDefines > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stripping ${strippedUboDefines} UBO #defines that reference global./params.`);
    }
    output = output.replace(uboDefines, '');

    // CRITICAL FIX: Strip #defines that would conflict with push constant/UBO members
    // Example: push constant has "float lsmooth;" and shader has "#define lsmooth 0.7"
    // Solution: Remove the #define, use the uniform value instead
    // Extract all UBO/push constant member names from bindings
    const conflictingDefineNames = new Set<string>();
    for (const binding of bindings) {
      if (binding.type === 'ubo' || binding.type === 'pushConstant') {
        binding.members?.forEach(m => conflictingDefineNames.add(m.name));
      }
    }

    // Strip #defines whose macro names match UBO/push constant member names
    // CRITICAL: Only strip simple constant value defines, NOT macro functions or uniform mappings
    // Example: Strip "#define lsmooth 0.7" but KEEP "#define kernel(x) exp(...)" and "#define PR PARAM_PR"
    if (conflictingDefineNames.size > 0) {
      let strippedConflicts = 0;
      const lines = output.split('\n');
      output = lines.map(line => {
        // Match #define with macro name, check if it's a macro function or uniform mapping
        const defineMatch = line.match(/^\s*#define\s+(\w+)\s*(\()?\s*(.+)?/);
        if (defineMatch && conflictingDefineNames.has(defineMatch[1])) {
          // defineMatch[2] will be '(' if this is a macro function
          const isMacroFunction = defineMatch[2] === '(';

          // defineMatch[3] is the value/expression
          const value = defineMatch[3]?.trim();

          // Check if this is a mapping to a PARAM_ uniform (e.g., "#define PR PARAM_PR")
          const isUniformMapping = value && (value.startsWith('PARAM_') || value.startsWith('uniform'));

          if (!isMacroFunction && !isUniformMapping) {
            // Only strip simple constant value defines, not macro functions or uniform mappings
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stripping conflicting #define ${defineMatch[1]} = ${value} (matches push constant/UBO member)`);
            strippedConflicts++;
            return `// ${line} // STRIPPED: conflicts with uniform`;
          } else if (isUniformMapping) {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Preserving uniform mapping #define ${defineMatch[1]} ${value} (needed for shader)`);
          } else {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Preserving macro function #define ${defineMatch[1]}(...) (not a conflict)`);
          }
        }
        return line;
      }).join('\n');
      if (strippedConflicts > 0) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stripped ${strippedConflicts} conflicting #defines`);
      }
    }

    // NOTE: UBO initializer stripping now happens earlier in the compile() method
    // BEFORE global./params. replacement, so the pattern can match properly

    // Add precision FIRST (required by GLSL ES before any float types)
    const precisionLine = webgl2
      ? 'precision highp float;\nprecision highp int;\n'
      : 'precision mediump float;\n';

    // Add critical RetroArch uniforms AFTER precision but BEFORE globalDefs injection
    // GLSL allows duplicate uniform declarations if they're identical
    const criticalUniforms = `// Critical RetroArch uniforms (declared after precision, before UBO)
uniform vec4 SourceSize;
uniform vec4 OriginalSize;
uniform vec4 OutputSize;
uniform float FrameCount;
uniform float FrameDirection;

// Common RetroArch compatibility macros (for shaders that don't include hsm-crt-guest-advanced.inc)
#ifndef COMPAT_TEXTURE
#define COMPAT_TEXTURE(c,d) texture(c,d)
#endif

`;

    // Insert both after #version
    const versionMatch2 = output.match(/#version.*?\n/);
    if (versionMatch2) {
      output = output.replace(versionMatch2[0], versionMatch2[0] + precisionLine + criticalUniforms);
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ${stage} stage: Added precision + critical uniforms after #version`);
    } else {
      output = precisionLine + criticalUniforms + output;
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ${stage} stage: Added precision + critical uniforms at beginning`);
    }

    // CRITICAL: Extract layout-qualified input/output declarations and move them early
    // WebGL requires these to appear near the top, not after thousands of lines of globals
    // IMPORTANT: Only keep layout qualifiers on vertex shader 'in' (not 'out')
    // GLSL ES 300 doesn't allow layout qualifiers on varyings (vertex out)
    const layoutDeclsPattern = /^\s*layout\s*\([^)]*\)\s+(?:in|out)\s+[^;]+;/gm;
    const layoutDecls: string[] = [];
    let match;
    while ((match = layoutDeclsPattern.exec(output)) !== null) {
      let decl = match[0].trim();

      // For vertex shader: remove layout qualifier from 'out' declarations (varyings)
      // but keep it for 'in' declarations (attributes)
      if (stage === 'vertex' && decl.includes(' out ')) {
        // Strip layout qualifier from vertex shader outputs
        decl = decl.replace(/layout\s*\([^)]*\)\s+/, '');
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removed layout qualifier from vertex shader output: ${decl}`);
      }

      layoutDecls.push(decl);
    }

    // Remove layout declarations from their current position
    if (layoutDecls.length > 0) {
      output = output.replace(layoutDeclsPattern, '');
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Extracted ${layoutDecls.length} layout-qualified declarations to move earlier`);
    }

    // Inject global definitions after precision declarations
    // IMPORTANT: With the self-referential #define cleanup (lines 156-174), we can now safely
    // inject ALL defines into BOTH vertex and fragment shaders without redefinition errors
    // Functions, consts, and globals are also needed by both stages
    // Mega Bezel shaders need ALL globals in fragment shaders (from globals.inc)
    const isVertex = stage === 'vertex';  // Keep for debug logging below
    const filteredGlobalDefs = globalDefs;  // Both stages get everything now

    const globalDefsCode = this.buildGlobalDefinitionsCode(filteredGlobalDefs, output, stage, bindings);
    const totalDefs = filteredGlobalDefs.defines.length + filteredGlobalDefs.consts.length + filteredGlobalDefs.globals.length + filteredGlobalDefs.functions.length;

    // Log for both stages to debug
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] buildGlobalDefinitionsCode for ${stage}: code.length=${globalDefsCode.length}, totalDefs=${totalDefs}`);

    if (globalDefsCode) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injecting ${totalDefs} global definitions into ${stage} stage (${filteredGlobalDefs.defines.length} defines, ${filteredGlobalDefs.consts.length} consts, ${filteredGlobalDefs.globals.length} globals, ${filteredGlobalDefs.functions.length} functions)`);

      // Find insertion point: after ALL precision declarations AND critical uniforms
      // Look for the critical uniforms comment as a marker
      const criticalUniformsEnd = output.indexOf('// Critical RetroArch uniforms');
      if (criticalUniformsEnd !== -1) {
        // Find the end of the critical uniforms block (look for the blank line after)
        const searchStart = criticalUniformsEnd;
        const nextDoubleNewline = output.indexOf('\n\n', searchStart);
        if (nextDoubleNewline !== -1) {
          const insertPos = nextDoubleNewline + 2; // After the blank line

          // CRITICAL: Insert layout declarations FIRST, then global definitions
          let injectionCode = '';
          if (layoutDecls.length > 0) {
            injectionCode += '// Vertex shader inputs and outputs (moved early for WebGL compatibility)\n';
            injectionCode += layoutDecls.join('\n') + '\n\n';
          }
          injectionCode += globalDefsCode + '\n';

          output = output.substring(0, insertPos) + injectionCode + output.substring(insertPos);
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injected ${layoutDecls.length} layout decls + globalDefs after critical uniforms at position ${insertPos}`);
        }
      } else {
        // Fallback: Find insertion point after ALL precision declarations (last one)
        const precisionRegex = /precision\s+\w+\s+\w+\s*;\s*\n/g;
        let lastMatch;
        let precisionMatch;
        while ((precisionMatch = precisionRegex.exec(output)) !== null) {
          lastMatch = precisionMatch;
        }

        if (lastMatch) {
          const insertPos = lastMatch.index + lastMatch[0].length;

          // Insert layout declarations + global definitions
          let injectionCode = '';
          if (layoutDecls.length > 0) {
            injectionCode += '// Vertex shader inputs and outputs (moved early for WebGL compatibility)\n';
            injectionCode += layoutDecls.join('\n') + '\n\n';
          }
          injectionCode += globalDefsCode + '\n';

          output = output.substring(0, insertPos) + '\n' + injectionCode + output.substring(insertPos);
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injected ${layoutDecls.length} layout decls + globalDefs after last precision at position ${insertPos}`);
        } else {
          // No precision found, insert after #version
          const versionEnd = output.search(/#version.*?\n/);
          if (versionEnd !== -1) {
            const versionMatch3 = output.match(/#version.*?\n/);
            if (versionMatch3) {
              const insertPos = versionEnd + versionMatch3[0].length;

              // Insert layout declarations + global definitions
              let injectionCode = '';
              if (layoutDecls.length > 0) {
                injectionCode += '// Vertex shader inputs and outputs (moved early for WebGL compatibility)\n';
                injectionCode += layoutDecls.join('\n') + '\n\n';
              }
              injectionCode += globalDefsCode + '\n';

              output = output.substring(0, insertPos) + '\n' + injectionCode + output.substring(insertPos);
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injected ${layoutDecls.length} layout decls + globalDefs after #version at position ${insertPos}`);
            }
          }
        }
      }

      // CRITICAL FIX: Inject global variable initializations at the start of main()
      // Extract initializations from globalDefs.globals that have initializers
      const initializations: string[] = [];
      for (const globalDecl of filteredGlobalDefs.globals) {
        const initMatch = globalDecl.match(/^[\w\s]+\s+(\w+)\s*=\s*(.+);$/);
        if (initMatch) {
          const name = initMatch[1];
          const init = initMatch[2];
          initializations.push(`  ${name} = ${init};`);
        }
      }

      if (initializations.length > 0) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injecting ${initializations.length} global variable initializations at start of main()`);
        // Find main() function and inject at the start
        const mainMatch = output.match(/void\s+main\s*\(\s*\)\s*{/);
        if (mainMatch) {
          const mainStart = output.indexOf(mainMatch[0]);
          const mainBodyStart = mainStart + mainMatch[0].length;
          const initCode = '\n  // Initialize global variables (WebGL doesn\'t support initialized non-const globals)\n' + initializations.join('\n') + '\n';
          output = output.substring(0, mainBodyStart) + initCode + output.substring(mainBodyStart);
        }
      }
    }

    // Debug fragment global injection - check if globals were actually added
    if (!isVertex && globalDefsCode) {
      const globalVarCount = (globalDefsCode.match(/(?:float|int|vec\d|mat\d|bool)\s+[A-Z_][A-Z0-9_]*\s*=/g) || []).length;
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fragment global vars in injected code: ${globalVarCount}`);

      // Sample the first few global variables to verify
      const sampleGlobals = globalDefsCode.match(/(?:float|int|vec\d|mat\d|bool)\s+([A-Z_][A-Z0-9_]*)\s*=/g);
      if (sampleGlobals && sampleGlobals.length > 0) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fragment global samples:`, sampleGlobals.slice(0, 5));
      }
    }

    // Debug: Check HHLP RIGHT AFTER global defs injection
    if (output.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = output.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = output.lastIndexOf('\n', idx) + 1;
      const lineEnd = output.indexOf('\n', idx);
      const functionLine = output.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      console.log('[convertToWebGL CHECKPOINT 1] RIGHT AFTER global defs injection:', functionLine);
    }

    // Add RetroArch params and shader parameter uniforms
    // Extract existing UBO/push constant member names to avoid redefinition
    const existingMembers = new Set<string>();
    bindings.forEach(binding => {
      if (binding.members) {
        binding.members.forEach(member => existingMembers.add(member.name));
      }
    });

    // Also extract #define names to avoid conflicts (uniforms can't have same name as #defines)
    const existingDefines = new Set<string>();
    globalDefs.defines.forEach(def => {
      const match = def.match(/#define\s+(\w+)/);
      if (match) existingDefines.add(match[1]);
    });

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stage conversion - found ${existingMembers.size} existing binding members`);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stage conversion - found ${existingDefines.size} existing #defines`);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stage conversion - processing ${parameters.length} shader parameters`);

    // Build parameter uniforms (skip if duplicate in parameters array OR already a #define)
    // CRITICAL FIX: DON'T skip parameters that are in UBO/push constants!
    // After params. replacement (params.pre_bb → pre_bb), the shader needs a uniform named pre_bb
    // Even though pre_bb is a push constant member, we still need to create the uniform
    const seenParams = new Set<string>();
    const filtered = parameters.filter(param => {
      // DON'T filter out if already in UBO/push constant - we still need the uniform!
      // The params. replacement converts params.X to X, so we need uniform X
      if (existingDefines.has(param.name)) return false; // Already a #define
      if (seenParams.has(param.name)) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping duplicate parameter: ${param.name}`);
        return false; // Duplicate in parameters array
      }
      seenParams.add(param.name);
      return true;
    });

    // Log how many push constant parameters are being converted to uniforms
    const pushConstantParams = parameters.filter(param => existingMembers.has(param.name));
    if (pushConstantParams.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Creating uniforms for ${pushConstantParams.length} push constant parameters (after params. replacement):`, pushConstantParams.map(p => p.name).slice(0, 20).join(', '));
    }

    const paramUniforms = filtered
      .map(param => `uniform float ${param.name};`)
      .join('\n');

    // Mega Bezel parameters - injected as mutable variables, not uniforms
    // Most HSM parameters need to be assignable variables, not read-only uniforms
    let megaBezelVariables = '';

    if (stage === 'fragment') {
      // Add stub samplers for bezel-and-image-layers textures
      // Only add samplers that don't already exist in the source
      const stubSamplers: string[] = [];

      // List of required samplers for bezel-and-image-layers
      const requiredSamplers = [
        'InfoCachePass',
        'BackgroundImage',
        'BackgroundVertImage',
        'NightLightingImage',
        'NightLighting2Image',
        'LEDImage',
        'FrameTextureImage',
        'DeviceImage',
        'DeviceVertImage',
        'DeviceLEDImage',
        'DecalImage',
        'CabinetGlassImage',
        'TopLayerImage',
        'ReflectionMaskImage',
        'BR_LayersOverCRTPassFeedback',
        'BR_LayersUnderCRTPassFeedback'
      ];

      // Only add samplers that aren't already declared
      for (const samplerName of requiredSamplers) {
        // Check if sampler already exists in source
        const samplerRegex = new RegExp(`uniform\\s+sampler2D\\s+${samplerName}`, 'g');
        if (!source.includes(samplerName) || !samplerRegex.test(source)) {
          stubSamplers.push(`uniform sampler2D ${samplerName};`);
        }
      }

      megaBezelVariables = stubSamplers.length > 0
        ? '// Stub texture samplers for bezel-and-image-layers\n' + stubSamplers.join('\n') + '\n'
        : '';

      // Add HSM uniforms
      megaBezelVariables += `
float HSM_AB_COMPARE_AREA = 0.0;
uniform float HSM_AB_COMPARE_FREEZE_CRT_TUBE;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_HUE;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_DREZ_HSHARP0;
uniform float HSM_DREZ_SIGMA_HV;
uniform float HSM_DREZ_SHAR;
uniform float HSM_DREZ_THRESHOLD_RATIO;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_EDGE_THICKNESS;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_HUE;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float HSM_PASS_VIEWER_EMPTY_LINE;
uniform float HSM_PASS_VIEWER_TITLE;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_POST_CRT_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BLACK_LEVEL;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BRIGHTNESS;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_EMPTY_LINE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_TITLE;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_SCREEN_REFLECTION_FOLLOW_DIFFUSE_THICKNESS;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_LINE;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_TITLE;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_USE_GEOM;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float SCREEN_ASPECT;
uniform vec2 SCREEN_COORD;
uniform float DEFAULT_SRGB_GAMMA;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float no_scanlines;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
// NOTE: Sharpen uniforms (SHARPEN_ON, CSHARPEN, CCONTR, CDETAILS, DEBLUR) are created
// from pragma parameters in the shader source - DO NOT declare them here to avoid conflicts
float HSM_AB_COMPARE_AREA = 0.0;
uniform float HSM_AB_COMPARE_FREEZE_CRT_TUBE;
uniform float HSM_AB_COMPARE_FREEZE_GRAPHICS;
uniform float HSM_AB_COMPARE_SHOW_MODE;
uniform float HSM_AB_COMPARE_SPLIT_POSITION;
uniform float HSM_AMBIENT_LIGHTING_OPACITY;
uniform float HSM_AMBIENT_LIGHTING_SWAP_IMAGE_MODE;
uniform float HSM_AMBIENT1_CONTRAST;
uniform float HSM_AMBIENT1_DITHERING_SAMPLES;
uniform float HSM_AMBIENT1_HUE;
uniform float HSM_AMBIENT1_MIRROR_HORZ;
uniform float HSM_AMBIENT1_OPACITY;
uniform float HSM_AMBIENT1_POSITION_X;
uniform float HSM_AMBIENT1_POSITION_Y;
uniform float HSM_AMBIENT1_POS_INHERIT_MODE;
uniform float HSM_AMBIENT1_ROTATE;
uniform float HSM_AMBIENT1_SATURATION;
uniform float HSM_AMBIENT1_SCALE;
uniform float HSM_AMBIENT1_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT1_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT1_SCALE_X;
uniform float HSM_AMBIENT1_VALUE;
uniform float HSM_AMBIENT2_CONTRAST;
uniform float HSM_AMBIENT2_HUE;
uniform float HSM_AMBIENT2_MIRROR_HORZ;
uniform float HSM_AMBIENT2_OPACITY;
uniform float HSM_AMBIENT2_POSITION_X;
uniform float HSM_AMBIENT2_POSITION_Y;
uniform float HSM_AMBIENT2_POS_INHERIT_MODE;
uniform float HSM_AMBIENT2_ROTATE;
uniform float HSM_AMBIENT2_SATURATION;
uniform float HSM_AMBIENT2_SCALE;
uniform float HSM_AMBIENT2_SCALE_INHERIT_MODE;
uniform float HSM_AMBIENT2_SCALE_KEEP_ASPECT;
uniform float HSM_AMBIENT2_SCALE_X;
uniform float HSM_AMBIENT2_VALUE;
uniform float HSM_ANTI_FLICKER_ON;
uniform float HSM_ANTI_FLICKER_THRESHOLD;
uniform float HSM_ASPECT_RATIO_EXPLICIT;
uniform float HSM_ASPECT_RATIO_MODE;
uniform float HSM_ASPECT_RATIO_ORIENTATION;
uniform float HSM_BG_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BG_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_BG_BLEND_MODE;
uniform float HSM_BG_BRIGHTNESS;
uniform float HSM_BG_COLORIZE_ON;
uniform float HSM_BG_CUTOUT_MODE;
uniform float HSM_BG_DUALSCREEN_VIS_MODE;
uniform float HSM_BG_FILL_MODE;
uniform float HSM_BG_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_BG_FOLLOW_LAYER;
uniform float HSM_BG_FOLLOW_MODE;
uniform float HSM_BG_GAMMA;
uniform float HSM_BG_HUE;
uniform float HSM_BG_LAYER_ORDER;
uniform float HSM_BG_MASK_MODE;
uniform float HSM_BG_MIPMAPPING_BLEND_BIAS;
uniform float HSM_BG_OPACITY;
uniform float HSM_BG_POS_X;
uniform float HSM_BG_POS_Y;
uniform float HSM_BG_SATURATION;
uniform float HSM_BG_SCALE;
uniform float HSM_BG_SCALE_X;
uniform float HSM_BG_SOURCE_MATTE_TYPE;
uniform float HSM_BG_SPLIT_PRESERVE_CENTER;
uniform float HSM_BG_SPLIT_REPEAT_WIDTH;
uniform float HSM_BG_WRAP_MODE;
uniform float HSM_BZL_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_AMBIENT2_LIGHTING_MULTIPLIER;
uniform float HSM_BZL_BLEND_MODE;
uniform float HSM_BZL_BRIGHTNESS;
uniform float HSM_BZL_BRIGHTNESS_MULT_BOTTOM;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_LEFT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDE_RIGHT;
uniform float HSM_BZL_BRIGHTNESS_MULT_SIDES;
uniform float HSM_BZL_BRIGHTNESS_MULT_TOP;
uniform float HSM_BZL_COLOR_HUE;
uniform float HSM_BZL_COLOR_SATURATION;
uniform float HSM_BZL_COLOR_VALUE;
uniform float HSM_BZL_HEIGHT;
uniform float HSM_BZL_HIGHLIGHT;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_LONG_AXIS;
uniform float HSM_BZL_INDEPENDENT_CURVATURE_SCALE_SHORT_AXIS;
uniform float HSM_BZL_INDEPENDENT_SCALE;
uniform float HSM_BZL_INNER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_INNER_CURVATURE_SCALE;
uniform float HSM_BZL_INNER_EDGE_HIGHLIGHT;
uniform float HSM_BZL_INNER_EDGE_SHADOW;
uniform float HSM_BZL_INNER_EDGE_SHARPNESS;
uniform float HSM_BZL_INNER_EDGE_THICKNESS;
uniform float HSM_BZL_NOISE;
uniform float HSM_BZL_OPACITY;
uniform float HSM_BZL_OUTER_CORNER_RADIUS_SCALE;
uniform float HSM_BZL_OUTER_CURVATURE_SCALE;
uniform float HSM_BZL_OUTER_POSITION_Y;
uniform float HSM_BZL_SCALE_OFFSET;
uniform float HSM_BZL_USE_INDEPENDENT_CURVATURE;
uniform float HSM_BZL_USE_INDEPENDENT_SCALE;
uniform float HSM_BZL_WIDTH;
uniform float HSM_CACHE_GRAPHICS_ON;
uniform float HSM_CACHE_UPDATE_INDICATOR_MODE;
uniform float HSM_CORE_RES_SAMPLING_MULT_OPPOSITE_DIR;
uniform float HSM_CORE_RES_SAMPLING_MULT_SCANLINE_DIR;
uniform float HSM_CROP_BLACK_THRESHOLD;
uniform float HSM_CROP_MODE;
uniform float HSM_CROP_PERCENT_BOTTOM;
uniform float HSM_CROP_PERCENT_LEFT;
uniform float HSM_CROP_PERCENT_RIGHT;
uniform float HSM_CROP_PERCENT_TOP;
uniform float HSM_CROP_PERCENT_ZOOM;
uniform float HSM_CRT_BLEND_AMOUNT;
uniform float HSM_CRT_BLEND_MODE;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_CURVATURE_2D_SCALE_LONG_AXIS;
uniform float HSM_CURVATURE_2D_SCALE_SHORT_AXIS;
uniform float HSM_CURVATURE_3D_RADIUS;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_X;
uniform float HSM_CURVATURE_3D_TILT_ANGLE_Y;
uniform float HSM_CURVATURE_3D_VIEW_DIST;
uniform float HSM_CURVATURE_MODE;
uniform float HSM_DOWNSAMPLE_BLUR_OPPOSITE_DIR;
uniform float HSM_DOWNSAMPLE_BLUR_SCANLINE_DIR;
uniform float HSM_DREZ_HSHARP0;
uniform float HSM_DREZ_SIGMA_HV;
uniform float HSM_DREZ_SHAR;
uniform float HSM_DREZ_THRESHOLD_RATIO;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_MODE;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SWAP_SCREENS;
uniform float HSM_DUALSCREEN_CORE_IMAGE_SPLIT_OFFSET;
uniform float HSM_DUALSCREEN_MODE;
uniform float HSM_DUALSCREEN_POSITION_OFFSET_BETWEEN_SCREENS;
uniform float HSM_DUALSCREEN_SHIFT_POSITION_WITH_SCALE;
uniform float HSM_DUALSCREEN_VIEWPORT_SPLIT_LOCATION;
uniform float HSM_FAKE_SCANLINE_CURVATURE;
uniform float HSM_FAKE_SCANLINE_INT_SCALE;
uniform float HSM_FAKE_SCANLINE_MODE;
uniform float HSM_FAKE_SCANLINE_OPACITY;
uniform float HSM_FAKE_SCANLINE_RES;
uniform float HSM_FAKE_SCANLINE_RES_MODE;
uniform float HSM_FAKE_SCANLINE_ROLL;
uniform float HSM_FLIP_CORE_HORIZONTAL;
uniform float HSM_FLIP_CORE_VERTICAL;
uniform float HSM_FLIP_VIEWPORT_HORIZONTAL;
uniform float HSM_FLIP_VIEWPORT_VERTICAL;
uniform float HSM_FRM_BLEND_MODE;
uniform float HSM_FRM_COLOR_HUE;
uniform float HSM_FRM_COLOR_SATURATION;
uniform float HSM_FRM_COLOR_VALUE;
uniform float HSM_FRM_INNER_EDGE_HIGHLIGHT;
uniform float HSM_FRM_INNER_EDGE_THICKNESS;
uniform float HSM_FRM_NOISE;
uniform float HSM_FRM_OPACITY;
uniform float HSM_FRM_OUTER_CORNER_RADIUS;
uniform float HSM_FRM_OUTER_CURVATURE_SCALE;
uniform float HSM_FRM_OUTER_EDGE_SHADING;
uniform float HSM_FRM_OUTER_EDGE_THICKNESS;
uniform float HSM_FRM_OUTER_POS_Y;
uniform float HSM_FRM_SHADOW_OPACITY;
uniform float HSM_FRM_SHADOW_WIDTH;
uniform float HSM_FRM_TEXTURE_BLEND_MODE;
uniform float HSM_FRM_TEXTURE_OPACITY;
uniform float HSM_FRM_THICKNESS;
uniform float HSM_FRM_THICKNESS_SCALE_X;
uniform float HSM_FRM_USE_INDEPENDENT_COLOR;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_GLOBAL_GRAPHICS_BRIGHTNESS;
uniform float HSM_INT_SCALE_MAX_HEIGHT;
uniform float HSM_INT_SCALE_MODE;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET;
uniform float HSM_INT_SCALE_MULTIPLE_OFFSET_LONG;
uniform float HSM_INTERLACE_EFFECT_SMOOTHNESS_INTERS;
uniform float HSM_INTERLACE_MODE;
uniform float HSM_INTERLACE_SCANLINE_EFFECT;
uniform float HSM_INTERLACE_TRIGGER_RES;
uniform float HSM_INTRO_LOGO_BLEND_MODE;
uniform float HSM_INTRO_LOGO_FADE_IN;
uniform float HSM_INTRO_LOGO_FADE_OUT;
uniform float HSM_INTRO_LOGO_FLIP_VERTICAL;
uniform float HSM_INTRO_LOGO_HEIGHT;
uniform float HSM_INTRO_LOGO_HOLD;
uniform float HSM_INTRO_LOGO_OVER_SOLID_COLOR;
uniform float HSM_INTRO_LOGO_PLACEMENT;
uniform float HSM_INTRO_LOGO_POS_X;
uniform float HSM_INTRO_LOGO_POS_Y;
uniform float HSM_INTRO_LOGO_WAIT;
uniform float HSM_INTRO_NOISE_BLEND_MODE;
uniform float HSM_INTRO_NOISE_FADE_OUT;
uniform float HSM_INTRO_NOISE_HOLD;
uniform float HSM_INTRO_SOLID_BLACK_FADE_OUT;
uniform float HSM_INTRO_SOLID_BLACK_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_BLEND_MODE;
uniform float HSM_INTRO_SOLID_COLOR_FADE_OUT;
uniform float HSM_INTRO_SOLID_COLOR_HOLD;
uniform float HSM_INTRO_SOLID_COLOR_HUE;
uniform float HSM_INTRO_SOLID_COLOR_SAT;
uniform float HSM_INTRO_SOLID_COLOR_VALUE;
uniform float HSM_INTRO_SPEED;
uniform float HSM_INTRO_WHEN_TO_SHOW;
uniform float HSM_LAYERING_DEBUG_MASK_MODE;
uniform float HSM_LED_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_LED_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_LED_BLEND_MODE;
uniform float HSM_LED_BRIGHTNESS;
uniform float HSM_LED_COLORIZE_ON;
uniform float HSM_LED_CUTOUT_MODE;
uniform float HSM_LED_DUALSCREEN_VIS_MODE;
uniform float HSM_LED_FILL_MODE;
uniform float HSM_LED_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_LED_FOLLOW_LAYER;
uniform float HSM_LED_FOLLOW_MODE;
uniform float HSM_LED_GAMMA;
uniform float HSM_LED_HUE;
uniform float HSM_LED_LAYER_ORDER;
uniform float HSM_LED_MASK_MODE;
uniform float HSM_LED_MIPMAPPING_BLEND_BIAS;
uniform float HSM_LED_OPACITY;
uniform float HSM_LED_POS_X;
uniform float HSM_LED_POS_Y;
uniform float HSM_LED_SATURATION;
uniform float HSM_LED_SCALE;
uniform float HSM_LED_SCALE_X;
uniform float HSM_LED_SOURCE_MATTE_TYPE;
uniform float HSM_LED_SPLIT_PRESERVE_CENTER;
uniform float HSM_LED_SPLIT_REPEAT_WIDTH;
uniform float HSM_MONOCHROME_BRIGHTNESS;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_MONOCHROME_GAMMA;
uniform float HSM_MONOCHROME_HUE_OFFSET;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_SATURATION;
uniform float HSM_NON_INTEGER_SCALE;
uniform float HSM_NON_INTEGER_SCALE_OFFSET;
uniform float HSM_OVERSCAN_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_AMOUNT;
uniform float HSM_OVERSCAN_RASTER_BLOOM_MODE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE;
uniform float HSM_OVERSCAN_RASTER_BLOOM_NEUTRAL_RANGE_CENTER;
uniform float HSM_OVERSCAN_RASTER_BLOOM_ON;
uniform float HSM_OVERSCAN_X;
uniform float HSM_OVERSCAN_Y;
uniform float HSM_PASS_VIEWER_EMPTY_LINE;
uniform float HSM_PASS_VIEWER_TITLE;
uniform float HSM_PHYSICAL_MONITOR_ASPECT_RATIO;
uniform float HSM_PHYSICAL_MONITOR_DIAGONAL_SIZE;
uniform float HSM_PHYSICAL_SIM_TUBE_DIAGONAL_SIZE;
uniform float HSM_PLACEMENT_IMAGE_MODE;
uniform float HSM_PLACEMENT_IMAGE_USE_HORIZONTAL;
uniform float HSM_POST_CRT_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_BRIGHTNESS;
uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
uniform float HSM_POTATO_SHOW_BG_OVER_SCREEN;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_BEZEL_INNER_EDGE_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_BLUR_FALLOFF_DISTANCE;
uniform float HSM_REFLECT_BLUR_MAX;
uniform float HSM_REFLECT_BLUR_MIN;
uniform float HSM_REFLECT_BLUR_NUM_SAMPLES;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BLACK_LEVEL;
uniform float HSM_REFLECT_BRIGHTNESS_NOISE_BRIGHTNESS;
uniform float HSM_REFLECT_CORNER_FADE;
uniform float HSM_REFLECT_CORNER_FADE_DISTANCE;
uniform float HSM_REFLECT_CORNER_INNER_SPREAD;
uniform float HSM_REFLECT_CORNER_OUTER_SPREAD;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_BOTTOM;
uniform float HSM_REFLECT_CORNER_ROTATION_OFFSET_TOP;
uniform float HSM_REFLECT_CORNER_SPREAD_FALLOFF;
uniform float HSM_REFLECT_DIFFUSED_AMOUNT;
uniform float HSM_REFLECT_DIRECT_AMOUNT;
uniform float HSM_REFLECT_FADE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_AMOUNT;
uniform float HSM_REFLECT_FRAME_INNER_EDGE_SHARPNESS;
uniform float HSM_REFLECT_FULLSCREEN_GLOW;
uniform float HSM_REFLECT_FULLSCREEN_GLOW_GAMMA;
uniform float HSM_REFLECT_GLOBAL_AMOUNT;
uniform float HSM_REFLECT_GLOBAL_GAMMA_ADJUST;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_DISTANCE;
uniform float HSM_REFLECT_LATERAL_OUTER_FADE_POSITION;
uniform float HSM_REFLECT_MASK_BLACK_LEVEL;
uniform float HSM_REFLECT_MASK_BRIGHTNESS;
uniform float HSM_REFLECT_MASK_FOLLOW_LAYER;
uniform float HSM_REFLECT_MASK_FOLLOW_MODE;
uniform float HSM_REFLECT_MASK_IMAGE_AMOUNT;
uniform float HSM_REFLECT_MASK_MIPMAPPING_BLEND_BIAS;
uniform float HSM_REFLECT_NOISE_AMOUNT;
uniform float HSM_REFLECT_NOISE_SAMPLE_DISTANCE;
uniform float HSM_REFLECT_NOISE_SAMPLES;
uniform float HSM_REFLECT_RADIAL_FADE_HEIGHT;
uniform float HSM_REFLECT_RADIAL_FADE_WIDTH;
uniform float HSM_REFLECT_SHOW_TUBE_FX_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_AMOUNT;
uniform float HSM_REFLECT_VIGNETTE_SIZE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_EMPTY_LINE;
uniform float HSM_RENDER_FOR_SIMPLIFIED_TITLE;
uniform float HSM_MONOCHROME_MODE;
uniform float HSM_MONOCHROME_DUALSCREEN_VIS_MODE;
uniform float HSM_GLOBAL_CORNER_RADIUS;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_CRT_SCREEN_BLEND_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_CRT_CURVATURE_SCALE;
uniform float HSM_RENDER_SIMPLE_MASK_TYPE;
uniform float HSM_RENDER_SIMPLE_MODE;
uniform float HSM_RESOLUTION_DEBUG_ON;
uniform float HSM_ROTATE_CORE_IMAGE;
uniform float HSM_SCANLINE_DIRECTION;
uniform float HSM_SCREEN_CORNER_RADIUS_SCALE;
uniform float HSM_SCREEN_POSITION_X;
uniform float HSM_SCREEN_POSITION_Y;
uniform float HSM_SCREEN_REFLECTION_FOLLOW_DIFFUSE_THICKNESS;
uniform float HSM_SCREEN_REFLECTION_POS_X;
uniform float HSM_SCREEN_REFLECTION_POS_Y;
uniform float HSM_SCREEN_REFLECTION_SCALE;
uniform float HSM_SCREEN_VIGNETTE_DUALSCREEN_VIS_MODE;
uniform float HSM_SCREEN_VIGNETTE_IN_REFLECTION;
uniform float HSM_SCREEN_VIGNETTE_ON;
uniform float HSM_SCREEN_VIGNETTE_POWER;
uniform float HSM_SCREEN_VIGNETTE_STRENGTH;
uniform float HSM_SHOW_CRT_ON_TOP_OF_COLORED_GEL;
uniform float HSM_SHOW_PASS_ALPHA;
uniform float HSM_SHOW_PASS_APPLY_SCREEN_COORD;
uniform float HSM_SHOW_PASS_INDEX;
uniform float HSM_SIGNAL_NOISE_AMOUNT;
uniform float HSM_SIGNAL_NOISE_BLACK_LEVEL;
uniform float HSM_SIGNAL_NOISE_ON;
uniform float HSM_SIGNAL_NOISE_SIZE_MODE;
uniform float HSM_SIGNAL_NOISE_SIZE_MULT;
uniform float HSM_SIGNAL_NOISE_TYPE;
uniform float HSM_SINDEN_BORDER_BRIGHTNESS;
uniform float HSM_SINDEN_BORDER_EMPTY_TUBE_COMPENSATION;
uniform float HSM_SINDEN_BORDER_ON;
uniform float HSM_SINDEN_BORDER_THICKNESS;
uniform float HSM_SNAP_TO_CLOSEST_INT_SCALE_TOLERANCE;
uniform float HSM_STATIC_LAYERS_GAMMA;
uniform float HSM_TOP_AMBIENT_LIGHTING_MULTIPLIER;
uniform float HSM_TOP_APPLY_AMBIENT_IN_ADD_MODE;
uniform float HSM_TOP_BLEND_MODE;
uniform float HSM_TOP_BRIGHTNESS;
uniform float HSM_TOP_COLORIZE_ON;
uniform float HSM_TOP_CUTOUT_MODE;
uniform float HSM_TOP_DUALSCREEN_VIS_MODE;
uniform float HSM_TOP_FILL_MODE;
uniform float HSM_TOP_FOLLOW_FULL_USES_ZOOM;
uniform float HSM_TOP_FOLLOW_LAYER;
uniform float HSM_TOP_FOLLOW_MODE;
uniform float HSM_TOP_GAMMA;
uniform float HSM_TOP_HUE;
uniform float HSM_TOP_LAYER_ORDER;
uniform float HSM_TOP_MASK_MODE;
uniform float HSM_TOP_MIPMAPPING_BLEND_BIAS;
uniform float HSM_TOP_OPACITY;
uniform float HSM_TOP_POS_X;
uniform float HSM_TOP_POS_Y;
uniform float HSM_TOP_SATURATION;
uniform float HSM_TOP_SCALE;
uniform float HSM_TOP_SCALE_X;
uniform float HSM_TOP_SOURCE_MATTE_TYPE;
uniform float HSM_TOP_SPLIT_PRESERVE_CENTER;
uniform float HSM_TOP_SPLIT_REPEAT_WIDTH;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_LINE;
uniform float HSM_TUBE_ASPECT_AND_EMPTY_TITLE;
uniform float HSM_TUBE_BLACK_EDGE_CORNER_RADIUS_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_CURVATURE_SCALE;
uniform float HSM_TUBE_BLACK_EDGE_SHARPNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS;
uniform float HSM_TUBE_BLACK_EDGE_THICKNESS_X_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ADDITIVE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FAKE_SCANLINE_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_HORIZONTAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_FLIP_VERTICAL;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_BRIGHTNESS;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_VIGNETTE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_ON;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_SCALE;
uniform float HSM_TUBE_COLORED_GEL_IMAGE_TRANSPARENCY_THRESHOLD;
uniform float HSM_TUBE_DIFFUSE_FORCE_ASPECT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_DIFFUSE_IMAGE_AMOUNT;
uniform float HSM_TUBE_DIFFUSE_IMAGE_BRIGHTNESS;
uniform float HSM_TUBE_DIFFUSE_IMAGE_COLORIZE_ON;
uniform float HSM_TUBE_DIFFUSE_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_GAMMA;
uniform float HSM_TUBE_DIFFUSE_IMAGE_HUE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_ROTATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SATURATION;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE;
uniform float HSM_TUBE_DIFFUSE_IMAGE_SCALE_X;
uniform float HSM_TUBE_DIFFUSE_MODE;
uniform float HSM_TUBE_EMPTY_THICKNESS;
uniform float HSM_TUBE_EMPTY_THICKNESS_X_SCALE;
uniform float HSM_TUBE_OPACITY;
uniform float HSM_TUBE_SHADOW_CURVATURE_SCALE;
uniform float HSM_TUBE_SHADOW_IMAGE_ON;
uniform float HSM_TUBE_SHADOW_IMAGE_OPACITY;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_X;
uniform float HSM_TUBE_SHADOW_IMAGE_POS_Y;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_X;
uniform float HSM_TUBE_SHADOW_IMAGE_SCALE_Y;
uniform float HSM_TUBE_STATIC_AMBIENT_LIGHTING;
uniform float HSM_TUBE_STATIC_AMBIENT2_LIGHTING;
uniform float HSM_TUBE_STATIC_BLACK_LEVEL;
uniform float HSM_TUBE_STATIC_DITHER_AMOUNT;
uniform float HSM_TUBE_STATIC_DITHER_DISTANCE;
uniform float HSM_TUBE_STATIC_DITHER_SAMPLES;
uniform float HSM_TUBE_STATIC_OPACITY_DIFFUSE_MULTIPLY;
uniform float HSM_TUBE_STATIC_POS_X;
uniform float HSM_TUBE_STATIC_POS_Y;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_ON;
uniform float HSM_TUBE_STATIC_REFLECTION_IMAGE_OPACITY;
uniform float HSM_TUBE_STATIC_SCALE;
uniform float HSM_TUBE_STATIC_SCALE_X;
uniform float HSM_TUBE_STATIC_SHADOW_OPACITY;
uniform float HSM_USE_GEOM;
uniform float HSM_USE_IMAGE_FOR_PLACEMENT;
uniform float HSM_USE_PHYSICAL_SIZE_FOR_NON_INTEGER;
uniform float HSM_USE_SNAP_TO_CLOSEST_INT_SCALE;
uniform float HSM_VERTICAL_PRESET;
uniform float HSM_VIEWPORT_POSITION_X;
uniform float HSM_VIEWPORT_POSITION_Y;
uniform float HSM_VIEWPORT_VIGNETTE_CUTOUT_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_FOLLOW_LAYER;
uniform float HSM_VIEWPORT_VIGNETTE_LAYER_ORDER;
uniform float HSM_VIEWPORT_VIGNETTE_MASK_MODE;
uniform float HSM_VIEWPORT_VIGNETTE_OPACITY;
uniform float HSM_VIEWPORT_VIGNETTE_POS_X;
uniform float HSM_VIEWPORT_VIGNETTE_POS_Y;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE;
uniform float HSM_VIEWPORT_VIGNETTE_SCALE_X;
uniform float HSM_VIEWPORT_ZOOM;
uniform float HSM_VIEWPORT_ZOOM_MASK;
uniform float HSM_2ND_SCREEN_ASPECT_RATIO_MODE;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_BOTTOM;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_LEFT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_RIGHT;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_TOP;
uniform float HSM_2ND_SCREEN_CROP_PERCENT_ZOOM;
uniform float HSM_2ND_SCREEN_INDEPENDENT_SCALE;
uniform float HSM_2ND_SCREEN_POS_X;
uniform float HSM_2ND_SCREEN_POS_Y;
uniform float HSM_2ND_SCREEN_SCALE_OFFSET;
uniform float SCREEN_ASPECT;
uniform vec2 SCREEN_COORD;
uniform float DEFAULT_SRGB_GAMMA;
uniform float GAMMA_INPUT;
uniform float gamma_out;
uniform float post_br;
uniform float post_br_affect_black_level;
uniform float no_scanlines;
uniform float iscans;
uniform float vga_mode;
uniform float hiscan;
// NOTE: Sharpen uniforms (SHARPEN_ON, CSHARPEN, CCONTR, CDETAILS, DEBLUR) are created
// from pragma parameters in the shader source - DO NOT declare them here to avoid conflicts
`;

      // FIX: Don't inject megaBezelVariables or paramUniforms here
      // They're handled by convertBindingsToUniforms() which reads shader parameters
      // Injecting them here causes duplicate uniform declarations and shader compilation errors

      // The megaBezelVariables list is a huge hardcoded set of Mega Bezel uniforms
      // that will be created as needed from the shader parameters list
      // No manual injection needed!
    }

    // NOTE: CRT uniforms like gamma_out, GAMMA_INPUT, etc. are created by
    // convertBindingsToUniforms() from UBO members. No additional injection needed.
    // If they're not being created, the issue is in UBO extraction, not here.

    // Debug: Check HHLP BEFORE swizzle replacements
    if (output.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = output.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = output.lastIndexOf('\n', idx) + 1;
      const lineEnd = output.indexOf('\n', idx);
      const functionLine = output.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      console.log('[convertToWebGL CHECKPOINT 2] BEFORE swizzle replacements:', functionLine);
    }

    // Convert Slang-specific syntax
    // Convert swizzle shorthand: 0.0.xxx → vec3(0.0), DEBLUR.xxx → vec3(DEBLUR)
    // Handle both literals and variables
    output = output.replace(/(\d+\.\d+)\.xxx\b/g, 'vec3($1)');
    output = output.replace(/(\d+\.\d+)\.xxxx\b/g, 'vec4($1)');
    output = output.replace(/(\d+\.\d+)\.xx\b/g, 'vec2($1)');
    output = output.replace(/(\d+)\.xxx\b/g, 'vec3($1.0)');
    output = output.replace(/(\d+)\.xxxx\b/g, 'vec4($1.0)');
    output = output.replace(/(\d+)\.xx\b/g, 'vec2($1.0)');

    // Handle variable.xxx swizzles (e.g., DEBLUR.xxx → vec3(DEBLUR))
    output = output.replace(/\b([a-zA-Z_]\w*)\.xxx\b/g, 'vec3($1)');
    output = output.replace(/\b([a-zA-Z_]\w*)\.xxxx\b/g, 'vec4($1)');
    output = output.replace(/\b([a-zA-Z_]\w*)\.xx\b/g, 'vec2($1)');

    // Debug: Check HHLP AFTER swizzle replacements
    if (output.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = output.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = output.lastIndexOf('\n', idx) + 1;
      const lineEnd = output.indexOf('\n', idx);
      const functionLine = output.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      console.log('[convertToWebGL CHECKPOINT 3] AFTER swizzle replacements:', functionLine);
    }

    // Fix global variable initialization with uniforms
    // GLSL doesn't allow global variables to be initialized with non-constant expressions
    // Convert: float invsqrsigma = 1.0/(2.0*PARAM*PARAM);
    // To: float invsqrsigma; void initGlobals() { invsqrsigma = ...; }
    output = this.convertGlobalInitializers(output);

    // Remove layout qualorms and convert to uniforms FIRST
    // This ensures int uniforms are in their final form before int/float conversion
    output = this.convertBindingsToUniforms(output, bindings, webgl2, globalDefs);

    // SOLUTION A (DUAL DECLARATION): Inject assignments from PARAM_ uniforms to global variables
    // This allows shader code to use plain variable names while receiving values from uniforms
    output = this.injectParamAssignments(output, globalDefs, bindings);

    // Convert int literals in comparisons to float literals for GLSL compatibility
    // uniform float X; if (X == 0) -> if (X == 0.0)
    // Pass bindings to extract int UBO member information
    output = this.convertIntLiteralsInComparisons(output, bindings);

    // Convert global uniform block references (e.g., global.MVP -> MVP)
    // Mega Bezel and other shaders use a 'global' UBO that gets converted to individual uniforms
    output = output.replace(/\bglobal\.(\w+)\b/g, '$1');

    // Strip initParams() calls (we don't use ParamsStruct anymore, uniforms are direct)
    // Match initParams() anywhere it appears, with optional semicolon
    output = output.replace(/\binitParams\s*\(\s*\)\s*;?/g, '/* initParams() removed */');

    // Convert Three.js standard attribute names (vertex stage only)
    // IMPORTANT: ONLY do this for WebGL1/Three.js - Pure WebGL2 uses Position/TexCoord directly
    if (stage === 'vertex' && !webgl2) {
      // Convert Slang attribute declarations to Three.js declarations
      // Position (vec4 in Slang) → position (vec3 in Three.js)
      output = output.replace(/\battribute\s+vec4\s+Position\s*;/g, 'attribute vec3 position;');
      output = output.replace(/\bin\s+vec4\s+Position\s*;/g, 'attribute vec3 position;');

      // TexCoord → uv (both vec2)
      output = output.replace(/\battribute\s+vec2\s+TexCoord\s*;/g, 'attribute vec2 uv;');
      output = output.replace(/\bin\s+vec2\s+TexCoord\s*;/g, 'attribute vec2 uv;');

      // Convert usage: Position is vec4 in Slang but vec3 in Three.js, so we need vec4(position, 1.0)
      output = output.replace(/\bPosition\b/g, 'vec4(position, 1.0)');
      // TexCoord → uv (both are vec2)
      output = output.replace(/\bTexCoord\b/g, 'uv');
    }

    // For WebGL2, add explicit layout qualifiers to vertex shader inputs
    // ONLY if they don't already have them (some Slang shaders already have layout qualifiers)
    if (stage === 'vertex' && webgl2) {
      // DEBUG: Check what's actually in the shader
      const hasInPosition = /in\s+vec4\s+Position/.test(output);
      const hasInTexCoord = /in\s+vec2\s+TexCoord/.test(output);
      const hasAttributePosition = /attribute\s+vec4\s+Position/.test(output);
      const hasAttributeTexCoord = /attribute\s+vec2\s+TexCoord/.test(output);

      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Vertex shader attributes found:
        - in vec4 Position: ${hasInPosition}
        - in vec2 TexCoord: ${hasInTexCoord}
        - attribute vec4 Position: ${hasAttributePosition}
        - attribute vec2 TexCoord: ${hasAttributeTexCoord}`);

      // Check if Position and TexCoord already have layout qualifiers (check specific attributes, not globally)
      const hasPositionLayout = /layout\s*\(\s*location\s*=\s*\d+\s*\)\s*in\s+vec4\s+Position/.test(output);
      const hasTexCoordLayout = /layout\s*\(\s*location\s*=\s*\d+\s*\)\s*in\s+vec2\s+TexCoord/.test(output);

      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Existing layout qualifiers:
        - Position has layout: ${hasPositionLayout}
        - TexCoord has layout: ${hasTexCoordLayout}`);

      // Add layout qualifiers if they don't exist for each attribute
      if (!hasPositionLayout) {
        const beforePosition = output.match(/\bin\s+vec4\s+Position\s*;/g)?.length || 0;
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Found ${beforePosition} instances of 'in vec4 Position;'`);
        output = output.replace(/\bin\s+vec4\s+Position\s*;/g, 'layout(location = 0) in vec4 Position;');
        const afterPosition = output.match(/layout\s*\(\s*location\s*=\s*0\s*\)\s*in\s+vec4\s+Position\s*;/g)?.length || 0;
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] After replacement: ${afterPosition} instances of 'layout(location = 0) in vec4 Position;'`);
        if (beforePosition > 0) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Added layout(location = 0) for Position`);
        }
      }

      if (!hasTexCoordLayout) {
        const beforeTexCoord = output.match(/\bin\s+vec2\s+TexCoord\s*;/g)?.length || 0;
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Found ${beforeTexCoord} instances of 'in vec2 TexCoord;'`);
        output = output.replace(/\bin\s+vec2\s+TexCoord\s*;/g, 'layout(location = 1) in vec2 TexCoord;');
        const afterTexCoord = output.match(/layout\s*\(\s*location\s*=\s*1\s*\)\s*in\s+vec2\s+TexCoord\s*;/g)?.length || 0;
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] After replacement: ${afterTexCoord} instances of 'layout(location = 1) in vec2 TexCoord;'`);
        if (beforeTexCoord > 0) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Added layout(location = 1) for TexCoord`);
        }
      }
    }

    // Convert varying/in/out keywords
    if (webgl2) {
      if (stage === 'vertex') {
        output = output.replace(/\battribute\b/g, 'in');
        output = output.replace(/\bvarying\b/g, 'out');
      } else {
        output = output.replace(/\bvarying\b/g, 'in');
      }

      // Handle fragment shader output for WebGL2 (GLSL ES 3.0)
      if (stage === 'fragment') {
        // Remove layout qualifiers from FragColor (WebGL2 doesn't need them)
        output = output.replace(/layout\s*\([^)]*\)\s*out\s+vec4\s+FragColor\s*;/gs, 'out vec4 FragColor;');

        // If no FragColor declaration exists, add it (required for GLSL ES 3.0)
        if (!output.includes('out vec4 FragColor')) {
          // Add after precision declarations
          const precisionMatch = output.match(/(precision\s+\w+\s+\w+\s*;\s*\n)/);
          if (precisionMatch) {
            output = output.replace(precisionMatch[0], precisionMatch[0] + 'out vec4 FragColor;\n');
          }
        }
        // Convert gl_FragColor to FragColor (GLSL ES 3.0 doesn't have gl_FragColor)
        output = output.replace(/\bgl_FragColor\b/g, 'FragColor');
      }
    } else {
      // WebGL 1.0: keep varying, attribute, gl_FragColor
      output = output.replace(/\bin\s+vec/g, 'varying vec'); // in → varying (fragment)
      output = output.replace(/\bout\s+vec/g, 'varying vec'); // out → varying (vertex)
    }

    // Fix ternary operator type mismatches
    // Convert: condition ? vec3(...) : 0.0 → condition ? vec3(...) : vec3(0.0)
    // Convert: condition ? 0.0 : vec3(...) → condition ? vec3(0.0) : vec3(...)
    output = this.fixTernaryOperatorTypes(output);

    // Convert texture functions
    if (webgl2) {
      // texture() is native in WebGL 2
    } else {
      // Convert texture() to texture2D()
      output = output.replace(/\btexture\s*\(/g, 'texture2D(');
      output = output.replace(/\btextureLod\s*\(/g, 'texture2D('); // Fallback
    }

    // Remove Vulkan-specific layout bindings
    // Three.js manages fragment outputs automatically, so remove layout from all in/out
    if (webgl2 && stage === 'fragment') {
      // Remove layout from 'in' declarations (varyings from vertex shader)
      // BUT keep 'in' keyword itself
      output = output.replace(/layout\s*\([^)]*\)\s+in\s+/g, 'in ');
      // Remove layout from 'out' declarations - Three.js manages outputs
      output = output.replace(/layout\s*\([^)]*\)\s+out\s+/g, 'out ');
      // Remove Vulkan-style layout qualifiers for samplers (set, binding)
      // These don't work in WebGL2/GLSL ES - we use gl.uniform1i() instead
      // Matches: layout(set = 0, binding = 2) uniform sampler2D ...
      output = output.replace(/layout\s*\(\s*set\s*=\s*\d+\s*,\s*binding\s*=\s*\d+\s*\)\s+/g, '');
      // Also match just binding without set
      output = output.replace(/layout\s*\(\s*binding\s*=\s*\d+\s*\)\s+/g, '');
      // Remove push_constant layout
      output = output.replace(/layout\s*\(\s*push_constant\s*\)\s*/g, '');
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Stripped Vulkan layout qualifiers from fragment shader`);

      // NOTE: We no longer inject initParams() - using direct uniforms instead of ParamsStruct
    } else {
      // For vertex shaders: preserve layout(location = N) for vertex attributes, remove others
      if (stage === 'vertex' && webgl2) {
        // Remove Vulkan-style layout qualifiers (set, binding, push_constant) but KEEP location
        output = output.replace(/layout\s*\(\s*set\s*=\s*\d+\s*,\s*binding\s*=\s*\d+\s*\)\s+/g, '');
        output = output.replace(/layout\s*\(\s*binding\s*=\s*\d+\s*\)\s+/g, '');
        output = output.replace(/layout\s*\(\s*push_constant\s*\)\s*/g, '');
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Preserved layout(location) for vertex attributes, stripped other layouts`);
      } else {
        // Remove all layout declarations for WebGL 1.0 or other stages
        output = output.replace(/layout\s*\([^)]*\)\s*/g, '');
      }
    }

    // DEBUG: Log final compiled shader
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Final compiled ${stage} shader (first 3000 chars):`);
    console.log(output.substring(0, 3000));
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ... (truncated, check for initParams and duplicate uniforms above)');

    // DEBUG: For vertex shaders, show lines around 1485-1495 to diagnose pass_0 error
    if (stage === 'vertex') {
      const lines = output.split('\n');
      if (lines.length >= 1490) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler DEBUG] Vertex shader lines 1485-1495 (total ${lines.length} lines):`);
        for (let i = 1484; i < Math.min(1495, lines.length); i++) {
          console.log(`  ${i + 1}: ${lines[i]}`);
        }
      }
    }

    // CRITICAL DEBUG: Check for samplers in compiled output
    if (stage === 'fragment' && output.includes('PreCRTPass')) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ✅ PreCRTPass found in compiled fragment shader');
      const samplerMatch = output.match(/uniform\s+sampler2D\s+PreCRTPass/);
      if (samplerMatch) {
        if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ✅ PreCRTPass sampler declaration found:', samplerMatch[0]);
      } else {
        if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] ❌ PreCRTPass sampler declaration NOT FOUND - only text reference exists');
      }
    }

    // CRITICAL DEBUG: Check vertex shader attributes for pass_4
    if (stage === 'vertex' && (output.includes('TexCoord') || output.includes('vTexCoord'))) {
      console.log('[SlangCompiler DEBUG VERTEX] Checking attributes...');
      const posMatch = output.match(/layout\s*\(\s*location\s*=\s*0\s*\)\s*in\s+vec4\s+Position/);
      const texMatch = output.match(/layout\s*\(\s*location\s*=\s*1\s*\)\s*in\s+vec2\s+TexCoord/);
      const varyingMatch = output.match(/out\s+vec2\s+vTexCoord/);
      const assignMatch = output.match(/vTexCoord\s*=\s*TexCoord/);
      console.log('[SlangCompiler DEBUG] Position layout:', posMatch ? '✅ FOUND' : '❌ MISSING');
      console.log('[SlangCompiler DEBUG] TexCoord layout:', texMatch ? '✅ FOUND' : '❌ MISSING');
      console.log('[SlangCompiler DEBUG] vTexCoord varying:', varyingMatch ? '✅ FOUND' : '❌ MISSING');
      console.log('[SlangCompiler DEBUG] Assignment:', assignMatch ? '✅ FOUND' : '❌ MISSING');

      // Dump first 1000 chars of vertex shader to see structure
      if (output.includes('afterglow') || output.includes('AFTERGLOW')) {
        console.log('[SlangCompiler DEBUG] Dumping pass_4-like vertex shader (first 1000 chars):');
        console.log(output.substring(0, 1000));
      }
    }

    // Debug: Check if hrg functions are in output
    if (output.includes('hrg_get_ideal_global_eye_pos_for_points')) {
      const funcDefMatch = output.match(/vec3 hrg_get_ideal_global_eye_pos_for_points\s*\([^)]*\)/);
      if (funcDefMatch) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found hrg_get_ideal_global_eye_pos_for_points definition: ${funcDefMatch[0].substring(0, 150)}`);
      } else {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] WARNING: hrg_get_ideal_global_eye_pos_for_points is in output but no function definition found!`);
      }

      // Check for HRG_MAX_POINT_CLOUD_SIZE define
      if (output.includes('HRG_MAX_POINT_CLOUD_SIZE')) {
        const hrgDefineMatch = output.match(/#define\s+HRG_MAX_POINT_CLOUD_SIZE\s+\d+/);
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] HRG_MAX_POINT_CLOUD_SIZE is in final output:`, hrgDefineMatch ? hrgDefineMatch[0] : 'FOUND BUT NO MATCH');
      } else {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ERROR: HRG_MAX_POINT_CLOUD_SIZE NOT in final output!`);
      }

      // Check for the function call
      const lines = output.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('hrg_get_ideal_global_eye_pos_for_points(')) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found function call at line ${i + 1}: ${lines[i].trim().substring(0, 100)}`);
          if (i > 0) if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler]   Previous line ${i}: ${lines[i-1].trim()}`);
          break;
        }
      }
    }

    // Debug: Check HHLP BEFORE returning from convertToWebGL
    if (output.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = output.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = output.lastIndexOf('\n', idx) + 1;
      const lineEnd = output.indexOf('\n', idx);
      const functionLine = output.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      console.log('[convertToWebGL CHECKPOINT 4] BEFORE return:', functionLine);
    }

    return output;
  }

  /**
   * Convert global variable initializers that use uniforms to function-based initialization
   */
  private static convertGlobalInitializers(source: string): string {
    // Find global variable declarations with initializers that might use uniforms
    // Pattern: float varname = expression;
    // at global scope (not inside functions)

    const globalInitPattern = /^(float|int|vec\d|mat\d)\s+(\w+)\s*=\s*([^;]+);/gm;
    const globalInits: Array<{ declaration: string; type: string; name: string; init: string }> = [];
    let match;

    // Variables that must remain mutable (assigned by HSM_UpdateGlobalScreenValuesFromCache)
    const mutableCacheVars = new Set([
      'CROPPED_ROTATED_SIZE',
      'CROPPED_ROTATED_SIZE_WITH_RES_MULT',
      'SAMPLE_AREA_START_PIXEL_COORD'
    ]);

    while ((match = globalInitPattern.exec(source)) !== null) {
      const fullMatch = match[0];
      const type = match[1];
      const varName = match[2];
      const initExpr = match[3];

      // Skip variables that are updated by cache-info pass
      if (mutableCacheVars.has(varName)) {
        continue;
      }

      // Check if initialization uses uppercase identifiers (likely uniforms/parameters)
      if (/[A-Z_]{3,}/.test(initExpr)) {
        globalInits.push({
          declaration: fullMatch,
          type,
          name: varName,
          init: initExpr
        });
      }
    }

    if (globalInits.length === 0) {
      return source;
    }

    // Replace global initializations with declarations only
    let output = source;
    for (const globalInit of globalInits) {
      output = output.replace(globalInit.declaration, `${globalInit.type} ${globalInit.name};`);
    }

    // Create initialization function
    const initFunction = `
// Global variable initialization (moved from global scope)
void initGlobalVars() {
${globalInits.map(g => `  ${g.name} = ${g.init};`).join('\n')}
}
`;

    // Insert before main()
    output = output.replace(/void\s+main\s*\(\s*\)\s*{/, initFunction + '\nvoid main() {\n  initGlobalVars();');

    return output;
  }

  /**
   * Convert int literals in comparisons to float literals
   */
  private static convertIntLiteralsInComparisons(source: string, bindings: SlangUniformBinding[] = []): string {
    console.log('[convertIntLiteralsInComparisons] START - bindings:', bindings.length);

    // CRITICAL FIX: Protect lines with int() casts by replacing with placeholders
    // This prevents subsequent regex patterns from converting their integer literals
    const protectedLines: Map<string, string> = new Map();
    const lines = source.split('\n');
    const processedLines = lines.map((line, index) => {
      if (line.includes('int(') || line.includes('uint(') || line.includes('ivec') || line.includes('uvec')) {
        const placeholder = `__PROTECTED_INT_LINE_${index}__`;
        protectedLines.set(placeholder, line);
        return placeholder;
      }
      return line;
    });
    console.log(`[convertIntLiterals] Protecting ${protectedLines.size} lines with int casts from conversion`);

    let output = processedLines.join('\n');

    // CRITICAL FIX: Protect #version directive and layout qualifiers from int-to-float conversion
    // Save and replace #version line temporarily
    const versionDirective = output.match(/#version\s+[\d.]+\s*(?:es)?\s*\n/);
    const versionPlaceholder = '__VERSION_DIRECTIVE_PROTECTED__';
    if (versionDirective) {
      output = output.replace(/#version\s+[\d.]+\s*(?:es)?\s*\n/, versionPlaceholder + '\n');
    }

    // CRITICAL: Protect layout(location = N) qualifiers from int-to-float conversion
    // Store them with placeholders, restore after conversions
    const layoutQualifiers: Map<string, string> = new Map();
    let layoutIndex = 0;
    output = output.replace(/layout\s*\([^)]*\)/g, (match) => {
      const placeholder = `__LAYOUT_QUALIFIER_${layoutIndex}__`;
      layoutQualifiers.set(placeholder, match);
      layoutIndex++;
      return placeholder;
    });
    console.log(`[convertIntLiterals] Protected ${layoutQualifiers.size} layout qualifiers from conversion`);

    // Extract all int/uint uniform names from BOTH bindings AND source
    const intUniforms = new Set<string>();

    // First, extract from UBO bindings (they're NOW converted to uniforms before this runs)
    for (const binding of bindings) {
      if (binding.members) {
        for (const member of binding.members) {
          if (member.type === 'int' || member.type === 'uint') {
            intUniforms.add(member.name);
            console.log(`[convertIntsToFloats] Found int/uint UBO member: ${member.name}`);
          }
        }
      }
    }

    // Then extract from source (in case there are direct uniform declarations)
    const intUniformPattern = /uniform\s+(int|uint)\s+(\w+)\s*;/g;
    let match;
    while ((match = intUniformPattern.exec(source)) !== null) {
      intUniforms.add(match[2]);
      console.log(`[convertIntsToFloats] Found int/uint uniform in source: ${match[2]}`);
    }

    console.log(`[convertIntsToFloats] Total int/uint uniforms found: ${intUniforms.size}`, Array.from(intUniforms).slice(0, 20).join(', '));

    // Lookbehind/lookahead explanation:
    // (?<![.\deE\w]) - Not after period, digit, e/E, or word char (prevents matching in floats/identifiers/scientific notation)
    // (?![.\deE\w]) - Not before period, digit, e/E, or word char (prevents matching start of floats/identifiers)

    // Convert comparisons: EXPRESSION == INT, EXPRESSION != INT, etc.
    // CRITICAL FIX: Only convert to float when NOT comparing with int() cast
    // If expression contains int(), uint(), ivec, uvec - keep literal as int
    // Otherwise convert literal to float for float comparisons
    let intCastCount = 0;
    let floatConvertCount = 0;
    output = output.replace(/([\w.\[\]()]+)\s*(==|!=|>|<|>=|<=)\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])/g, (match, expr, op, num) => {
      // If expression is explicitly an int type or cast, keep literal as int
      if (/\b(int|uint|ivec|uvec)\s*\(/.test(expr)) {
        intCastCount++;
        if (intCastCount <= 3) console.log(`[convertIntLiterals] Keeping int literal: ${match}`);
        return match; // Keep as-is: int(x) == 1 (both ints)
      }
      // Check if expr is an int uniform - convert both sides to float
      const exprName = expr.match(/\b(\w+)\b/)?.[1];
      if (exprName && intUniforms.has(exprName)) {
        return `float(${expr}) ${op} ${num}.0`;
      }
      // Default: convert literal to float for float comparisons
      floatConvertCount++;
      if (floatConvertCount <= 3) console.log(`[convertIntLiterals] Converting to float: ${match} -> ${expr} ${op} ${num}.0`);
      return `${expr} ${op} ${num}.0`;
    });
    console.log(`[convertIntLiterals] Summary: ${intCastCount} int casts kept, ${floatConvertCount} converted to float`);

    // Reverse order: INT == EXPRESSION, INT != EXPRESSION
    output = output.replace(/(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*(==|!=)\s*([\w.\[\]()]+)/g, (match, num, op, expr) => {
      // If expression is explicitly an int type or cast, keep literal as int
      if (/\b(int|uint|ivec|uvec)\s*\(/.test(expr)) {
        return match; // Keep as-is: 1 == int(x) (both ints)
      }
      // Check if expr is an int uniform - convert both sides to float
      const exprName = expr.match(/\b(\w+)\b/)?.[1];
      if (exprName && intUniforms.has(exprName)) {
        return `${num}.0 ${op} float(${expr})`;
      }
      // Default: convert literal to float for float comparisons
      return `${num}.0 ${op} ${expr}`;
    });

    // Ternary operator: convert int literals in ternary expressions
    // Pattern: condition ? INT : value or condition ? value : INT
    output = output.replace(/\?\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*:/g, (match, num) => {
      return `? ${num}.0 :`;
    });
    output = output.replace(/:\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[;,)])/g, (match, num) => {
      return `: ${num}.0`;
    });

    // Convert arithmetic operations: EXPRESSION op INT -> EXPRESSION op INT.0
    // Match any expression (identifiers, member access, array access, etc.) followed by operator and int
    // Use broad pattern to capture complex expressions: anything before operator that's not whitespace/punctuation
    output = output.replace(/([\w.\[\]()]+)\s*([-+*\/])\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])/g, (match, expr, op, num, offset, string) => {
      // Don't convert if this is scientific notation (e.g., "1.0e-10" where expr is "1.0e")
      // Check if expr matches the pattern of a number followed by 'e' or 'E'
      if ((expr.endsWith('e') || expr.endsWith('E')) && /\d+\.?\d*[eE]$/.test(expr)) {
        // This is scientific notation like "1.0e" or "1e", keep unchanged
        return match;
      }
      return `${expr} ${op} ${num}.0`;
    });

    // Reverse: INT op EXPRESSION -> INT.0 op EXPRESSION
    output = output.replace(/(?<![.\deE\w])(-?\d+)(?![.\deE\w])\s*([-+*\/])\s*([\w.\[\]()]+)/g, (match, num, op, expr, offset, string) => {
      // Don't convert if this is scientific notation like "1e-10"
      if ((op === '+' || op === '-') && (expr.startsWith('e') || expr.startsWith('E'))) {
        // Check if the number before this match could be part of scientific notation
        const beforeMatch = string.substring(Math.max(0, offset - 10), offset);
        if (/\d+\.?\d*$/.test(beforeMatch)) {
          return match; // This is scientific notation, keep unchanged
        }
      }
      return `${num}.0 ${op} ${expr}`;
    });

    // Define functions that MUST have int arguments (whitelist of int-only functions)
    const intArgFunctions = new Set([
      'textureSize', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4',
      'texelFetch', 'texelFetchOffset', 'int', 'uint'
    ]);

    // Convert ALL function arguments from int to float EXCEPT for int-argument functions
    // This handles both built-in GLSL functions and user-defined functions
    // Pattern: function_name(INT or function_name(..., INT, ...)

    // Convert first argument
    output = output.replace(/(\w+)\s*\(\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[,)])/g, (match, funcName, num) => {
      if (intArgFunctions.has(funcName)) {
        return match; // Keep int for int-argument functions
      }
      // Default: convert to float (handles both built-in and user-defined functions)
      return `${funcName}(${num}.0`;
    });

    // Convert subsequent arguments (after commas)
    // Use a more general approach: convert ALL int literals after commas in function calls
    // EXCEPT when inside known int-argument functions

    // First, protect int-argument functions by temporarily marking their arguments
    const intFuncPattern = new RegExp(`\\b(${Array.from(intArgFunctions).join('|')})\\s*\\(([^()]*)\\)`, 'g');
    const protectedRegions: Array<{start: number, end: number}> = [];

    let intMatch;
    while ((intMatch = intFuncPattern.exec(output)) !== null) {
      protectedRegions.push({
        start: intMatch.index,
        end: intMatch.index + intMatch[0].length
      });
    }

    // Now convert int literals after commas, skipping protected regions
    const commaIntPattern = /,\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[,)])/g;
    let converted = '';
    let lastIndex = 0;

    let commaMatch;
    while ((commaMatch = commaIntPattern.exec(output)) !== null) {
      // Check if this match is inside a protected region
      const isProtected = protectedRegions.some(region =>
        commaMatch.index >= region.start && commaMatch.index < region.end
      );

      if (!isProtected) {
        converted += output.substring(lastIndex, commaMatch.index);
        converted += `, ${commaMatch[1]}.0`;
        lastIndex = commaMatch.index + commaMatch[0].length;
      }
    }
    converted += output.substring(lastIndex);
    output = converted;

    // Convert assignments to float variables: float x = INT; -> float x = INT.0;
    output = output.replace(/\bfloat\s+\w+\s*=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(\s*[;,)])/g, (match, num, suffix) => {
      return match.replace(/=\s*(-?\d+)(\s*[;,)])/, `= $1.0$2`);
    });

    // Convert assignments to vec2/vec3/vec4 variables: vec2 x = INT; -> vec2 x = vec2(INT.0);
    output = output.replace(/\b(vec[2-4])\s+\w+\s*=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(\s*[;,)])/g, (match, vecType, num, suffix) => {
      return match.replace(new RegExp(`=\\s*(-?\\d+)(\\s*[;,)])`, 'g'), `= ${vecType}($1.0)$2`);
    });

    // General assignment conversion: EXPRESSION = INT; -> EXPRESSION = INT.0; (for already-declared float variables)
    // BUT skip int/uint variable declarations
    // Use a callback to check context
    output = output.replace(/=\s*(?<![.\deE\w])(-?\d+)(?![.\deE\w])(?=\s*[;,)])/g, (match, num, offset, string) => {
      // Look back to see if this is an int/uint declaration
      const before = string.substring(Math.max(0, offset - 30), offset);
      if (/\b(?:int|uint)\s+\w+\s*$/.test(before)) {
        return match; // Keep as int for int/uint variable declarations
      }
      return `= ${num}.0`;
    });

    // Convert textureSize() return type from ivec2 to vec2
    // textureSize() returns ivec2/ivec3, but GLSL code expects vec2/vec3 in most cases
    // Wrap textureSize calls with vec2()/vec3() conversion
    // Use negative lookbehind to avoid wrapping already-wrapped calls
    output = output.replace(/(?<!vec2\()\btextureSize\s*\(([^()]+)\)/g, 'vec2(textureSize($1))');

    // FINAL AGGRESSIVE PASS: Convert any remaining int literals in operations
    // This catches edge cases missed by previous patterns
    // BUT exclude #define values (they're often used as array sizes)

    // First, protect #define lines by converting them temporarily
    const defineMap = new Map();
    let defineCounter = 0;
    output = output.replace(/(#define\s+\w+\s+.+)$/gm, (match) => {
      const placeholder = `__DEFINE_PROTECTED_${defineCounter++}__`;
      defineMap.set(placeholder, match);
      return placeholder;
    });

    // Pattern: operator followed by int literal (for all operators)
    output = output.replace(/(==|!=|<|>|<=|>=|[-+*\/])\s*(?<![.\deE\w])(\d+)(?![.\deE\w])/g, (match, op, num, offset, string) => {
      // Don't convert if this is scientific notation (e.g., "1.0e-10")
      // Check if preceded by 'e' or 'E' and operator is + or -
      if ((op === '+' || op === '-')) {
        const before = string.substring(Math.max(0, offset - 5), offset);
        if (/\d+\.?\d*[eE]$/.test(before)) {
          return match; // This is scientific notation, keep unchanged
        }
      }
      return `${op} ${num}.0`;
    });

    // Reverse: int literal followed by operator
    output = output.replace(/(?<![.\deE\w])(\d+)(?![.\deE\w])\s*(==|!=|<|>|<=|>=|[-+*\/])/g, (match, num, op, offset, string) => {
      // Don't convert if this could be scientific notation
      const after = string.substring(offset + match.length, offset + match.length + 10);
      if ((op === '+' || op === '-') && /^[eE]\d/.test(after)) {
        return match; // Might be scientific notation, keep unchanged
      }
      return `${num}.0 ${op}`;
    });

    // Restore protected #defines
    defineMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    // Protect array sizes: revert any converted array sizes back to int
    // Pattern: [123.0] should be [123]
    output = output.replace(/\[\s*(\d+)\.0\s*\]/g, '[$1]');

    // FINAL ULTRA-AGGRESSIVE PASS: Convert ALL remaining int literals to float
    // This catches any comparisons, function arguments, or other contexts we missed
    // We'll protect specific contexts BEFORE this global conversion

    // DON'T protect #defines - we want their values to be converted to float
    // Array size reversion will fix any that are used in array dimensions

    // Protect scientific notation: 1.0e-10, 1.5e+3, etc.
    const sciNotationMap = new Map();
    let sciNotationCounter = 0;
    output = output.replace(/\d+\.?\d*[eE][+-]?\d+/g, (match) => {
      const placeholder = `__SCI_NOTATION_PROTECTED_${sciNotationCounter++}__`;
      sciNotationMap.set(placeholder, match);
      return placeholder;
    });

    // Protect textureSize calls - second parameter must be int
    const textureSizeMap = new Map();
    let textureSizeCounter = 0;
    output = output.replace(/textureSize\s*\([^)]+\)/g, (match) => {
      const placeholder = `__TEXTURESIZE_PROTECTED_${textureSizeCounter++}__`;
      textureSizeMap.set(placeholder, match);
      return placeholder;
    });

    // STRATEGY: Protect int contexts BEFORE conversion, then convert rest to float
    // This prevents the problem instead of trying to fix it after

    // Step 0: Protect for loops FIRST, then convert other ints to float
    // This preserves int loop variables for array indexing while avoiding int/float comparison errors

    // Protect all for loop headers from conversion
    const forLoopMarkers = new Map<string, string>();
    let forLoopIndex = 0;
    output = output.replace(/\bfor\s*\([^)]+\)/g, (match) => {
      const marker = `___FOR_LOOP_HEADER_${forLoopIndex++}___`;
      forLoopMarkers.set(marker, match);
      return marker;
    });

    // Convert function parameters: int varName, -> float varName,
    output = output.replace(/\b(in\s+|out\s+|inout\s+)?int\s+(\w+)\s*([,)])/g, (match, qualifier, varName, delimiter) => {
      // Skip if it's a uniform declaration
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `${qualifier || ''}float ${varName}${delimiter}`;
    });

    // Convert local int declarations: int varName = literal; -> float varName = literal.0;
    output = output.replace(/\bint\s+(\w+)\s*=\s*(\d+)\s*;/g, (match, varName, value) => {
      // Skip uniform int declarations (they should stay as int)
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `float ${varName} = ${value}.0;`;
    });

    // Convert uninitialized local int declarations: int varName; -> float varName;
    output = output.replace(/\bint\s+(\w+)\s*;/g, (match, varName) => {
      // Skip uniform declarations
      if (output.includes(`uniform int ${varName}`)) {
        return match;
      }
      return `float ${varName};`;
    });

    // Restore for loops and add int() casts for float comparison operands
    forLoopMarkers.forEach((original, marker) => {
      // Add int() cast if comparing int loop var with potentially-float limit
      const modified = original.replace(
        /\bfor\s*\(\s*int\s+(\w+)\s*=\s*(\d+)\s*;\s*(\w+)\s*([<>]=?)\s*(\w+)\s*;/,
        (match, loopVar, initVal, checkVar, op, limitVar) => {
          if (loopVar === checkVar) {
            return `for (int ${loopVar} = ${initVal}; ${checkVar} ${op} int(${limitVar});`;
          }
          return match;
        }
      );
      output = output.replace(marker, modified);
    });

    // Step 1: Collect all int/uint variable names
    const intVars = new Set<string>();
    output.replace(/\buniform\s+(int|uint)\s+(\w+)/g, (match, type, name) => {
      intVars.add(name);
      return match;
    });
    output.replace(/\b(int|uint)\s+(\w+)/g, (match, type, name) => {
      intVars.add(name);
      return match;
    });

    if (false) console.log('[convertIntsToFloats] Found', intVars.size, 'int/uint variables:', Array.from(intVars).slice(0, 10).join(', '));

    // Step 2: Protect int contexts from float conversion
    const protectedContexts: Map<string, string> = new Map();
    let protectIndex = 0;

    // Protect array indices and sizes
    output = output.replace(/\[\s*(\d+)\s*\]/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect int() cast arguments
    output = output.replace(/int\(\s*(\d+)\s*\)/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect uint() cast arguments
    output = output.replace(/uint\(\s*(\d+)\s*\)/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect int/uint variable assignments: int foo = 4; → protect "4"
    output = output.replace(/\b(int|uint)\s+\w+\s*=\s*(\d+)\b/g, (match) => {
      const marker = `___PROTECTED_${protectIndex++}___`;
      protectedContexts.set(marker, match);
      return marker;
    });

    // Protect literals (int or float) used with int variables in operations
    intVars.forEach(varName => {
      // Protect: intVar op literal (matches both "123" and "123.0")
      output = output.replace(
        new RegExp(`(\\b${varName}\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*)(\\d+(?:\\.\\d+)?)\\b`, 'g'),
        (match, prefix, num) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: literal op intVar (matches both "123" and "123.0")
      output = output.replace(
        new RegExp(`(\\d+(?:\\.\\d+)?)(\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*\\b${varName}\\b)`, 'g'),
        (match, num, suffix) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: intVar op IDENTIFIER (e.g., i < num_samples, i < FXAA_SEARCH_STEPS)
      // Matches ANY identifier (variable or macro), not just literals
      const identifierCompareRegex = new RegExp(`\\b${varName}\\s*(?:==|!=|<|>|<=|>=)\\s*[a-zA-Z_][a-zA-Z0-9_]*\\b`, 'g');
      output = output.replace(identifierCompareRegex, (match) => {
        const marker = `___PROTECTED_${protectIndex++}___`;
        protectedContexts.set(marker, match);
        if (match.includes('num_samples') || match.includes('num_points')) {
          console.log(`[convertIntsToFloats] Protected comparison: "${match}" -> ${marker}`);
        }
        return marker;
      });

      // Protect: IDENTIFIER op intVar (e.g., num_samples < i, FXAA_SEARCH_STEPS < i)
      output = output.replace(
        new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*(?:==|!=|<|>|<=|>=)\\s*${varName}\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: intVar arithmetic_op IDENTIFIER (e.g., i * width, i / count)
      // Only arithmetic operators for int operands
      output = output.replace(
        new RegExp(`\\b${varName}\\s*[*/%+\\-]\\s*[a-zA-Z_][a-zA-Z0-9_]*\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );

      // Protect: IDENTIFIER arithmetic_op intVar (e.g., width * i, count / i)
      output = output.replace(
        new RegExp(`\\b[a-zA-Z_][a-zA-Z0-9_]*\\s*[*/%+\\-]\\s*${varName}\\b`, 'g'),
        (match) => {
          const marker = `___PROTECTED_${protectIndex++}___`;
          protectedContexts.set(marker, match);
          return marker;
        }
      );
    });

    // Protect array declarations with macros or literals
    // Matches: type name[SIZE]; or type name[SIZE], or type name[SIZE] = or type name[SIZE])
    output = output.replace(/\b((?:int|uint|float|vec\d|mat\d|ivec\d|uvec\d)\s+\w+\s*\[)([A-Z_][A-Z0-9_]*|\d+)(\]\s*[;,=)])/g,
      (match) => {
        const marker = `___PROTECTED_${protectIndex++}___`;
        protectedContexts.set(marker, match);
        return marker;
      });

    if (false) console.log('[convertIntsToFloats] Protected', protectedContexts.size, 'int contexts');

    // Step 3: Protect #define macros used in int contexts
    const arraySizeMacros = new Set<string>();
    // Find macros in array brackets (already protected, but track for #define reversion)
    protectedContexts.forEach(original => {
      const match = original.match(/\[\s*([A-Z_][A-Z0-9_]*)\s*\]/);
      if (match) arraySizeMacros.add(match[1]);
    });

    // Find macros used with int variables
    const intRelatedMacros = new Set<string>();
    protectedContexts.forEach(original => {
      intVars.forEach(varName => {
        const regex = new RegExp(`\\b${varName}\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*([A-Z_][A-Z0-9_]*)\\b|\\b([A-Z_][A-Z0-9_]*)\\s*(?:==|!=|<|>|<=|>=|[*/%+\\-])\\s*${varName}\\b`);
        const match = original.match(regex);
        if (match) {
          const macroName = match[1] || match[2];
          if (macroName) intRelatedMacros.add(macroName);
        }
      });
    });

    if (false) console.log('[convertIntsToFloats] Found', arraySizeMacros.size + intRelatedMacros.size, 'int-context macros');

    // Step 4: Convert ALL remaining int literals to float (int contexts are protected)
    output = output.replace(/(?<![.\deE\w])(\d+)(?![.\deE\w])/g, '$1.0');

    if (false) console.log('[convertIntsToFloats] Converted unprotected literals to float');

    // Step 5: Revert #defines used in int contexts
    const macrosToRevert = new Set([...arraySizeMacros, ...intRelatedMacros]);
    macrosToRevert.forEach(macroName => {
      const defineRegex = new RegExp(`(#define\\s+${macroName}\\s+)(\\d+)\\.0\\b`, 'gm');
      output = output.replace(defineRegex, '$1$2');
    });

    if (macrosToRevert.size > 0) {
      if (false) console.log('[convertIntsToFloats] Reverted', macrosToRevert.size, 'int-context #defines');
    }

    // Step 6: Restore all protected int contexts as-is
    // After int-to-float conversion, protected contexts like "i < num_samples" become valid
    // because both i and num_samples are now floats, making "float < float" valid in WebGL
    protectedContexts.forEach((original, marker) => {
      output = output.replace(marker, original);
    });

    if (false) console.log('[convertIntsToFloats] Restored', protectedContexts.size, 'protected contexts');

    // Step 7: Wrap int loop variables (i, iter) with float() casts when used in arithmetic
    // This prevents int * float and int / float errors
    // Exclude increment/decrement operators (++, --) using negative lookahead
    const loopVarPattern = /\b(i|iter|j|k|idx|index)\b(?!\s*(?:\+\+|--))(?=\s*[*/%+\-])/g;
    output = output.replace(loopVarPattern, 'float($1)');

    // Restore protected textureSize calls
    textureSizeMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    // Restore protected scientific notation
    sciNotationMap.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });

    // CRITICAL FIX: Restore #version directive that was protected at the start
    if (versionDirective) {
      output = output.replace(versionPlaceholder + '\n', versionDirective[0]);
    }

    // CRITICAL FIX: Restore protected lines with int() casts
    protectedLines.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });
    console.log(`[convertIntLiterals] Restored ${protectedLines.size} protected lines with int casts`);

    // CRITICAL: Restore layout qualifiers that were protected earlier
    layoutQualifiers.forEach((original, placeholder) => {
      output = output.replace(placeholder, original);
    });
    console.log(`[convertIntLiterals] Restored ${layoutQualifiers.size} layout qualifiers`);

    // Fix print_integer(int, ...) -> print_integer(float(int), ...)
    // Explicitly cast first argument to float to handle int inputs (like screen_region.x)
    output = output.replace(/print_integer\s*\(\s*([\w.]+(?:\.[xyzw])?)\s*,/g, 'print_integer(float($1),');

    return output;
  }

  /**
   * Fix ternary operator type mismatches
   * Convert: condition ? vec3(...) : 0.0 → condition ? vec3(...) : vec3(0.0)
   */
  private static fixTernaryOperatorTypes(source: string): string {
    let output = source;

    // Pattern: condition ? vecN(...) : scalar → condition ? vecN(...) : vecN(scalar)
    // Match vec2, vec3, vec4 followed by parentheses, then optional whitespace, then ?, then anything, then :, then a number
    const vecTernaryPattern = /(\b(vec[2-4])\s*\([^)]+\))\s*\?\s*([^:]+)\s*:\s*(?<![.\deE\w])(-?\d+(?:\.\d+)?)(?![.\deE\w])/g;
    output = output.replace(vecTernaryPattern, (match, vecExpr, vecType, trueExpr, scalar) => {
      return `${vecExpr} ? ${trueExpr} : ${vecType}(${scalar})`;
    });

    // Pattern: condition ? scalar : vecN(...) → condition ? vecN(scalar) : vecN(...)
    const reverseVecTernaryPattern = /(\b(vec[2-4])\s*\([^)]+\))\s*\?\s*(?<![.\deE\w])(-?\d+(?:\.\d+)?)(?![.\deE\w])\s*:\s*([^;,\)\}]+)/g;
    output = output.replace(reverseVecTernaryPattern, (match, vecType, trueExpr, scalar, falseExpr) => {
      // Extract the vecN type from the false expression
      const falseVecMatch = falseExpr.match(/\b(vec[2-4])\s*\(/);
      if (falseVecMatch) {
        return `${falseVecMatch[1]}(${scalar}) ? ${vecType}(${scalar}) : ${falseExpr}`;
      }
      return match; // No change if we can't determine the type
    });

    return output;
  }

  /**
   * SOLUTION A (DUAL DECLARATION): Inject assignments from PARAM_ uniforms to global variables
   * For pragma parameters that also exist as globals, inject: variable = PARAM_variable;
   * at the start of main() function
   */
  private static injectParamAssignments(
    source: string,
    globalDefs: GlobalDefinitions,
    bindings: SlangUniformBinding[]
  ): string {
    // Find all global variables
    const globalVarNames = globalDefs.globals.map(g => {
      const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*;/);
      return match ? match[1] : null;
    }).filter(n => n !== null) as string[];

    // OPTIMIZATION: Only create assignments for variables that are actually USED in the shader
    // Scan the shader source to find which global variables are referenced
    const usedGlobals = new Set<string>();
    for (const varName of globalVarNames) {
      // Check if this variable is used in the shader source (not just declared)
      // Look for the variable name as a word boundary (not part of another identifier)
      const varPattern = new RegExp(`\\b${varName}\\b`, 'g');
      const matches = source.match(varPattern);
      // If found more than once (once for declaration, rest are uses), it's used
      if (matches && matches.length > 1) {
        usedGlobals.add(varName);
      }
    }

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Found ${usedGlobals.size} used globals out of ${globalVarNames.length} total`);

    // Find which ones have corresponding PARAM_ uniforms (from UBO members or push constants)
    // But ONLY create assignments for variables that are actually used AND are mutable
    const paramAssignments: string[] = [];
    const constNames = new Set(
      globalDefs.consts.map(c => c.match(/const\s+\w+\s+(\w+)/)?.[1]).filter(Boolean)
    );

    for (const binding of bindings) {
      if ((binding.type === 'ubo' || binding.type === 'pushConstant') && binding.members) {
        for (const member of binding.members) {
          // Skip if this variable is declared as const (can't assign to it)
          if (constNames.has(member.name)) {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping assignment for const ${member.name}`);
            continue;
          }

          if (globalVarNames.includes(member.name) && usedGlobals.has(member.name)) {
            paramAssignments.push(`  ${member.name} = PARAM_${member.name};`);
          }
        }
      }
    }

    if (paramAssignments.length === 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: No PARAM_ assignments needed`);
      return source;
    }

    // Instead of injecting into main() (which causes "Expression too complex" for 296+ assignments),
    // split assignments into multiple functions (50 assignments each) to avoid compiler limits
    const BATCH_SIZE = 20; // Reduced from 50 to avoid WebGL compiler limits
    const numBatches = Math.ceil(paramAssignments.length / BATCH_SIZE);

    let initFunctions = '';
    const initCalls: string[] = [];

    for (let i = 0; i < numBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, paramAssignments.length);
      const batchAssignments = paramAssignments.slice(batchStart, batchEnd);
      const functionName = `_initParamGlobals${i}`;

      initFunctions += `
// SOLUTION A: Initialize global variables from PARAM_ uniforms (batch ${i + 1}/${numBatches})
void ${functionName}() {
${batchAssignments.join('\n')}
}
`;
      initCalls.push(`  ${functionName}();`);
    }

    // Find main() function and inject the init function calls at the start
    const mainMatch = source.match(/void\s+main\s*\(\s*\)\s*{/);
    if (!mainMatch) {
      console.warn(`[SlangCompiler] SOLUTION A: Could not find main() function to inject PARAM_ assignments`);
      return source;
    }

    // DEBUG: Log which assignments are being injected
    if (paramAssignments.length > 0 && paramAssignments.length <= 3) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Injecting these ${paramAssignments.length} assignments:`, paramAssignments);
    }

    const mainStart = source.indexOf(mainMatch[0]);
    const mainBodyStart = mainStart + mainMatch[0].length;
    const mainCallsCode = '\n' + initCalls.join('\n') + ' // Initialize all PARAM_ global variables\n';

    // Insert init functions before main() and call them at start of main()
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Injecting ${paramAssignments.length} PARAM_ assignments in ${numBatches} batches`);
    return source.substring(0, mainStart) + initFunctions + '\n' + source.substring(mainStart, mainBodyStart) + mainCallsCode + source.substring(mainBodyStart);
  }

  /**
   * Convert Slang bindings to WebGL uniforms
   */
  private static convertBindingsToUniforms(
    source: string,
    bindings: SlangUniformBinding[],
    webgl2: boolean,
    globalDefs: GlobalDefinitions = { functions: [], defines: [], consts: [], globals: [] }
  ): string {
    let output = source;
    const declaredUniforms = new Set<string>(); // Track which uniforms/variables we've already declared

    // Parse existing uniform declarations AND global variable declarations from source
    // We need to check for both:
    // 1. uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;
    // 2. float HSM_POTATO_COLORIZE_CRT_WITH_BG = value;
    const existingUniformRegex = /^\s*uniform\s+\w+\s+(\w+)\s*;/gm;
    const existingVariableRegex = /^\s*(?:float|int|vec\d|mat\d|bool)\s+(\w+)\s*=/gm;

    let match;
    while ((match = existingUniformRegex.exec(source)) !== null) {
      declaredUniforms.add(match[1]);
    }

    // Reset lastIndex after first regex
    while ((match = existingVariableRegex.exec(source)) !== null) {
      declaredUniforms.add(match[1]);
    }

    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] convertBindingsToUniforms - processing', bindings.length, 'bindings');
    if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Found', declaredUniforms.size, 'existing uniform declarations in source');

    // Log critical uniforms for debugging cache-info issue
    const criticalNames = ['SourceSize', 'OutputSize', 'FrameCount', 'OriginalSize'];
    const foundCritical = criticalNames.filter(name => declaredUniforms.has(name));
    const missingCritical = criticalNames.filter(name => !declaredUniforms.has(name));
    if (foundCritical.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ✅ Found critical uniforms in source: ${foundCritical.join(', ')}`);
    }
    if (missingCritical.length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] ❌ Missing critical uniforms from source: ${missingCritical.join(', ')}`);
    }

    for (const binding of bindings) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Processing binding:', binding.type, binding.name,
                  'instanceName:', binding.instanceName || 'N/A',
                  'members:', binding.members?.length || 0);
      if (binding.type === 'sampler') {
        // Already a uniform, just remove layout
        const pattern = new RegExp(
          `layout\\s*\\([^)]*\\)\\s*uniform\\s+sampler\\w+\\s+${binding.name}\\s*;`,
          'g'
        );
        output = output.replace(pattern, `uniform sampler2D ${binding.name};`);
      } else if (binding.type === 'ubo' && binding.members) {
        // Convert UBO to individual uniforms using actual member types
        // Deduplicate - only create uniforms for members not already declared
        // IMPORTANT: Convert ALL int/uint types to float to avoid GLSL type mismatches

        const uniformDecls = binding.members
          .filter(member => {
            // CRITICAL: Guest CRT shader uses no_scanlines as a LOCAL variable, not a uniform!
            // Skip no_scanlines - some shaders use it as a local variable
            if (member.name === 'no_scanlines') {
              return false;
            }

            // CRITICAL: Check for both base name AND PARAM_ name to prevent duplicates
            const paramName = `PARAM_${member.name}`;
            if (declaredUniforms.has(member.name) || declaredUniforms.has(paramName)) {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping duplicate uniform: ${member.name} from UBO ${binding.name}`);
              return false;
            }

            // Check if this will become a PARAM_ uniform (is also a global)
            const isAlsoGlobal = globalDefs.globals.some(g => {
              const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*;/);
              return match && match[1] === member.name;
            });

            // Track the name we'll actually create (PARAM_ or plain)
            declaredUniforms.add(member.name);
            if (isAlsoGlobal) {
              declaredUniforms.add(paramName); // Track PARAM_ name too
            }
            return true;
          })
          .map(member => {
            // Convert int/uint uniforms to float to avoid comparison type errors
            let glslType = member.type;
            if (glslType === 'int' || glslType === 'uint') {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Converting ${member.name} from ${glslType} to float`);
              glslType = 'float';
            }

            // SOLUTION A (DUAL DECLARATION): If this UBO member also exists as a global variable,
            // create uniform with PARAM_ prefix to avoid redefinition
            // Check for both declarations (float X;) and initializations (float X = value;)
            const isAlsoGlobal = globalDefs.globals.some(g => {
              const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*[;=]/);
              return match && match[1] === member.name;
            });

            if (isAlsoGlobal) {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] SOLUTION A: Creating PARAM_-prefixed uniform for global variable: ${member.name}`);
              return `uniform ${glslType} PARAM_${member.name};`;
            }

            return `uniform ${glslType} ${member.name};`;
          })
          .join('\n');

        // Try to find and replace the UBO block in the source
        const uboPattern = new RegExp(
          `layout\\s*\\([^)]*\\)\\s*uniform\\s+${binding.name}\\s*[\\s\\S]*?\\}\\s*\\w*\\s*;`,
          'g'
        );

        const testMatch = output.match(uboPattern);
        if (testMatch) {
          // UBO found in source - replace it with uniform declarations
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] UBO ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
          output = output.replace(uboPattern, uniformDecls);
        } else {
          // UBO not in source (e.g., defined before #pragma stage) - inject uniforms after precision declarations
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] UBO ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

          // Find insertion point: after precision declarations
          const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/g);
          if (precisionEnd !== -1) {
            const afterPrecision = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
            if (afterPrecision) {
              const insertPos = precisionEnd + afterPrecision[0].length;
              output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
            }
          } else {
            // No precision found, insert after #version
            const versionEnd = output.search(/#version.*?\n/);
            if (versionEnd !== -1) {
              const versionMatch = output.match(/#version.*?\n/);
              if (versionMatch) {
                const insertPos = versionEnd + versionMatch[0].length;
                output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
              }
            }
          }
        }
      } else if (binding.type === 'pushConstant' && binding.members) {
        // Convert push constants to individual uniforms using actual member types
        // Deduplicate - only create uniforms for members not already declared
        const uniformDecls = binding.members
          .filter(member => {
            // CRITICAL: Check for both base name AND PARAM_ name to prevent duplicates
            const paramName = `PARAM_${member.name}`;
            if (declaredUniforms.has(member.name) || declaredUniforms.has(paramName)) {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping duplicate uniform: ${member.name} from push constant ${binding.name}`);
              return false;
            }
            // Track BOTH names to prevent pragma parameters from creating duplicate PARAM_ uniforms
            declaredUniforms.add(member.name);
            declaredUniforms.add(paramName);
            return true;
          })
          .map(member => {
            // CRITICAL: Check if source already has PARAM_ uniform (pragma parameters)
            // Example: Source has "uniform float PARAM_PR;" and push constant has "float PR;"
            // In this case, skip creating new uniform - use existing PARAM_ declaration
            const hasPARAMUniform = output.includes(`uniform ${member.type} PARAM_${member.name};`);
            if (hasPARAMUniform) {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Skipping push constant member ${member.name} - source already has PARAM_ uniform`);
              return ''; // Don't create duplicate
            }

            // Check if this push constant member is also a global variable
            // Check for both declarations (float X;) and initializations (float X = value;)
            const isAlsoGlobal = globalDefs.globals.some(g => {
              const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*[;=]/);
              return match && match[1] === member.name;
            });

            if (isAlsoGlobal) {
              // DUAL DECLARATION: Create PARAM_ uniform (will be copied to global variable)
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Creating PARAM_-prefixed uniform for push constant member (also a global): ${member.name}`);
              return `uniform ${member.type} PARAM_${member.name};`;
            } else {
              // Regular push constant member: direct uniform (no PARAM_ prefix)
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Creating direct uniform for push constant member: ${member.name}`);
              return `uniform ${member.type} ${member.name};`;
            }
          })
          .filter(decl => decl !== '') // Remove empty strings from skipped members
          .join('\n');

        // Try to find and replace the push constant block in the source
        const pushPattern = new RegExp(
          `layout\\s*\\(push_constant\\)\\s*uniform\\s+${binding.name}\\s*[\\s\\S]*?\\}\\s*\\w*\\s*;`,
          'g'
        );

        const testMatch = output.match(pushPattern);
        if (testMatch) {
          // Push constant found in source - replace it
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Push constant ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
          output = output.replace(pushPattern, uniformDecls);
        } else {
          // Push constant not in source - inject uniforms after precision
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Push constant ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

          const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/g);
          if (precisionEnd !== -1) {
            const afterPrecision = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
            if (afterPrecision) {
              const insertPos = precisionEnd + afterPrecision[0].length;
              output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
            }
          }
        }

        // Replace instanceName.member with just member (e.g., params.curvature -> curvature)
        // CRITICAL FIX: Even if member is also a global, use the GLOBAL name (not PARAM_)
        // The global will be assigned from PARAM_ uniform in main() via _initParamGlobals functions
        if (binding.instanceName) {
          binding.members.forEach(member => {
            // Check if this member is also a global (pragma parameter)
            const isAlsoGlobal = globalDefs.globals.some(g => {
              const match = g.match(/^\s*(?:float|int|uint|vec[2-4]|mat[2-4]|bool)\s+(\w+)\s*;/);
              return match && match[1] === member.name;
            });

            // Use word boundaries to match whole words only
            const pattern = new RegExp(`\\b${binding.instanceName}\\.${member.name}\\b`, 'g');
            // ALWAYS use just the member name (global variable), not PARAM_ prefix
            // If it's a global, the assignment (var = PARAM_var) will happen in main()
            const replacement = member.name;
            output = output.replace(pattern, replacement);
            if (isAlsoGlobal) {
              if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Replaced ${binding.instanceName}.${member.name} with ${member.name} (is also global, will be assigned from PARAM_${member.name})`);
            }
          });
        }

        // NOTE: Do NOT do generic params.X replacement here!
        // Must wait until ALL bindings have processed their specific members
        // Otherwise early binding with instanceName='params' will replace params.X with X
        // before later binding has chance to replace params.X with PARAM_X
      }
    }

    // CRITICAL FIX: Replace ALL params.X references with just X
    // This is needed because Mega Bezel shaders reference params.MVP, params.FinalViewportSize, etc.
    // but we've converted the UBO to individual uniforms
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Before params. replacement, checking for params. references...`);
    const allParamsRefs = output.match(/\bparams\.\w+\b/g);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found params. references:`, allParamsRefs ? allParamsRefs.slice(0, 10) : 'none');

    output = output.replace(/\bparams\.(\w+)\b/g, '$1');

    // Also fix #define aliases that reference struct members after UBO conversion
    // CRITICAL FIX: Push constant members (params.X) must become PARAM_X, not just X
    // Global UBO members (global.X) stay as X (they're not parameters)
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Before #define replacement, checking for #define global. references...`);
    const defineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found #define global. references:`, defineGlobalRefs ? defineGlobalRefs.slice(0, 10) : 'none');

    // Replace params. with PARAM_ (push constant members are now PARAM_ uniforms)
    output = output.replace(/#define\s+(\w+)\s+params\.(\w+)/g, '#define $1 PARAM_$2');
    // Replace global. with nothing (global UBO members are now direct uniforms)
    output = output.replace(/#define\s+(\w+)\s+global\.(\w+)/g, '#define $1 $2');

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] After #define replacement, checking for remaining #define global. references...`);
    const remainingDefineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Remaining #define global. references:`, remainingDefineGlobalRefs ? remainingDefineGlobalRefs.slice(0, 10) : 'none');

    // CRITICAL FIX: Do NOT re-introduce params. prefix!
    // We already removed all params./global. prefixes at the beginning (lines 108-118)
    // Re-introducing them breaks everything because we use individual uniforms, not UBOs
    // Just remove any remaining global. prefixes without adding params. back
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removing any remaining global. prefixes (without adding params. back)...`);
    const globalRefs = output.match(/\bglobal\.\w+\b/g);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Found global. references:`, globalRefs ? globalRefs.slice(0, 10) : 'none');

    output = output.replace(/\bglobal\.(\w+)\b/g, '$1');

    const remainingGlobalRefs = output.match(/\bglobal\.\w+\b/g);
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Remaining global. references:`, remainingGlobalRefs ? remainingGlobalRefs.slice(0, 10) : 'none');


    return output;
  }

  /**
   * Generate default vertex shader
   */
  private static generateDefaultVertexShader(webgl2: boolean): string {
    if (webgl2) {
      return `#version 300 es

uniform mat4 MVP;

layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;

out vec2 vTexCoord;

void main() {
  gl_Position = MVP * Position;
  vTexCoord = TexCoord;
}
`;
    } else {
      // Three.js compatible vertex shader
      // Three.js provides: position (vec3), uv (vec2), normal (vec3)
      // and matrices: projectionMatrix, modelViewMatrix, modelMatrix
      return `
uniform mat4 MVP;

varying vec2 vTexCoord;

void main() {
  // Three.js provides 'position' as vec3 and 'uv' as vec2
  gl_Position = MVP * vec4(position, 1.0);
  vTexCoord = uv;
}
`;
    }
  }

  /**
   * Extract uniform names from bindings
   */
  private static extractUniformNames(bindings: SlangUniformBinding[]): string[] {
    const uniforms: string[] = [];

    for (const binding of bindings) {
      if (binding.type === 'ubo' && binding.members) {
        uniforms.push(...binding.members.map(m => m.name));
      } else if (binding.type === 'pushConstant' && binding.members) {
        uniforms.push(...binding.members.map(m => m.name));
      }
    }

    return uniforms;
  }

  /**
   * Extract sampler names from bindings
   */
  private static extractSamplerNames(bindings: SlangUniformBinding[]): string[] {
    return bindings
      .filter(b => b.type === 'sampler')
      .map(b => b.name);
  }

  /**
   * Extract full sampler binding info for dynamic texture resolution
   * This enables the multi-pass renderer to automatically bind textures
   * based on sampler names matching pass aliases
   */
  private static extractSamplerBindings(bindings: SlangUniformBinding[]): SamplerBinding[] {
    return bindings
      .filter(b => b.type === 'sampler')
      .map(b => ({
        name: b.name,
        type: 'sampler2D',  // Default type, could be extended to parse actual type
        set: b.set,
        binding: b.binding
      }));
  }

  /**
   * Enhanced GLSL preprocessor for Mega Bezel complex #include handling
   * Delegates to centralized IncludePreprocessor for consistency
   */
  private static async preprocessIncludes(
    source: string,
    baseUrl: string,
    processedFiles = new Set<string>(),
    definedMacros = new Set<string>(),
    includeStack: string[] = []
  ): Promise<string> {
    // Use centralized IncludePreprocessor to avoid code duplication
    return await IncludePreprocessor.preprocessIncludes(
      source,
      baseUrl,
      processedFiles,
      definedMacros,
      includeStack
    );
  }

  /**
   * Deduplicate #define macros to prevent redefinition errors
   * Keeps the first occurrence of each macro and removes subsequent duplicates
   */
  private static deduplicateDefines(source: string): string {
    const lines = source.split('\n');
    const seenDefines = new Set<string>();
    const result: string[] = [];
    let insideConditional = false;
    const conditionalStack: Set<string>[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Track #ifdef/#ifndef/#else/#endif to allow duplicate defines in different branches
      if (trimmed.startsWith('#ifdef ') || trimmed.startsWith('#ifndef ')) {
        // Entering a conditional block - save current seen state
        conditionalStack.push(new Set(seenDefines));
        insideConditional = true;
      } else if (trimmed === '#else' || trimmed.startsWith('#elif ')) {
        // Switching branches - restore state from before this conditional
        if (conditionalStack.length > 0) {
          const savedState = conditionalStack[conditionalStack.length - 1];
          seenDefines.clear();
          savedState.forEach(name => seenDefines.add(name));
        }
      } else if (trimmed === '#endif') {
        // Exiting conditional block - restore saved state
        if (conditionalStack.length > 0) {
          const savedState = conditionalStack.pop()!;
          seenDefines.clear();
          savedState.forEach(name => seenDefines.add(name));
        }
        insideConditional = conditionalStack.length > 0;
      }

      // Check if this is a #define directive
      if (trimmed.startsWith('#define ')) {
        const macroMatch = trimmed.match(/^#define\s+(\w+)/);
        if (macroMatch) {
          const macroName = macroMatch[1];

          // Skip if we've already seen this macro (in current branch)
          if (seenDefines.has(macroName) && !insideConditional) {
            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removing duplicate #define: ${macroName}`);
            continue; // Skip this duplicate define
          }

          // Mark this macro as seen
          seenDefines.add(macroName);
        }
      }

      // Keep the line (whether it's a define or not)
      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Convert GLSL ES 3.0 storage qualifiers (in/out) to WebGL 1 compatible versions
   * Only converts interface block variables (global scope), not function parameters
   */
  private static convertStorageQualifiers(glslCode: string): string {
    const lines = glslCode.split('\n');
    const result: string[] = [];
    let insideFunction = false;
    let braceDepth = 0;
    let conversions = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Debug HHLP processing
      if (line.includes('HHLP_GetMaskCenteredOnValue')) {
        console.log('[convertStorageQualifiers] Processing HHLP line:', line);
        console.log('[convertStorageQualifiers] insideFunction:', insideFunction, 'braceDepth:', braceDepth);
      }

      // Track when we're inside a function - MUST DO THIS BEFORE PROCESSING THE LINE!
      const isFunctionDeclaration = trimmed.match(/^(void|vec[234]|float|bool|mat[234]|int|uint|ivec[234]|uvec[234])\s+\w+\s*\(/);
      if (isFunctionDeclaration) {
        insideFunction = true;
        if (line.includes('HHLP_GetMaskCenteredOnValue')) {
          console.log('[convertStorageQualifiers] Detected function declaration, set insideFunction=true');
        }
      }

      // Track brace depth
      for (const char of line) {
        if (char === '{') braceDepth++;
        else if (char === '}') {
          braceDepth--;
          if (braceDepth === 0) insideFunction = false;
        }
      }

      // Only convert at global scope (outside functions)
      // If this line is a function declaration, skip conversion even if insideFunction hasn't been set yet
      if (!insideFunction && !isFunctionDeclaration && braceDepth === 0) {
        // Convert 'in' to 'varying' for interface variables (not function params)
        // Only if it's at the start of a line or after a semicolon
        if (trimmed.match(/^in\s+(vec[234]|float|mat[234])/)) {
          if (line.includes('HHLP')) console.log('[convertStorageQualifiers] CONVERTING in→varying:', line);
          result.push(line.replace(/^(\s*)in\s+/, '$1varying '));
          conversions++;
          continue;
        }

        // Convert 'out' to 'varying' for interface variables
        if (trimmed.match(/^out\s+(vec[234]|float|mat[234])/)) {
          if (line.includes('HHLP')) console.log('[convertStorageQualifiers] CONVERTING out→varying:', line);
          result.push(line.replace(/^(\s*)out\s+/, '$1varying '));
          conversions++;
          continue;
        }
      }

      if (line.includes('HHLP_GetMaskCenteredOnValue')) {
        console.log('[convertStorageQualifiers] Pushing line to result:', line);
      }
      result.push(line);
    }

    if (conversions > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Converted ${conversions} in/out qualifiers to varying`);
    }

    return result.join('\n');
  }

  /**
   * Remove duplicate function definitions
   */
  private static removeDuplicateFunctions(glslCode: string): string {
    // Debug: Check if HHLP_GetMaskCenteredOnValue is in the input
    const hasHHLP = glslCode.includes('HHLP_GetMaskCenteredOnValue');
    if (false) console.log('[removeDuplicateFunctions] Called with input length:', glslCode.length);
    if (false) console.log('[removeDuplicateFunctions] Contains HHLP_GetMaskCenteredOnValue:', hasHHLP);

    if (hasHHLP) {
      const idx = glslCode.indexOf('HHLP_GetMaskCenteredOnValue');
      const context = glslCode.substring(Math.max(0, idx - 20), Math.min(glslCode.length, idx + 120));
      if (false) console.log('[removeDuplicateFunctions] HHLP context:', context);
    }

    // This is complex because functions can have the opening brace on the next line
    // We need to track functions and skip duplicates entirely
    const lines = glslCode.split('\n');
    const result: string[] = [];
    const seenFunctions = new Set<string>();
    let skipping = false;
    let braceDepth = 0;
    let skipCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Debug: Log lines related to HSM_GetNoScanlineMode (DISABLED - produces too much console noise)
      // if (line.includes('return 0.0') && line.includes(';')) {
      //   console.error(`[removeDuplicateFunctions] Line ${i}: "${line.trim()}" - skipping=${skipping}, braceDepth=${braceDepth}`);
      // }

      // If we're currently skipping a duplicate function
      if (skipping) {
        skipCount++;

        // Debug for HSM_GetNoScanlineMode (DISABLED - produces too much console noise)
        // if (line.includes('return 0.0')) {
        //   console.error(`[removeDuplicateFunctions] SKIPPING LINE because skipping=true: "${line.trim()}"`);
        // }

        // Track braces to know when the function ends
        for (const char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              skipping = false;
            }
          }
        }
        continue;
      }

      // Check if this line starts a function definition
      // Match: return_type function_name(params) with optional {
      // Updated regex to handle more type variations including mat3x3, highp/mediump/lowp qualifiers
      const funcMatch = trimmed.match(/^((?:const\s+)?(?:highp\s+|mediump\s+|lowp\s+)?(?:vec[234]|mat[234](?:x[234])?|float|bool|void|int|uint|[iu]?vec[234]|sampler2D))\s+(\w+)\s*\(([^)]*)\)/);

      if (funcMatch) {
        const functionName = funcMatch[2];
        const params = funcMatch[3].trim();

        // Create a full signature including parameter TYPES (not names) to support function overloading
        // Extract just the types from parameters to match function signatures properly
        const paramTypes = params.split(',').map(p => {
          const trimmedParam = p.trim();
          if (trimmedParam.length === 0) return '';
          // Extract type by removing the last word (which is the parameter name)
          const parts = trimmedParam.split(/\s+/);
          if (parts.length >= 2) {
            // Return all but the last part (the variable name)
            return parts.slice(0, -1).join(' ');
          }
          // If only one part, it's probably just a type (like in forward declarations)
          return trimmedParam;
        }).filter(t => t.length > 0).join(', ');

        const fullSignature = `${functionName}(${paramTypes})`;

        // Debug logging for critical functions (DISABLED - produces too much console noise)
        // if (functionName === 'HHLP_GetMaskCenteredOnValue' || functionName === 'HSM_Linearize' || functionName === 'HSM_Delinearize' || functionName === 'HSM_GetCurvedCoord' || functionName === 'HSM_GetNoScanlineMode' || functionName === 'HSM_GetUseFakeScanlines') {
        //   console.error(`[removeDuplicateFunctions] ${functionName}`);
        //   console.error(`  Full line: "${line}"`);
        //   console.error(`  Trimmed: "${trimmed}"`);
        //   console.error(`  Raw params: "${params}"`);
        //   console.error(`  Param types: "${paramTypes}"`);
        //   console.error(`  Signature: "${fullSignature}"`);
        //   console.error(`  Already seen: ${seenFunctions.has(fullSignature)}`);
        // }

        // Check if we've seen this EXACT function signature before
        if (seenFunctions.has(fullSignature)) {
          // Skip this duplicate function
          skipCount++;
          skipping = true;
          braceDepth = 0;

          // Debug logging for critical functions (DISABLED - produces too much console noise)
          // if (functionName === 'HHLP_GetMaskCenteredOnValue' || functionName === 'HSM_Linearize' || functionName === 'HSM_Delinearize' || functionName === 'HSM_GetCurvedCoord' || functionName === 'HSM_GetNoScanlineMode' || functionName === 'HSM_GetUseFakeScanlines') {
          //   console.error(`[removeDuplicateFunctions] SKIPPING duplicate: ${fullSignature}`);
          // }

          // Check if the brace is on this line
          if (trimmed.includes('{')) {
            braceDepth = 1;
          }
          continue;
        }

        // New function - remember it and keep the line
        seenFunctions.add(fullSignature);
        result.push(line);

        // Check if we're entering the function body on this line
        if (trimmed.includes('{')) {
          // We're not skipping, but we might want to track depth
          // for future use (not needed for non-duplicate)
        }
      } else {
        // Not a function definition, keep the line
        result.push(line);

        // Debug: Log non-function lines related to HSM_GetNoScanlineMode (DISABLED - produces too much console noise)
        // if (line.includes('return 0.0') || line.includes('// Stub function') || line.includes('// Always use Guest scanlines')) {
        //   console.error(`[removeDuplicateFunctions] Keeping non-function line: "${line.trim()}"`);
        // }
      }
    }

    if (skipCount > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Removed ${skipCount} lines from ${seenFunctions.size} unique functions (duplicates removed)`);
    }

    return result.join('\n');
  }

  /**
   * Convert do-while loops to while loops (do-while not supported in WebGL 1 GLSL)
   *
   * Transforms:
   *   do { body } while (condition);
   * Into:
   *   { body while (condition) { body } }
   */
  private static convertDoWhileLoops(glslCode: string): string {
    // Match do { ... } while (condition);
    // This regex matches do-while loops with proper brace tracking
    const doWhileRegex = /\bdo\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\s*while\s*\(([^)]+)\)\s*;/g;

    let fixed = glslCode;
    let match;
    let replacements = 0;

    while ((match = doWhileRegex.exec(glslCode)) !== null) {
      const body = match[1];
      const condition = match[2];

      // Replace do-while with: { body while (condition) { body } }
      const replacement = `{ ${body} while (${condition}) { ${body} } }`;
      fixed = fixed.replace(match[0], replacement);
      replacements++;
    }

    if (replacements > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Converted ${replacements} do-while loops to while loops`);
    }

    return fixed;
  }

  /**
   * Fix float/int comparison issues in GLSL code
   *
   * Converts comparisons like (float_var == int_literal) to (int(float_var) == int_literal)
   * This is required because GLSL is strict about type comparisons
   */
  private static fixFloatIntComparisons(glslCode: string): string {
    let fixed = glslCode;

    // List of known float uniforms that get compared with ints
    const floatLayerOrderVars = [
      'HSM_BG_LAYER_ORDER',
      'HSM_VIEWPORT_VIGNETTE_LAYER_ORDER',
      'HSM_LED_LAYER_ORDER',
      'HSM_DEVICE_LAYER_ORDER',
      'HSM_DEVICELED_LAYER_ORDER',
      'HSM_DECAL_LAYER_ORDER',
      'HSM_CAB_GLASS_LAYER_ORDER',
      'HSM_TOP_LAYER_ORDER',
      'HSM_CRT_LAYER_ORDER'
    ];

    // Fix comparisons with loop variable i (which is an int)
    // Convert if (FLOAT_VAR == i) to if (int(FLOAT_VAR) == i)
    floatLayerOrderVars.forEach(varName => {
      // Match pattern: if (VAR == i) or if (VAR == i && ...)
      // Also match with parentheses: if ((VAR == i))
      const regex = new RegExp(`(\\(?)\\s*(${varName})\\s*==\\s*i\\b`, 'g');
      const replacementCount = (fixed.match(regex) || []).length;
      if (replacementCount > 0) {
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fixing ${replacementCount} float/int comparisons for ${varName}`);
      }
      fixed = fixed.replace(regex, `$1int($2) == i`);
    });

    // Also fix any assignments like: int_var = FLOAT_VAR - 1.0
    // Convert to: int_var = int(FLOAT_VAR - 1.0)
    fixed = fixed.replace(/(\w+_layer)\s*=\s*int\((HSM_\w+_LAYER_ORDER)\s*-\s*1\.0\)/g, '$1 = int($2 - 1.0)');

    // Fix: start_layer = HSM_CRT_LAYER_ORDER + 1.0
    // To: start_layer = int(HSM_CRT_LAYER_ORDER + 1.0)
    fixed = fixed.replace(/start_layer\s*=\s*(HSM_CRT_LAYER_ORDER\s*\+\s*1\.0)/g, 'start_layer = int($1)');

    // Fix: end_layer = HSM_CRT_LAYER_ORDER - 1.0
    // To: end_layer = int(HSM_CRT_LAYER_ORDER - 1.0)
    fixed = fixed.replace(/end_layer\s*=\s*(HSM_CRT_LAYER_ORDER\s*-\s*1\.0)/g, 'end_layer = int($1)');

    // NEW FIX: Change float start_layer to int start_layer
    // Find the declaration and change type
    fixed = fixed.replace(/\bfloat\s+start_layer\s*=\s*0\.0\s*;/g, 'int start_layer = 0;');

    // Fix assignments of 0.0 to start_layer
    fixed = fixed.replace(/\bstart_layer\s*=\s*0\.0\s*;/g, 'start_layer = 0;');

    // NEW: Fix maskMode comparisons with MASK_MODE constants
    // The MASK_MODE constants are defined as floats (e.g., #define MASK_MODE_ALL 0.0)
    // But maskMode might be declared as a float uniform
    // Pattern: if (maskMode == MASK_MODE_XXX) becomes if (maskMode == MASK_MODE_XXX)
    // Actually no change needed since both are floats

    // NEW: Fix assignments from float to int
    // Pattern: int var = float_expression
    // Convert to: int var = int(float_expression)
    fixed = fixed.replace(/(\bint\s+\w+)\s*=\s*(HSM_\w+_LAYER_ORDER)\b/g, '$1 = int($2)');
    fixed = fixed.replace(/(\bint\s+\w+)\s*=\s*(\w+Mode)\b/g, '$1 = int($2)');

    // NEW: Fix float uniform comparisons with integer literals
    // Pattern: floatUniform == 1 (without .0)
    // Convert to: floatUniform == 1.0
    const floatModeVars = [
      'maskMode',
      'cutoutMode',
      'followMode',
      'HSM_\\w+_MASK_MODE',
      'HSM_\\w+_CUTOUT_MODE',
      'HSM_\\w+_FOLLOW_MODE'
    ];

    floatModeVars.forEach(varPattern => {
      // Fix comparisons with integer literals (no decimal point)
      // Pattern: maskMode == 1 -> maskMode == 1.0
      const regex = new RegExp(`\\b(${varPattern})\\s*==\\s*(\\d+)(?!\\.\\d)`, 'g');
      fixed = fixed.replace(regex, '$1 == $2.0');
    });

    // NEW: Fix int variable assignments from float expressions
    // Pattern: intVar = floatExpr - should wrap with int()
    // This is more general - any assignment to int variable from float
    fixed = fixed.replace(/^(\s*)(int\s+)?(\w+_layer)\s*=\s*(HSM_\w+_LAYER_ORDER(?:\s*[-+]\s*\d+\.?\d*)?);/gm,
                          '$1$2$3 = int($4);');

    // Count how many replacements we made for logging
    const replacements = (fixed.match(/int\(HSM_\w+_LAYER_ORDER/g) || []).length;
    const modeReplacements = (fixed.match(/\w+Mode\s*==\s*\d+\.0/g) || []).length;

    if (replacements > 0 || modeReplacements > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fixed ${replacements} layer order issues, ${modeReplacements} mode comparison issues`);
    }

    return fixed;
  }

  /**
   * Fix WebGL 1 incompatibilities in GLSL code
   *
   * Converts unsigned integer types to floats since Three.js with WebGL 1
   * does not support uint uniforms or variables.
   */
  private static fixWebGLIncompatibilities(glslCode: string, webgl2: boolean = true): string {
    let fixed = glslCode;

    // Debug: Check HHLP at the VERY START of fixWebGLIncompatibilities
    if (fixed.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = fixed.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = fixed.lastIndexOf('\n', idx) + 1;
      const lineEnd = fixed.indexOf('\n', idx);
      const functionLine = fixed.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      if (false) console.log('[fixWebGLIncompatibilities] AT START OF METHOD:', functionLine);
    }

    // Count replacements for logging
    const uintUniformCount = (fixed.match(/uniform\s+uint\s+/g) || []).length;
    const uintVarCount = (fixed.match(/\buint\s+\w+\s*=/g) || []).length;
    const uintCastCount = (fixed.match(/uint\(/g) || []).length;
    const mat3x3Count = (fixed.match(/\bmat3x3\b/g) || []).length;
    const textureCallCount = (glslCode.match(/\btexture\s*\(/g) || []).length; // Count conversions
    const outQualifierCount = (fixed.match(/\bout\s+/g) || []).length;
    const inQualifierCount = (fixed.match(/\bin\s+/g) || []).length;

    // Replace unsigned integer uniforms based on WebGL version
    // WebGL1 doesn't support uint uniforms (convert to float)
    // WebGL2 supports uint uniforms natively
    if (!webgl2) {
      fixed = fixed.replace(/uniform\s+uint\s+/g, 'uniform float ');
    }

    // Replace uint variable declarations and casts based on WebGL version
    if (!webgl2) {
      // WebGL1: convert uint to float
      fixed = fixed.replace(/\buint\s+(\w+)\s*=/g, 'float $1 =');
      fixed = fixed.replace(/uint\(/g, 'float(');
    }

    // Fix mat3x3 syntax error - GLSL uses mat3 not mat3x3
    fixed = fixed.replace(/\bmat3x3\b/g, 'mat3');

    // Fix texture() calls based on WebGL version
    // WebGL2 (GLSL ES 3.0) uses texture()
    // WebGL1 (GLSL ES 1.0) uses texture2D()
    if (!webgl2) {
      // Only convert to texture2D for WebGL1
      // IMPORTANT: Process line-by-line to avoid corrupting function signatures that contain commas
      const lines = fixed.split('\n');
      const processedLines = lines.map(line => {
        const trimmed = line.trim();

        // Skip function declaration lines to avoid corrupting function signatures
        // Match patterns like: float FunctionName(float param1, float param2)
        if (trimmed.match(/^(void|vec[234]|float|bool|mat[234]|int|uint|ivec[234]|uvec[234]|sampler2D)\s+\w+\s*\(/)) {
          return line;
        }

        // Apply texture replacements only to non-function-declaration lines
        let processed = line;

        // First, handle 3-argument texture() calls with LOD (strip the LOD parameter)
        // texture(sampler, coord, lod) → texture2D(sampler, coord)
        processed = processed.replace(/\btexture\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture2D($1, $2)');

        // Then handle regular 2-argument texture() calls
        processed = processed.replace(/\btexture\s*\(/g, 'texture2D(');

        // Fix textureLodOffset - not available in WebGL 1, use texture2D instead
        // textureLodOffset(sampler, coord, lod, offset) → texture2D(sampler, coord)
        processed = processed.replace(/textureLodOffset\s*\(([^,]+),\s*([^,]+),\s*[^,]+,\s*ivec2\([^)]*\)\)/g, 'texture2D($1, $2)');

        // Fix textureLod - not available in WebGL 1, use texture2D instead
        // textureLod(sampler, coord, lod) → texture2D(sampler, coord)
        processed = processed.replace(/textureLod\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture2D($1, $2)');

        return processed;
      });
      fixed = processedLines.join('\n');
    } else {
      // For WebGL2, convert 3-argument texture() calls to textureLod()
      // Need to match texture(arg1, arg2, arg3) where arg3 exists
      // Using a more careful regex that counts commas
      const lines = fixed.split('\n');
      fixed = lines.map(line => {
        // Match texture() calls with exactly 3 arguments
        // This regex finds texture( then captures up to the closing ), counting arguments by commas
        return line.replace(/\btexture\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, (match, args) => {
          // Count commas at the top level (not inside nested parentheses)
          let depth = 0;
          let commaCount = 0;
          for (let char of args) {
            if (char === '(') depth++;
            else if (char === ')') depth--;
            else if (char === ',' && depth === 0) commaCount++;
          }

          // If 3 arguments (2 commas), convert to textureLod
          if (commaCount === 2) {
            return match.replace(/\btexture\s*\(/, 'textureLod(');
          }
          return match;
        });
      }).join('\n');

      // Handle textureLodOffset - not available in WebGL2, strip offset and LOD
      fixed = fixed.replace(/textureLodOffset\s*\(([^,]+),\s*([^,]+),\s*[^,]+,\s*ivec2\([^)]*\)\)/g, 'texture($1, $2)');
    }

    // Fix textureSize - not available in WebGL 1
    // We need to replace textureSize(sampler, lod) with a uniform or constant
    // For now, replace with vec2(1024.0, 1024.0) as a reasonable default
    fixed = fixed.replace(/textureSize\s*\([^,]+,\s*[^)]+\)/g, 'ivec2(1024, 1024)');

    // Fix mat2x2 syntax error - GLSL uses mat2 not mat2x2
    fixed = fixed.replace(/\bmat2x2\b/g, 'mat2');

    // Fix do-while loops - not supported in WebGL 1 GLSL
    // Convert: do { ... } while (condition); → { ... while (condition) { ... } }
    // This is a simple transformation that works for most cases
    fixed = this.convertDoWhileLoops(fixed);

    // Fix 'out' qualifiers on sampler2D parameters - not allowed in GLSL
    // sampler2D cannot be output parameters, they are opaque types
    fixed = fixed.replace(/\bout\s+sampler2D\b/g, 'sampler2D');
    fixed = fixed.replace(/\binout\s+sampler2D\b/g, 'sampler2D');

    // Fix out/in qualifiers based on WebGL version
    // WebGL2/GLSL ES 3.0 uses 'in'/'out'
    // WebGL1/GLSL ES 1.0 uses 'attribute'/'varying'
    if (!webgl2) {
      // Only convert for WebGL1
      fixed = this.convertStorageQualifiers(fixed);
    }

    // Debug: Check HHLP RIGHT AFTER convertStorageQualifiers
    if (fixed.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = fixed.indexOf('HHLP_GetMaskCenteredOnValue');
      const lineStart = fixed.lastIndexOf('\n', idx) + 1;
      const lineEnd = fixed.indexOf('\n', idx);
      const functionLine = fixed.substring(lineStart, lineEnd > idx ? lineEnd : idx + 100);
      if (false) console.log('[fixWebGLIncompatibilities] AFTER convertStorageQualifiers:', functionLine);
    }

    // Debug: Check for HHLP_GetMaskCenteredOnValue before removeDuplicateFunctions
    if (fixed.includes('HHLP_GetMaskCenteredOnValue')) {
      const idx = fixed.indexOf('HHLP_GetMaskCenteredOnValue');
      const context = fixed.substring(Math.max(0, idx - 30), Math.min(fixed.length, idx + 150));
      if (false) console.log('[fixWebGLIncompatibilities] BEFORE removeDuplicateFunctions, HHLP context:', context);
    } else {
      if (false) console.log('[fixWebGLIncompatibilities] HHLP_GetMaskCenteredOnValue NOT FOUND before removeDuplicateFunctions');
    }

    // Remove duplicate function definitions
    fixed = this.removeDuplicateFunctions(fixed);

    // Log if any replacements were made
    if (uintUniformCount > 0 || uintVarCount > 0 || uintCastCount > 0 || mat3x3Count > 0 || textureCallCount > 0 || outQualifierCount > 0 || inQualifierCount > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fixed WebGL incompatibilities: ${uintUniformCount} uint uniforms, ${uintVarCount} uint vars, ${uintCastCount} uint casts, ${mat3x3Count} mat3x3 → mat3, ${textureCallCount} texture() → texture2D(), ${outQualifierCount} 'out' → 'varying', ${inQualifierCount} 'in' → 'varying'`);
    }

    // Inject missing constant declarations
    fixed = this.injectMissingConstants(fixed);

    return fixed;
  }

  /**
   * Inject missing constant declarations that should come from parameters or includes
   */
  private static injectMissingConstants(glslCode: string): string {
    // Check if M_PI is already defined
    const hasMPI = glslCode.includes('#define M_PI');
    if (hasMPI) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] M_PI already defined, skipping injection');
    }

    // These constants are often missing from Mega Bezel shaders due to conditional compilation
    // Add them with default values to prevent "undeclared identifier" errors
    const missingConstants = `
// Missing constants with default values
${!hasMPI ? `#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif` : ''}

// REMOVED: CSHARPEN, CCONTR, CDETAILS #defines - these are shader parameters
// that get declared as uniforms. Adding #defines causes preprocessor to expand
// "uniform float CSHARPEN;" -> "uniform float 0.0;" which is a syntax error.
// These parameters are handled by the pragma parameter system.

// CRITICAL: transpose() is NOT available in GLSL ES 1.0 (WebGL 1)!
// Add polyfill for WebGL 1 compatibility (only if not already available)
// Note: GLSL doesn't have a way to check if a function exists, so we use a version check
#if __VERSION__ < 300
  #ifndef TRANSPOSE_POLYFILL_DEFINED
  #define TRANSPOSE_POLYFILL_DEFINED
  mat3 transpose(mat3 m) {
    return mat3(
      m[0][0], m[1][0], m[2][0],
      m[0][1], m[1][1], m[2][1],
      m[0][2], m[1][2], m[2][2]
    );
  }
  #endif
#endif

// Mega Bezel shader parameters are injected as uniforms in megaBezelVariables (lines 1488+)
// DO NOT add fallback definitions here - they cause redefinition errors with the uniforms!

// REMOVED: Guest CRT color and gamut variable fallbacks (lines 5163-5189)
// These variables (RW, crtgamut, SPC, beamr, satr, satg, satb, etc.) are #defined in dogway shaders
// Adding "float RW = 0.0;" when RW is #defined as vec3(...) causes:
// "float vec3(0.95...) = 0.0;" → syntax error!
// These variables should come from #defines or be declared in the actual shader source.
`;

    // Find the position after version and precision statements
    const lines = glslCode.split('\n');
    let insertIndex = 0;

    // Find where to insert (after #version, precision, and any #define at the top)
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('#version') ||
          trimmed.startsWith('precision') ||
          (trimmed.startsWith('#define') && i < 10)) {
        insertIndex = i + 1;
      } else if (trimmed.length > 0 && !trimmed.startsWith('//')) {
        // Found first real code line
        break;
      }
    }

    // Check if position/uv are already defined before inserting constants
    // These are added by attribute conversion, so we should skip injection if they exist
    const codeText = glslCode.toLowerCase();
    const hasPositionDecl = codeText.includes('vec3 position') || codeText.includes('position');
    const hasUvDecl = codeText.includes('vec2 uv') || codeText.includes(' uv;') || codeText.includes(' uv,');

    // Always insert constants, they won't conflict
    lines.splice(insertIndex, 0, missingConstants);
    if (hasPositionDecl || hasUvDecl) {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Injected missing constant declarations (position/uv already exist)');
    } else {
      if (VERBOSE_SHADER_LOGS) console.log('[SlangCompiler] Injected missing constant declarations');
    }

    return lines.join('\n');
  }

  /**
   * Inject parameter overrides into shader source BEFORE compilation.
   * This replaces the default values in #pragma parameter directives with preset overrides.
   *
   * Example:
   *   Shader has: #pragma parameter SHARPEN_ON "Sharpen" 0.0 0.0 1.0 1.0
   *   Preset has: SHARPEN_ON = 1.0
   *   Result:     #pragma parameter SHARPEN_ON "Sharpen" 1.0 0.0 1.0 1.0
   *
   * This is CRITICAL for Mega Bezel shaders which check parameter values at compile time,
   * not runtime uniforms.
   */
  private static injectParameterOverrides(
    source: string,
    parameterOverrides: Record<string, number>
  ): string {
    if (Object.keys(parameterOverrides).length === 0) {
      return source;
    }

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Injecting ${Object.keys(parameterOverrides).length} parameter overrides into shader source`);

    const lines = source.split('\n');
    let modificationsCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Match: #pragma parameter NAME "Display Name" DEFAULT MIN MAX STEP
      if (trimmed.startsWith('#pragma parameter')) {
        const match = trimmed.match(
          /#pragma\s+parameter\s+(\w+)\s+"([^"]+)"\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)\s+([\d.+-]+)/
        );

        if (match) {
          const paramName = match[1];
          const displayName = match[2];
          const defaultValue = parseFloat(match[3]);
          const min = match[4];
          const max = match[5];
          const step = match[6];

          // Check if we have an override for this parameter
          if (parameterOverrides.hasOwnProperty(paramName)) {
            const overrideValue = parameterOverrides[paramName];

            // Replace the default value with the override
            const newLine = `#pragma parameter ${paramName} "${displayName}" ${overrideValue} ${min} ${max} ${step}`;

            if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler]   ${paramName}: ${defaultValue} -> ${overrideValue}`);
            lines[i] = line.replace(trimmed, newLine);
            modificationsCount++;
          }
        }
      }
    }

    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Modified ${modificationsCount} parameter defaults in shader source`);
    return lines.join('\n');
  }

  /**
   * Load and compile shader from URL with optional parameter overrides
   */
  public static async loadFromURL(
    url: string,
    webgl2 = true,
    parameterOverrides?: Record<string, number>
  ): Promise<CompiledShader> {
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] loadFromURL called for: ${url}`);
    // Add cache busting for development
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(url + cacheBuster);
    if (!response.ok) {
      throw new Error(`Failed to load shader: ${response.statusText}`);
    }

    let source = await response.text();
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Fetched ${source.length} chars from ${url.split('/').pop()}`);

    // Preprocess includes
    source = await this.preprocessIncludes(source, url);

    // Deduplicate #define macros to prevent redefinition errors
    source = this.deduplicateDefines(source);

    // Debug: Log preprocessed source for specific shaders
    const shaderName = url.split('/').pop() || 'unknown';
    if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Loading shader: ${shaderName}`);

    // DEBUG: For hsm-grade, check global. references before and after compilation
    if (shaderName.includes('grade')) {
      const globalsBefore = (source.match(/\bglobal\.\w+/g) || []).length;
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] [hsm-grade] global. references BEFORE compile: ${globalsBefore}`);
      if (globalsBefore > 0 && globalsBefore < 20) {
        const refs = source.match(/\bglobal\.\w+/g) || [];
        if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] [hsm-grade] Sample refs: ${refs.slice(0, 10).join(', ')}`);
      }
    }
    if (url.includes('hsm-crt-guest-advanced-potato')) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] === Preprocessing Guest CRT shader ===`);
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Total preprocessed length: ${source.length}`);

      // Check for Guest CRT specific functions
      const hasUseFake = source.includes('HSM_GetUseFakeScanlines');
      const hasNoScanline = source.includes('HSM_GetNoScanlineMode');
      const useFakeMatch = source.match(/bool HSM_GetUseFakeScanlines\(\)/);
      const noScanlineMatch = source.match(/float HSM_GetNoScanlineMode\(\)/);

      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Guest CRT - HSM_GetUseFakeScanlines: ${hasUseFake} (definition found: ${!!useFakeMatch})`);
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Guest CRT - HSM_GetNoScanlineMode: ${hasNoScanline} (definition found: ${!!noScanlineMatch})`);

      if (hasNoScanline) {
        // Find where it's defined and where it's called
        const definePattern = /float HSM_GetNoScanlineMode\(\)/g;
        const callPattern = /float no_scanlines = HSM_GetNoScanlineMode\(\)/g;
        let defineMatch = definePattern.exec(source);
        let callMatch = callPattern.exec(source);

        if (defineMatch) {
          const defineLine = source.substring(0, defineMatch.index).split('\n').length;
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] HSM_GetNoScanlineMode DEFINED at line ${defineLine}`);
        }
        if (callMatch) {
          const callLine = source.substring(0, callMatch.index).split('\n').length;
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] HSM_GetNoScanlineMode CALLED at line ${callLine}`);
        }

        if (defineMatch && callMatch) {
          if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Definition ${defineMatch.index < callMatch.index ? 'BEFORE' : 'AFTER'} call (${defineMatch.index} vs ${callMatch.index})`);
        }
      }
    }

    // CRITICAL: Inject parameter overrides BEFORE compilation
    // This replaces default values in #pragma parameter directives with preset overrides
    // Mega Bezel shaders check parameter values at compile time, not runtime
    if (parameterOverrides && Object.keys(parameterOverrides).length > 0) {
      if (VERBOSE_SHADER_LOGS) console.log(`[SlangCompiler] Applying parameter overrides before compilation`);
      source = this.injectParameterOverrides(source, parameterOverrides);
    }

    return this.compile(source, webgl2);
  }
}
