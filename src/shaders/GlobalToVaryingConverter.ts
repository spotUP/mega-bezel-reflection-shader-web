/**
 * GlobalToVaryingConverter.ts
 *
 * Converts mutable global variables to varyings for WebGL compatibility.
 *
 * Problem: Slang shaders use mutable global variables that are set in the vertex shader
 * and accessed in the fragment shader. This doesn't work in WebGL because vertex and
 * fragment shaders are separate compilation units.
 *
 * Solution: Convert these globals to varyings (out in vertex, in in fragment).
 */

export interface GlobalVariable {
  name: string;
  type: string;
  initialValue?: string;
}

export class GlobalToVaryingConverter {
  private webgl2: boolean;

  // Global cache to track varyings across ALL shader passes
  private static globalVaryingCache = {
    vertex: new Set<string>(),
    fragment: new Set<string>(),
    // Reset the cache at the start of a new compilation session
    reset: function() {
      this.vertex.clear();
      this.fragment.clear();
      console.log('[GlobalVaryingCache] Cache reset for new compilation session');
    },
    // Check if a varying has been added globally
    has: function(stage: 'vertex' | 'fragment', varName: string): boolean {
      return stage === 'vertex' ? this.vertex.has(varName) : this.fragment.has(varName);
    },
    // Add a varying to the global cache
    add: function(stage: 'vertex' | 'fragment', varName: string): void {
      if (stage === 'vertex') {
        this.vertex.add(varName);
      } else {
        this.fragment.add(varName);
      }
    }
  };

  constructor(webgl2: boolean = true) {
    this.webgl2 = webgl2;
    // Bind methods to ensure proper 'this' context
    this.injectVaryingDeclarations = this.injectVaryingDeclarations.bind(this);
  }

  /**
   * Reset the global varying cache - should be called at the start of a new compilation session
   */
  public static resetGlobalCache(): void {
    GlobalToVaryingConverter.globalVaryingCache.reset();
  }

  /**
   * Parse global variable declarations from globals.inc
   * Extracts variables like: float TUBE_MASK = 0;
   */
  private parseGlobalVariables(globalsSource: string): GlobalVariable[] {
    const globals: GlobalVariable[] = [];

    // Match patterns like:
    // float TUBE_MASK = 0;
    // vec2 SCREEN_COORD = vec2(0.5);
    // bool CACHE_INFO_CHANGED = false;
    const globalRegex = /^\s*(float|vec[234]|mat[234]|bool|int|uint)\s+([A-Z_][A-Z0-9_]*)\s*=\s*([^;]+);/gm;

    let match;
    while ((match = globalRegex.exec(globalsSource)) !== null) {
      globals.push({
        name: match[2],
        type: match[1],
        initialValue: match[3].trim()
      });
    }

    console.log(`[GlobalToVaryingConverter] Found ${globals.length} global variables`);
    return globals;
  }

  /**
   * Check if a variable is actually a constant (computed from other constants)
   * These should NOT be converted to varyings
   */
  private isActuallyConstant(varName: string, initialValue: string | undefined, isModified: boolean): boolean {
    // Check for enum-like constants (pattern: XXX_YYY_ZZZ with numeric literal)
    // Examples: SOURCE_MATTE_WHITE = 1, BLEND_MODE_OFF = 0, CURVATURE_MODE_2D = 1
    const enumPattern = /^[A-Z]+_[A-Z]+_[A-Z0-9_]+$/;
    const literalPattern = /^(\d+\.?\d*|vec[234]\([0-9.,\s]+\)|false|true)$/;

    if (enumPattern.test(varName) && initialValue && literalPattern.test(initialValue.trim())) {
      return true;
    }

    // If it's modified in the vertex shader, it's NOT a constant regardless of initial value
    // (unless it's an enum constant which shouldn't be modified at all)
    if (isModified) {
      return false;
    }

    // Constants have initialization values that are themselves constants or literal values
    // Examples:
    // - DEFAULT_SCREEN_ASPECT = DEFAULT_UNCORRECTED_SCREEN_SCALE.x / DEFAULT_UNCORRECTED_SCREEN_SCALE.y
    // - INFOCACHE_MAX_INDEX = 4
    // - NEGATIVE_CROP_EXPAND_MULTIPLIER = 0.5

    if (!initialValue) {
      return false;
    }

    // If it references other DEFAULT_ or _MAX_ constants or computed expressions, it's a constant
    const constantRefPattern = /(DEFAULT_|_MAX_|NEGATIVE_CROP|FOLLOW_MODE_)/;
    if (constantRefPattern.test(initialValue)) {
      return true;
    }

    // If it's a simple literal AND variable name suggests it's a constant (all caps with specific patterns)
    const isLikelyConstant = /^(DEFAULT_|INFOCACHE_|FOLLOW_MODE_|NEGATIVE_|CACHE_INFO_CHANGED|CURRENT_FRAME_FROM_CACHE_INFO)/.test(varName);
    if (isLikelyConstant && literalPattern.test(initialValue.trim())) {
      return true;
    }

    return false;
  }

