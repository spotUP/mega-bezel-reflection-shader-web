/**
 * PragmaExtractor - Handles extraction of #pragma directives from Slang shaders
 */

import { ShaderParameter } from './SlangShaderCompiler';

export interface PragmaResult {
  parameters: ShaderParameter[];
  name?: string;
  format?: string;
}

export class PragmaExtractor {
  /**
   * Extract #pragma directives from shader source
   */
  public static extract(source: string): PragmaResult {
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
}