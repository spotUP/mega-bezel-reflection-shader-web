/**
 * IncludePreprocessor - Handles #include directive processing for Slang shaders
 */

const VERBOSE_INCLUDE_LOGS = false;

export interface ConditionalBlock {
  type: 'ifdef' | 'ifndef' | 'if';
  macro?: string;
  start: number;
  end: number;
  enabled: boolean;
  definedMacros: Set<string>;
}

export interface IncludeDirective {
  directive: string;
  path: string;
  index: number;
  isInDisabledBlock: boolean;
  condition?: string;
}

export class IncludePreprocessor {
  /**
   * Normalize a URL path to a canonical form for duplicate detection
   */
  private static normalizePath(path: string): string {
    // Split into segments and resolve .. and .
    const segments = path.split('/').filter(s => s);
    const normalized: string[] = [];

    for (const segment of segments) {
      if (segment === '..') {
        normalized.pop();
      } else if (segment !== '.') {
        normalized.push(segment);
      }
    }

    return '/' + normalized.join('/');
  }

  /**
   * Enhanced GLSL preprocessor for Mega Bezel complex #include handling
   */
  public static async preprocessIncludes(
    source: string,
    baseUrl: string,
    processedFiles = new Set<string>(),
    definedMacros = new Set<string>(),
    includeStack: string[] = []
  ): Promise<string> {
    // Prevent infinite recursion
    if (includeStack.length > 20) {
      throw new Error(`Include stack too deep: ${includeStack.join(' -> ')}`);
    }

    // Extract base directory from URL
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);

    // Normalize the URL for duplicate detection
    const normalizedUrl = this.normalizePath(baseUrl);

    // Track this file to prevent circular includes AND duplicate includes
    if (processedFiles.has(normalizedUrl)) {
      if (VERBOSE_INCLUDE_LOGS) console.log(`[IncludePreprocessor] Skipping already-processed file: ${baseUrl} (normalized: ${normalizedUrl})`);
      return `// Already included: ${baseUrl}`;
    }
    processedFiles.add(normalizedUrl);
    includeStack.push(baseUrl);

    // Extract all #define macros from this file to track what's defined
    const definePattern = /#define\s+(\w+)(?:\s+.*)?$/gm;
    let defineMatch;
    while ((defineMatch = definePattern.exec(source)) !== null) {
      definedMacros.add(defineMatch[1]);
    }

    // Extract #ifdef/#ifndef blocks to understand conditional compilation
    const conditionalBlocks = this.extractConditionalBlocks(source, definedMacros);

    // Find all #include directives with their positions and context
    const includePattern = /#include\s+"([^"]+)"/g;
    let match;
    let result = source;
    const includes: IncludeDirective[] = [];

    while ((match = includePattern.exec(source)) !== null) {
      const isInDisabledBlock = this.isIncludeInDisabledBlock(source, match.index, definedMacros);
      includes.push({
        directive: match[0],
        path: match[1],
        index: match.index,
        isInDisabledBlock,
        condition: this.getConditionalContext(source, match.index, conditionalBlocks)
      });
    }