  /**
   * Determine which global variables are modified (assigned to) in a shader
   */
  private findModifiedInShader(source: string, globalVars: GlobalVariable[]): Set<string> {
    const modified = new Set<string>();

    for (const globalVar of globalVars) {
      // Look for assignment patterns:
      // TUBE_MASK = something
      // SCREEN_COORD = something
      // Note: We need to match the variable name followed by = (not ==, !=, <=, >=)
      const assignmentPattern = new RegExp(`\\b${globalVar.name}\\s*=(?!=)`, 'g');

      if (assignmentPattern.test(source)) {
        modified.add(globalVar.name);
      }
    }

    return modified;
  }

  /**
   * Determine which global variables should be converted to varyings
   * Only converts variables that are:
   * 1. Modified in vertex shader
   * 2. NOT modified in fragment shader (those need to stay as local variables)
   * 3. Not constants
   */
  private findVaryingCandidates(
    vertexSource: string,
    fragmentSource: string,
    globalVars: GlobalVariable[]
  ): Set<string> {
    // Find variables modified in each stage
    const modifiedInVertex = this.findModifiedInShader(vertexSource, globalVars);
    const modifiedInFragment = this.findModifiedInShader(fragmentSource, globalVars);

    const varyings = new Set<string>();

    for (const globalVar of globalVars) {
      const isModifiedInVertex = modifiedInVertex.has(globalVar.name);
      const isModifiedInFragment = modifiedInFragment.has(globalVar.name);

      // Skip constants (variables with constant initializers that are NOT modified)
      if (this.isActuallyConstant(globalVar.name, globalVar.initialValue, isModifiedInVertex)) {
        console.log(`[GlobalToVaryingConverter] Skipping constant: ${globalVar.name} = ${globalVar.initialValue}`);
        continue;
      }

      // Only convert to varying if modified in vertex but NOT in fragment
      if (isModifiedInVertex && !isModifiedInFragment) {
        varyings.add(globalVar.name);
      } else if (isModifiedInVertex && isModifiedInFragment) {
        console.log(`[GlobalToVaryingConverter] Skipping ${globalVar.name} (modified in both stages - needs local handling)`);
      }
    }

    console.log(`[GlobalToVaryingConverter] Found ${varyings.size} globals to convert to varyings`);
    return varyings;
  }

  /**
   * Get the GLSL type of a variable by name from the globals list
   */
  private getVariableType(varName: string, globals: GlobalVariable[]): string {
    const globalVar = globals.find(g => g.name === varName);
    if (!globalVar) {
      console.warn(`[GlobalToVaryingConverter] Could not find type for variable: ${varName}`);
      return 'float'; // Default fallback
    }
    return globalVar.type;
  }

  /**
   * Generate varying declaration for a global variable
   */
  private generateVaryingDecl(varName: string, varType: string, stage: 'vertex' | 'fragment'): string {
    const varyingName = `v_${varName}`;

    // WebGL doesn't support bool varyings, convert to int (can use flat interpolation)
    let effectiveType = varType;
    if (varType === 'bool') {
      effectiveType = 'int';
    }

    // Ints and uints need flat interpolation in WebGL 2
    const needsFlat = (effectiveType === 'int' || effectiveType === 'uint') && this.webgl2;
    const flatQualifier = needsFlat ? 'flat ' : '';

    if (this.webgl2) {
      // WebGL 2: use 'out' in vertex, 'in' in fragment
      const qualifier = stage === 'vertex' ? 'out' : 'in';
      return `${flatQualifier}${qualifier} ${effectiveType} ${varyingName};`;
    } else {
      // WebGL 1: use 'varying' in both stages
      // Note: WebGL 1 doesn't support int/uint/bool varyings, so we convert them to float
      if (effectiveType === 'int' || effectiveType === 'uint' || varType === 'bool') {
        return `varying float ${varyingName};`;
      }
      return `varying ${effectiveType} ${varyingName};`;
    }
  }

