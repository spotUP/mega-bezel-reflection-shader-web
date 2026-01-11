/**
 * StageSplitter - Handles splitting shader source into vertex and fragment stages
 */

import { ShaderStage } from './SlangShaderCompiler';

export class StageSplitter {
  /**
   * Split shader into vertex and fragment stages
   */
  public static split(source: string): ShaderStage[] {
    const stages: ShaderStage[] = [];
    const lines = source.split('\n');

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
          stages.push({
            type: currentStage,
            source: currentSource.join('\n')
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

    // Save last stage
    if (currentStage && currentSource.length > 0) {
      stages.push({
        type: currentStage,
        source: currentSource.join('\n')
      });
    }

    return stages;
  }
}