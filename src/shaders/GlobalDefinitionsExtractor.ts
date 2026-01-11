/**
 * GlobalDefinitionsExtractor - Handles extraction of global definitions from Slang shaders
 */

import { GlobalDefinitions } from './SlangShaderCompiler';

export class GlobalDefinitionsExtractor {
  /**
   * Extract global definitions (functions, #defines, consts) from before first #pragma stage
   */
  public static extract(source: string, excludeNames: Set<string> = new Set()): GlobalDefinitions {
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
      console.log('[GlobalDefinitionsExtractor] HRG_MAX_POINT_CLOUD_SIZE is in globalSection');
      const hrgDefineMatch = globalSection.match(/#define\s+HRG_MAX_POINT_CLOUD_SIZE\s+\d+/);
      if (hrgDefineMatch) {
        console.log('[GlobalDefinitionsExtractor] Found HRG define:', hrgDefineMatch[0]);
      }
    } else {
      console.log('[GlobalDefinitionsExtractor] WARNING: HRG_MAX_POINT_CLOUD_SIZE NOT in globalSection!');
    }

    // Extract #define macros (single line)
    // Skip UBO/push constant related defines and pragma parameters
    const definePattern = /^[ \t]*#define\s+\w+(?:\s+.*)?$/gm;
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
        console.log(`[GlobalDefinitionsExtractor] EXTRACTED HRG define at match ${defineCount}:`, defineLine);
      }
    }

    // Debug: Check if we extracted HRG define
    const hasHrgDefine = defines.some(d => d.includes('HRG_MAX_POINT_CLOUD_SIZE'));
    if (globalSection.includes('HRG_MAX_POINT_CLOUD_SIZE') && !hasHrgDefine) {
      console.log('[GlobalDefinitionsExtractor] ERROR: HRG define was in globalSection but NOT extracted!');
      console.log('[GlobalDefinitionsExtractor] Total defines extracted:', defines.length);
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
        console.warn(`[GlobalDefinitionsExtractor] Failed to find closing parenthesis for function: ${funcName}`);
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
            console.warn(`[GlobalDefinitionsExtractor] Unexpected character '${char}' at position ${pos} when looking for opening brace for function: ${funcName}`);
            pos = -1; // Mark as failed
            break;
          }
        }
      }

      if (pos === -1 || pos >= globalSection.length || globalSection[pos] !== '{') {
        console.warn(`[GlobalDefinitionsExtractor] Failed to find opening brace for function: ${funcName}`);
        continue;
      }

      // Skip the opening brace
      pos++;

      // Find matching closing brace for function body
      let braceCount = 1;
      while (pos < globalSection.length && braceCount > 0) {
        if (globalSection[pos] === '{') braceCount++;
        if (globalSection[pos] === '}') braceCount--;
        pos++;
      }

      if (braceCount === 0) {
        const functionCode = globalSection.substring(startPos, pos).trim();

        // Skip stub functions that will be added by buildGlobalDefinitionsCode
        const stubFunctionNames = ['HSM_GetCornerMask', 'hrg_get_ideal_global_eye_pos_for_points', 'hrg_get_ideal_global_eye_pos', 'HSM_GetBezelCoords'];
        if (stubFunctionNames.includes(funcName)) {
          console.log(`[GlobalDefinitionsExtractor] Skipping stub function extraction: ${funcName} (will be added by buildGlobalDefinitionsCode)`);
          functionRanges.push({ start: startPos, end: pos }); // Still track range to avoid extracting variables from it
        } else {
          functions.push(functionCode);
          functionRanges.push({ start: startPos, end: pos });
          extractedCount++;

          // Debug: Log first few extracted functions
          if (extractedCount <= 5) {
            console.log(`[GlobalDefinitionsExtractor] Extracted function ${extractedCount}: ${funcName} (${functionCode.length} chars, first 100): ${functionCode.substring(0, 100).replace(/\n/g, ' ')}`);
          }
        }
      } else {
        console.warn(`[GlobalDefinitionsExtractor] Failed to find closing brace for function: ${funcName}`);
      }
    }

    console.log(`[GlobalDefinitionsExtractor] Total functions extracted from global section: ${extractedCount}`);

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
        console.log(`[GlobalDefinitionsExtractor] Tracked UBO block range: ${startPos}-${pos}`);
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
    while ((mutableMatch = mutableGlobalPattern.exec(globalSection)) !== null) {
      if (isInsideFunction(mutableMatch.index) || isInsideUBOBlock(mutableMatch.index)) continue;

      const type = mutableMatch[1];
      const name = mutableMatch[2];
      let value = mutableMatch[3];

      // Skip if this name conflicts with a shader parameter or common uniform
      if (excludeNames.has(name) || commonUniformNames.has(name)) {
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
    const uninitializedGlobalPattern = /^[ \t]*((?:float|int|uint|vec[2-4]|mat[2-4]x[2-4]|mat[2-4]|ivec[2-4]|uvec[2-4]|bvec[2-4]|bool))\s+(\w+)\s*;/gm;
    let uninitMatch;
    while ((uninitMatch = uninitializedGlobalPattern.exec(globalSection)) !== null) {
      if (isInsideFunction(uninitMatch.index) || isInsideUBOBlock(uninitMatch.index)) continue;

      const type = uninitMatch[1];
      const name = uninitMatch[2];

      // Skip if already extracted or conflicts with shader parameter or common uniform
      if (extractedGlobalNames.has(name) || excludeNames.has(name) || commonUniformNames.has(name)) {
        continue;
      }

      // Add uninitialized global
      globals.push(`${type} ${name};`);
    }

    console.log('[GlobalDefinitionsExtractor] extractGlobalDefinitions - found:');
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
}