  /**
   * Remove global variable declaration from shader source
   */
  private removeGlobalDeclaration(source: string, varName: string, varType: string): string {
    // Match patterns like:
    // float TUBE_MASK = 0;
    // vec2 SCREEN_COORD = vec2(0.5);
    const declPattern = new RegExp(`^\\s*${varType}\\s+${varName}\\s*=\\s*[^;]+;\\s*$`, 'gm');

    return source.replace(declPattern, '');
  }

  /**
   * Replace all references to a global variable with its varying name
   * Also adds type conversion for bool variables (converted to int in varyings)
   */
  private replaceVariableReferences(source: string, varName: string, varType: string, stage: 'vertex' | 'fragment'): string {
    const varyingName = `v_${varName}`;

    // For bool variables converted to int, we need to add type conversion
    if (varType === 'bool' && stage === 'vertex') {
      // In vertex shader, convert assignments: CACHE_INFO_CHANGED = true -> v_CACHE_INFO_CHANGED = int(true)
      // Match: varName = <value> (not ==, !=, <=, >=)
      const assignmentPattern = new RegExp(`\\b${varName}\\s*=(?!=)\\s*([^;]+);`, 'g');
      source = source.replace(assignmentPattern, (match, value) => {
        return `${varyingName} = int(${value.trim()});`;
      });

      // Replace remaining references (reads) with just the varying name
      const readPattern = new RegExp(`\\b${varName}\\b(?!\\s*=)`, 'g');
      source = source.replace(readPattern, varyingName);

      return source;
    } else if (varType === 'bool' && stage === 'fragment') {
      // In fragment shader, convert reads: if (CACHE_INFO_CHANGED) -> if (bool(v_CACHE_INFO_CHANGED))
      // But we need to be careful not to wrap already-wrapped expressions
      const wordBoundaryPattern = new RegExp(`\\b${varName}\\b`, 'g');
      source = source.replace(wordBoundaryPattern, `bool(${varyingName})`);

      return source;
    }

    // For non-bool variables, simple replacement
    const wordBoundaryPattern = new RegExp(`\\b${varName}\\b`, 'g');
    return source.replace(wordBoundaryPattern, varyingName);
  }