    // Process includes in reverse order to preserve line positions
    for (const include of includes.reverse()) {
      if (include.isInDisabledBlock) {
        if (VERBOSE_INCLUDE_LOGS) console.log(`[IncludePreprocessor] Skipping #include "${include.path}" (inside disabled conditional block: ${include.condition})`);
        result = result.replace(include.directive, `// SKIPPED (conditional): ${include.directive}`);
        continue;
      }

      // Resolve relative path with enhanced logic
      const includePath = include.path;
      let includeUrl: string;

      if (includePath.startsWith('/')) {
        // Absolute path from shader root
        includeUrl = this.normalizePath(includePath);
      } else if (includePath.startsWith('./') || includePath.startsWith('../')) {
        // Explicit relative path
        includeUrl = this.normalizePath(this.resolveRelativePath(baseDir, includePath));
      } else {
        // Relative to current file directory
        includeUrl = this.normalizePath(this.resolveRelativePath(baseDir, includePath));
      }

      // Load included file with enhanced error handling
      try {
        if (VERBOSE_INCLUDE_LOGS) console.log(`[IncludePreprocessor] Processing include: ${include.path} -> ${includeUrl}`);

        let includeSource: string;

        // Check if we're in a browser environment
        if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
          // Browser environment - use fetch with cache busting
          const cacheBuster = `?t=${Date.now()}`;
          const response = await fetch(includeUrl + cacheBuster);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          includeSource = await response.text();
        } else {
          // Node.js environment - read from filesystem
          const fs = await import('fs');
          const path = await import('path');

          // Convert web path to filesystem path
          let filePath = includeUrl;
          if (filePath.startsWith('/')) {
            // Remove leading slash and assume it's relative to public directory
            filePath = path.join(process.cwd(), 'public', filePath.substring(1));
          } else {
            // Assume it's relative to the current working directory
            filePath = path.join(process.cwd(), filePath);
          }

          try {
            includeSource = fs.readFileSync(filePath, 'utf8');
          } catch (error) {
            throw new Error(`Failed to read include file ${filePath}: ${error}`);
          }
        }

        if (VERBOSE_INCLUDE_LOGS) console.log(`[IncludePreprocessor] Loaded ${includeSource.length} chars from ${includeUrl}`);

        // Recursively process includes in the included file
        const childDefinedMacros = new Set(definedMacros); // Copy current macros
        includeSource = await this.preprocessIncludes(
          includeSource,
          includeUrl,
          processedFiles,
          childDefinedMacros,
          [...includeStack]
        );

        // Replace the include directive with the file contents
        const replacement = `// Included from: ${include.path} (${includeUrl})\n${includeSource}\n// End include: ${include.path}`;
        result = result.replace(include.directive, replacement);

      } catch (error) {
        console.error(`[IncludePreprocessor] Failed to load include ${includeUrl}:`, error);
        const errorComment = `// ERROR: Failed to load ${include.path} from ${includeUrl}\n// ${error.message}`;
        result = result.replace(include.directive, errorComment);
      }
    }

    includeStack.pop();
    return result;
  }

  /**
   * Extract conditional compilation blocks (#ifdef, #ifndef, #if)
   */
  private static extractConditionalBlocks(source: string, definedMacros: Set<string>): ConditionalBlock[] {
    const blocks: ConditionalBlock[] = [];
    const lines = source.split('\n');
    const stack: Array<{type: string, macro?: string, line: number, enabled: boolean}> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#ifdef ')) {
        const macro = line.split(' ')[1];
        const enabled = definedMacros.has(macro);
        stack.push({ type: 'ifdef', macro, line: i, enabled });
      } else if (line.startsWith('#ifndef ')) {
        const macro = line.split(' ')[1];
        const enabled = !definedMacros.has(macro);
        stack.push({ type: 'ifndef', macro, line: i, enabled });
      } else if (line.startsWith('#if ')) {
        // Complex #if conditions - for now, assume enabled
        stack.push({ type: 'if', line: i, enabled: true });
      } else if (line === '#else') {
        if (stack.length > 0) {
            stack[stack.length - 1].enabled = !stack[stack.length - 1].enabled;
        }
      } else if (line === '#endif') {
        if (stack.length > 0) {
          const block = stack.pop()!;
          blocks.push({
            type: block.type as 'ifdef' | 'ifndef' | 'if',
            macro: block.macro,
            start: block.line,
            end: i,
            enabled: block.enabled,
            definedMacros: new Set(definedMacros)
          });
        }
      }
    }

    return blocks;
  }

  /**
   * Get conditional context for an include directive
   */
  private static getConditionalContext(source: string, includeIndex: number, conditionalBlocks: ConditionalBlock[]): string | undefined {
    const includeLine = source.substring(0, includeIndex).split('\n').length - 1;

    for (const block of conditionalBlocks) {
      if (includeLine >= block.start && includeLine <= block.end) {
        return `${block.type} ${block.macro || 'complex'} (${block.enabled ? 'enabled' : 'disabled'})`;
      }
    }

    return undefined;
  }

  /**
   * Check if an #include directive is inside a disabled conditional block
   */
  private static isIncludeInDisabledBlock(source: string, includeIndex: number, definedMacros: Set<string>): boolean {
    // Walk backwards from the #include to find the nearest conditional directive
    const textBefore = source.substring(0, includeIndex);
    const lines = textBefore.split('\n');

    // Stack to track nested conditionals
    const stack: Array<{ directive: string; macro?: string; enabled: boolean }> = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Match #ifndef MACRO
      const ifndefMatch = trimmed.match(/^#ifndef\s+(\w+)/);
      if (ifndefMatch) {
        const macro = ifndefMatch[1];
        const enabled = !definedMacros.has(macro); // Enabled if macro is NOT defined
        stack.push({ directive: 'ifndef', macro, enabled });
        continue;
      }

      // Match #ifdef MACRO
      const ifdefMatch = trimmed.match(/^#ifdef\s+(\w+)/);
      if (ifdefMatch) {
        const macro = ifdefMatch[1];
        const enabled = definedMacros.has(macro); // Enabled if macro IS defined
        stack.push({ directive: 'ifdef', macro, enabled });
        continue;
      }

      // Match #else
      if (trimmed === '#else') {
        if (stack.length > 0) {
          const top = stack[stack.length - 1];
          // Invert the enabled state
          top.enabled = !top.enabled;
        }
        continue;
      }

      // Match #endif
      if (trimmed === '#endif') {
        stack.pop();
        continue;
      }
    }

    // If any conditional in the stack is disabled, the #include is in a disabled block
    return stack.some(cond => !cond.enabled);
  }

  /**
   * Resolve relative path from base directory
   */
  private static resolveRelativePath(baseDir: string, relativePath: string): string {
    // Split paths into segments
    const baseSegments = baseDir.split('/').filter(s => s);
    const relativeSegments = relativePath.split('/').filter(s => s);

    // Process .. and . in relative path
    for (const segment of relativeSegments) {
      if (segment === '..') {
        baseSegments.pop();
      } else if (segment !== '.') {
        baseSegments.push(segment);
      }
    }

    // Reconstruct URL
    return '/' + baseSegments.join('/');
  }
}