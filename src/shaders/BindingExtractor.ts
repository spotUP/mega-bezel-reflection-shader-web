/**
 * BindingExtractor - Handles extraction of uniform bindings from Slang shaders
 */

import { SlangUniformBinding, UBOMember } from './SlangShaderCompiler';

export class BindingExtractor {
  /**
   * Extract Slang uniform bindings from shader source
   */
  public static extract(source: string): SlangUniformBinding[] {
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

            const memberMatch = memberLine.match(/^([\w]+)\s+([\w]+)\s*;/);
            if (memberMatch) {
              members.push({
                type: memberMatch[1],
                name: memberMatch[2]
              });
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
          const memberMatch = memberLine.match(/^([\w]+)\s+([\w]+)\s*;/);
          if (memberMatch) {
            members.push({
              type: memberMatch[1],
              name: memberMatch[2]
            });
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
}