  /**
   * Find the position after precision declarations to inject varying declarations
   */
  private findInjectionPoint(source: string): number {
    // Look for precision declarations like: precision mediump float;
    const precisionMatch = source.match(/precision\s+\w+\s+\w+\s*;\s*\n/);

    if (precisionMatch && precisionMatch.index !== undefined) {
      return precisionMatch.index + precisionMatch[0].length;
    }

    // If no precision, look for #version
    const versionMatch = source.match(/#version.*?\n/);
    if (versionMatch && versionMatch.index !== undefined) {
      return versionMatch.index + versionMatch[0].length;
    }

    // Default: insert at beginning
    return 0;
  }

  /**
   * Inject varying declarations into shader source
   * If a varying section already exists, append to it; otherwise create new section
   * Deduplicates declarations to prevent redefinition errors
   */
  private injectVaryingDeclarations = (source: string, declarations: string[]): string => {
    // Force a visible error to confirm method is called
    if (declarations.length > 0 && declarations[0].includes('v_DEFAULT_SCREEN_ASPECT')) {
      console.error('[VaryingDedup] METHOD IS DEFINITELY CALLED - v_DEFAULT_SCREEN_ASPECT injection');
    }
    console.log(`[VaryingDedup] injectVaryingDeclarations called with ${declarations.length} declarations`);
    console.log(`[VaryingDedup] Method actually called!`);

    if (declarations.length === 0) {
      console.log('[VaryingDedup] Empty declarations array, returning early');
      return source;
    }

    // Filter out declarations that already exist anywhere in the source
    let filteredCount = 0;
    const newDecls = declarations.filter(decl => {
      // Extract the variable name from the declaration (e.g., "out float v_TUBE_MASK;" → "v_TUBE_MASK")
      const nameMatch = decl.match(/\b(v_[A-Z_0-9]+)\b/);
      if (nameMatch) {
        const varName = nameMatch[1];
        // Check if this variable is already declared anywhere in the source
        // Look for ACTUAL DECLARATIONS with type qualifiers (in/out/varying) and type keywords
        // This should NOT match assignments like "DECAL_COORD = v_DECAL_COORD;"
        const varPattern = new RegExp(`\\b(flat\\s+)?(in|out|varying)\\s+(float|vec[234]|mat[234]|int|uint)\\s+${varName}\\s*;`);
        const alreadyExists = varPattern.test(source);

        // Also check for a simpler pattern in case formatting is different
        const simplePattern = new RegExp(`\\b${varName}\\b`);
        const varExistsAnywhere = simplePattern.test(source);

        if (alreadyExists) {
          // Variable already declared, skip it
          filteredCount++;
          return false;
        } else if (varExistsAnywhere) {
          // Variable exists but not as expected declaration - log for debugging
          console.log(`[VaryingDedup] WARNING: ${varName} exists in source but not as expected declaration`);
          console.log(`[VaryingDedup] Looking for pattern: ${varPattern}`);
          // Still add it since it's not a proper declaration
        }
        return true;
      }
      return true;
    });

    if (filteredCount > 0) {
      console.log(`[VaryingDedup] Filtered out ${filteredCount} existing declarations from ${declarations.length} total`);
      console.log(`[VaryingDedup] Adding ${newDecls.length} new declarations`);
    }

    if (newDecls.length === 0) {
      // All declarations already exist
      console.log('[VaryingDedup] All declarations already exist, skipping injection');
      return source;
    }

    console.log(`[VaryingDedup] Injecting ${newDecls.length} declarations (${declarations.length} requested, ${filteredCount} filtered)`);

    // Check if we already have a "Global-to-varying conversions" section
    const sectionMatch = source.match(/\/\/ Global-to-varying conversions\n([\s\S]*?)\n\n/);

    if (sectionMatch && sectionMatch.index !== undefined) {
      // Section exists - append new declarations if they don't already exist
      console.log(`[VaryingDedup] Found existing section, appending ${newDecls.length} new declarations`);
      const endOfSection = sectionMatch.index + sectionMatch[0].length - 2;
      const newDeclsStr = newDecls.join('\n') + '\n';
      return source.substring(0, endOfSection) + newDeclsStr + source.substring(endOfSection);
    } else {
      // No section exists - create new one
      console.log(`[VaryingDedup] Creating new section with ${newDecls.length} declarations`);
      const injectionPoint = this.findInjectionPoint(source);
      const varyingBlock = '\n// Global-to-varying conversions\n' + newDecls.join('\n') + '\n\n';
      return source.substring(0, injectionPoint) + varyingBlock + source.substring(injectionPoint);
    }
  }

  /**
   * Get local variable initialization for dual-stage variables
   */
  private getLocalInitialization(varName: string, varType: string): string {
    // Special handling for bool types
    if (varType === 'bool') {
      return `  bool ${varName} = bool(v_${varName}); // Local copy from varying\n`;
    }

    // Special handling for variables with complex initialization
    const complexInits = ['DEFAULT_SCREEN_SCALE', 'DEFAULT_BEZEL_SCALE'];
    if (complexInits.includes(varName)) {
      return `  ${varType} ${varName} = v_${varName}; // Local copy from varying (may need original init logic)\n`;
    }

    return `  ${varType} ${varName} = v_${varName}; // Local copy from varying\n`;
  }

  /**
   * Inject a single varying declaration after precision statements
   */
  private injectVaryingDeclaration(source: string, declaration: string): string {
    const injectionPoint = this.findInjectionPoint(source);

    // Check if we already have a "Global-to-varying conversions" section
    const hasSection = source.includes('// Global-to-varying conversions');

    if (hasSection) {
      // Find the end of the section and inject there
      const sectionMatch = source.match(/\/\/ Global-to-varying conversions\n([\s\S]*?)\n\n/);
      if (sectionMatch && sectionMatch.index !== undefined) {
        const endOfSection = sectionMatch.index + sectionMatch[0].length - 2; // Before the double newline
        return source.substring(0, endOfSection) + declaration + '\n' + source.substring(endOfSection);
      }
    }

    // No section exists, create it
    const varyingBlock = '\n// Global-to-varying conversions\n' + declaration + '\n\n';
    return source.substring(0, injectionPoint) + varyingBlock + source.substring(injectionPoint);
  }

  /**
   * Add local variable system for dual-stage variables in fragment shader
   * Creates: varying input → global-scope local variable initialized from varying
   * Returns the transformed source (declarations are injected separately)
   */
  private addLocalVariableSystem(source: string, varName: string, varType: string): string {
    // Instead of adding inside main(), add at global scope after varyings
    // This makes the variable accessible to ALL functions, not just main()
    //
    // We'll inject it right after the varying declarations section
    // The initialization will be from the varying value
    const varyingName = `v_${varName}`;

    // Create a global variable initialized from the varying
    // Note: In GLSL, we can't directly initialize globals from varyings,
    // so we need to create a macro or use a different approach.
    //
    // Actually, the best approach is to NOT remove the global declaration
    // and instead initialize it at the START of main() from the varying.

    // Find main() function and inject initialization at the very start
    const mainPattern = /void\s+main\s*\(\s*\)\s*{/;
    const mainMatch = source.match(mainPattern);

    if (mainMatch && mainMatch.index !== undefined) {
      const insertPos = mainMatch.index + mainMatch[0].length;

      // Initialize from varying: SCREEN_INDEX = v_SCREEN_INDEX;
      const initialization = `\n  ${varName} = ${varyingName}; // Initialize from varying\n`;
      source = source.slice(0, insertPos) + initialization + source.slice(insertPos);
    } else {
      console.warn(`[GlobalToVaryingConverter] Could not find main() function for ${varName}`);
    }

    // DON'T remove the global declaration - just change it to uninitialized
    // Replace "float SCREEN_INDEX = 0;" with "float SCREEN_INDEX;"
    const declPattern = new RegExp(`(${varType})\\s+(${varName})\\s*=\\s*[^;]+;`, 'g');
    source = source.replace(declPattern, `$1 $2; // Will be initialized from varying in main()`);

    return source;
  }

  /**
   * Convert dual-stage variable references to varying output in vertex shader
   * Transforms: TUBE_MASK = value → v_TUBE_MASK = value
   * Returns the transformed source (declarations are injected separately)
   */
  private convertToVaryingOutput(source: string, varName: string, varType: string): string {
    const varyingName = `v_${varName}`;

    // Handle bool type conversion in vertex shader
    if (varType === 'bool') {
      // Replace assignments: TUBE_MASK = value → v_TUBE_MASK = int(value)
      const assignmentPattern = new RegExp(`\\b${varName}\\s*=(?!=)\\s*([^;]+);`, 'g');
      source = source.replace(assignmentPattern, (match, value) => {
        return `${varyingName} = int(${value.trim()});`;
      });

      // Replace reads: if (TUBE_MASK) → if (v_TUBE_MASK != 0)
      const readPattern = new RegExp(`\\b${varName}\\b(?!\\s*=)`, 'g');
      source = source.replace(readPattern, `(${varyingName} != 0)`);
    } else {
      // For non-bool types: simple replacement
      // Replace assignments: TUBE_MASK = value → v_TUBE_MASK = value
      const assignmentPattern = new RegExp(`\\b${varName}\\s*=`, 'g');
      source = source.replace(assignmentPattern, `${varyingName} =`);

      // Replace reads: x = TUBE_MASK → x = v_TUBE_MASK
      const readPattern = new RegExp(`\\b${varName}\\b(?!\\s*=)`, 'g');
      source = source.replace(readPattern, varyingName);
    }

    // Remove global declaration
    source = this.removeGlobalDeclaration(source, varName, varType);

    return source;
  }

  /**
   * Process dual-stage variables (modified in both vertex and fragment shaders)
   * Transforms them into: varying output (vertex) → varying input (fragment) → local variable (fragment)
   * NOTE: This method no longer injects declarations - that's handled by convertGlobalsToVaryings
   */
  private processDualStageVariables(
    vertexSource: string,
    fragmentSource: string,
    dualStageVars: Set<string>,
    globalVars: GlobalVariable[]
  ): { vertex: string; fragment: string } {
    let processedVertex = vertexSource;
    let processedFragment = fragmentSource;

    console.log(`[GlobalToVaryingConverter] Processing ${dualStageVars.size} dual-stage variables`);

    for (const varName of dualStageVars) {
      const varType = this.getVariableType(varName, globalVars);

      console.log(`[DualStage] Converting ${varName} (${varType})`);

      // Transform vertex shader: convert to varying output
      processedVertex = this.convertToVaryingOutput(processedVertex, varName, varType);

      // Transform fragment shader: add local variable
      processedFragment = this.addLocalVariableSystem(processedFragment, varName, varType);
    }

    return { vertex: processedVertex, fragment: processedFragment };
  }

  /**
   * Main conversion function
   *
   * @param vertexSource - Vertex shader source code
   * @param fragmentSource - Fragment shader source code
   * @param globalsIncSource - Source code from globals.inc
   * @returns Object with converted vertex and fragment sources
   */
  public convertGlobalsToVaryings(
    vertexSource: string,
    fragmentSource: string,
    globalsIncSource: string
  ): { vertex: string; fragment: string } {
    console.log('[GlobalToVaryingConverter] Starting conversion...');

    // Step 1: Parse all global variables from globals.inc
    const globalVars = this.parseGlobalVariables(globalsIncSource);

    // Step 2: Find variables modified in each stage
    const modifiedInVertex = this.findModifiedInShader(vertexSource, globalVars);
    const modifiedInFragment = this.findModifiedInShader(fragmentSource, globalVars);

    // Step 3: Categorize variables
    const varyingGlobals = new Set<string>(); // Modified in vertex only
    const dualStageModified = new Set<string>(); // Modified in both stages

    for (const globalVar of globalVars) {
      const inVertex = modifiedInVertex.has(globalVar.name);
      const inFragment = modifiedInFragment.has(globalVar.name);

      // Skip constants
      if (this.isActuallyConstant(globalVar.name, globalVar.initialValue, inVertex)) {
        console.log(`[GlobalToVaryingConverter] Skipping constant: ${globalVar.name} = ${globalVar.initialValue}`);
        continue;
      }

      // Categorize based on modification pattern
      if (inVertex && inFragment) {
        dualStageModified.add(globalVar.name);
      } else if (inVertex && !inFragment) {
        varyingGlobals.add(globalVar.name);
      }
    }

    console.log('[GlobalToVaryingConverter] Variable categorization:');
    console.log(`  - Single-stage (vertex only): ${varyingGlobals.size}`);
    console.log(`  - Dual-stage (both stages): ${dualStageModified.size}`);

    // Step 4: Collect ALL varying declarations BEFORE any processing
    const allVertexVaryingDecls: string[] = [];
    const allFragmentVaryingDecls: string[] = [];

    // Collect dual-stage varying declarations
    if (dualStageModified.size > 0) {
      console.log('[GlobalToVaryingConverter] Collecting dual-stage varying declarations...');
      for (const varName of dualStageModified) {
        const varType = this.getVariableType(varName, globalVars);
        allVertexVaryingDecls.push(this.generateVaryingDecl(varName, varType, 'vertex'));
        allFragmentVaryingDecls.push(this.generateVaryingDecl(varName, varType, 'fragment'));
      }
    }

    // Collect single-stage varying declarations
    if (varyingGlobals.size > 0) {
      console.log('[GlobalToVaryingConverter] Collecting single-stage varying declarations...');
      for (const varName of varyingGlobals) {
        const varType = this.getVariableType(varName, globalVars);
        allVertexVaryingDecls.push(this.generateVaryingDecl(varName, varType, 'vertex'));
        allFragmentVaryingDecls.push(this.generateVaryingDecl(varName, varType, 'fragment'));
      }
    }

    console.log(`[GlobalToVaryingConverter] Total declarations collected:`);
    console.log(`  - Vertex: ${allVertexVaryingDecls.length} declarations`);
    console.log(`  - Fragment: ${allFragmentVaryingDecls.length} declarations`);

    // Step 5: Process transformations WITHOUT injecting declarations
    let processedVertex = vertexSource;
    let processedFragment = fragmentSource;

    // Process dual-stage variables (transformation only, no injection)
    if (dualStageModified.size > 0) {
      console.log('[GlobalToVaryingConverter] Processing dual-stage variable transformations...');
      const dualProcessed = this.processDualStageVariables(
        processedVertex,
        processedFragment,
        dualStageModified,
        globalVars
      );
      processedVertex = dualProcessed.vertex;
      processedFragment = dualProcessed.fragment;
    }

    // Process single-stage variables (transformation only, no injection)
    if (varyingGlobals.size > 0) {
      console.log('[GlobalToVaryingConverter] Processing single-stage variable transformations...');

      // Process vertex shader transformations
      for (const varName of varyingGlobals) {
        const varType = this.getVariableType(varName, globalVars);
        processedVertex = this.removeGlobalDeclaration(processedVertex, varName, varType);
        processedVertex = this.replaceVariableReferences(processedVertex, varName, varType, 'vertex');
      }

      // Process fragment shader transformations
      for (const varName of varyingGlobals) {
        const varType = this.getVariableType(varName, globalVars);
        processedFragment = this.removeGlobalDeclaration(processedFragment, varName, varType);
        processedFragment = this.replaceVariableReferences(processedFragment, varName, varType, 'fragment');
      }
    }

    // Step 6: Inject ALL varying declarations at once (unified injection)
    console.log('[GlobalToVaryingConverter] Performing unified declaration injection...');

    if (allVertexVaryingDecls.length > 0) {
      console.log(`[GlobalToVaryingConverter] Injecting ${allVertexVaryingDecls.length} vertex varying declarations`);
      console.log(`[GlobalToVaryingConverter] First vertex varying decl: ${allVertexVaryingDecls[0]}`);

      // INLINE DEDUPLICATION AND INJECTION (bypassing method call issue)
      const dedupedVertexDecls: string[] = [];
      for (const decl of allVertexVaryingDecls) {
        const nameMatch = decl.match(/\b(v_[A-Z_0-9]+)\b/);
        if (nameMatch) {
          const varName = nameMatch[1];

          // Check global cache FIRST
          if (GlobalToVaryingConverter.globalVaryingCache.has('vertex', varName)) {
            console.log(`[GlobalToVaryingConverter] Skipping ${varName} - already in global cache`);
            continue;
          }

          // Check if this variable is already declared in the current source
          const declarationCheck = new RegExp(`\\b(flat\\s+)?(in|out|varying)\\s+(float|vec[234]|mat[234]|int|uint)\\s+${varName}\\s*;`);

          if (declarationCheck.test(processedVertex)) {
            console.log(`[GlobalToVaryingConverter] Skipping duplicate vertex declaration: ${varName} (already in source)`);
            // Add to global cache so future passes skip it
            GlobalToVaryingConverter.globalVaryingCache.add('vertex', varName);
          } else {
            // This is a new varying - add it
            dedupedVertexDecls.push(decl);
            // Add to global cache to prevent future duplicates
            GlobalToVaryingConverter.globalVaryingCache.add('vertex', varName);
            console.log(`[GlobalToVaryingConverter] Added ${varName} to vertex (and global cache)`);
          }
        }
      }

      if (dedupedVertexDecls.length > 0) {
        console.log(`[GlobalToVaryingConverter] Adding ${dedupedVertexDecls.length} deduplicated vertex declarations`);
        // Check if we already have a "Global-to-varying conversions" section
        const sectionMatch = processedVertex.match(/\/\/ Global-to-varying conversions\n([\s\S]*?)\n\n/);
        if (sectionMatch && sectionMatch.index !== undefined) {
          // Append to existing section
          const endOfSection = sectionMatch.index + sectionMatch[0].length - 2;
          processedVertex = processedVertex.substring(0, endOfSection) + dedupedVertexDecls.join('\n') + '\n' + processedVertex.substring(endOfSection);
        } else {
          // Create new section
          const varyingBlock = '\n// Global-to-varying conversions\n' + dedupedVertexDecls.join('\n') + '\n\n';
          const injectionPoint = this.findInjectionPoint(processedVertex);
          processedVertex = processedVertex.substring(0, injectionPoint) + varyingBlock + processedVertex.substring(injectionPoint);
        }
      }

      console.log(`[GlobalToVaryingConverter] Vertex injection complete`);
    }

    if (allFragmentVaryingDecls.length > 0) {
      console.log(`[GlobalToVaryingConverter] Injecting ${allFragmentVaryingDecls.length} fragment varying declarations`);
      console.log(`[GlobalToVaryingConverter] First fragment varying decl: ${allFragmentVaryingDecls[0]}`);

      // INLINE DEDUPLICATION AND INJECTION (bypassing method call issue)
      const dedupedFragmentDecls: string[] = [];
      for (const decl of allFragmentVaryingDecls) {
        const nameMatch = decl.match(/\b(v_[A-Z_0-9]+)\b/);
        if (nameMatch) {
          const varName = nameMatch[1];

          // Check global cache FIRST
          if (GlobalToVaryingConverter.globalVaryingCache.has('fragment', varName)) {
            console.log(`[GlobalToVaryingConverter] Skipping ${varName} - already in global cache`);
            continue;
          }

          // Check if this variable is already declared in the current source
          const declarationCheck = new RegExp(`\\b(flat\\s+)?(in|out|varying)\\s+(float|vec[234]|mat[234]|int|uint)\\s+${varName}\\s*;`);

          if (declarationCheck.test(processedFragment)) {
            console.log(`[GlobalToVaryingConverter] Skipping duplicate fragment declaration: ${varName} (already in source)`);
            // Add to global cache so future passes skip it
            GlobalToVaryingConverter.globalVaryingCache.add('fragment', varName);
          } else {
            // This is a new varying - add it
            dedupedFragmentDecls.push(decl);
            // Add to global cache to prevent future duplicates
            GlobalToVaryingConverter.globalVaryingCache.add('fragment', varName);
            console.log(`[GlobalToVaryingConverter] Added ${varName} to fragment (and global cache)`);
          }
        }
      }

      if (dedupedFragmentDecls.length > 0) {
        console.log(`[GlobalToVaryingConverter] Adding ${dedupedFragmentDecls.length} deduplicated fragment declarations`);
        // Check if we already have a "Global-to-varying conversions" section
        const sectionMatch = processedFragment.match(/\/\/ Global-to-varying conversions\n([\s\S]*?)\n\n/);
        if (sectionMatch && sectionMatch.index !== undefined) {
          // Append to existing section
          const endOfSection = sectionMatch.index + sectionMatch[0].length - 2;
          processedFragment = processedFragment.substring(0, endOfSection) + dedupedFragmentDecls.join('\n') + '\n' + processedFragment.substring(endOfSection);
        } else {
          // Create new section
          const varyingBlock = '\n// Global-to-varying conversions\n' + dedupedFragmentDecls.join('\n') + '\n\n';
          const injectionPoint = this.findInjectionPoint(processedFragment);
          processedFragment = processedFragment.substring(0, injectionPoint) + varyingBlock + processedFragment.substring(injectionPoint);
        }
      }

      console.log(`[GlobalToVaryingConverter] Fragment injection complete`);
    }

    console.log('[GlobalToVaryingConverter] Conversion complete');
    console.log(`  - Converted ${varyingGlobals.size} single-stage globals to varyings`);
    console.log(`  - Converted ${dualStageModified.size} dual-stage globals to varying+local pattern`);

    return {
      vertex: processedVertex,
      fragment: processedFragment
    };
  }

  /**
   * Convert a single shader stage (for standalone use)
   */
  public convertStage(
    source: string,
    stage: 'vertex' | 'fragment',
    globalsIncSource: string,
    modifiedGlobals: Set<string>,
    globalVars: GlobalVariable[]
  ): string {
    let output = source;

    // Generate varying declarations
    const varyingDecls: string[] = [];
    for (const varName of modifiedGlobals) {
      const varType = this.getVariableType(varName, globalVars);
      varyingDecls.push(this.generateVaryingDecl(varName, varType, stage));
    }

    // Remove global declarations
    for (const varName of modifiedGlobals) {
      const varType = this.getVariableType(varName, globalVars);
      output = this.removeGlobalDeclaration(output, varName, varType);
    }

    // Replace variable references (with type conversion for bools)
    for (const varName of modifiedGlobals) {
      const varType = this.getVariableType(varName, globalVars);
      output = this.replaceVariableReferences(output, varName, varType, stage);
    }

    // Inject varying declarations
    output = this.injectVaryingDeclarations(output, varyingDecls);

    return output;
  }
}
