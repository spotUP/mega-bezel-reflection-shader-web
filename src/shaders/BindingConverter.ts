/**
 * BindingConverter - Handles conversion of Slang bindings to WebGL uniforms or UBO preservation
 */

import { SlangUniformBinding, UBOInfo } from './SlangShaderCompiler';

export interface BindingConversionResult {
  source: string;
  ubos?: UBOInfo[];
}

export class BindingConverter {
  /**
   * Convert Slang bindings to WebGL uniforms or preserve UBOs
   */
  public static convert(
    source: string,
    bindings: SlangUniformBinding[],
    webgl2: boolean,
    preserveUBOs: boolean = false
  ): BindingConversionResult {
    let output = source;
    const declaredUniforms = new Set<string>(); // Track which uniforms we've already declared
    const uboInfos: UBOInfo[] = []; // Collect UBO info when preserving UBOs

    // Parse existing uniform declarations from source (e.g., shader parameters)
    const existingUniformRegex = /^\s*uniform\s+\w+\s+(\w+)\s*;/gm;
    let match;
    while ((match = existingUniformRegex.exec(source)) !== null) {
      declaredUniforms.add(match[1]);
    }

    // console.log('[BindingConverter] Processing', bindings.length, 'bindings, preserveUBOs:', preserveUBOs);
    // console.log('[BindingConverter] Found', declaredUniforms.size, 'existing uniform declarations in source');

    for (const binding of bindings) {
      console.log('[BindingConverter] Processing binding:', binding.type, binding.name,
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
        if (preserveUBOs) {
          // Preserve UBO structure for WebGL 2.0 UBO binding
          console.log(`[BindingConverter] Preserving UBO ${binding.name} with ${binding.members.length} members`);

          // Collect UBO info for later use
          uboInfos.push({
            name: binding.name,
            binding: binding.binding,
            members: binding.members,
            instanceName: binding.instanceName
          });

          // Keep the UBO block in the source but update layout for WebGL 2.0
          // Convert Vulkan binding to WebGL 2.0 std140 layout
          const uboPattern = new RegExp(
            `layout\\s*\\([^)]*\\)\\s*uniform\\s+${binding.name}`,
            'g'
          );

          // Replace with std140 layout for WebGL 2.0 UBO
          output = output.replace(uboPattern, `layout(std140) uniform ${binding.name}`);

          // ALSO create individual uniforms for UBO members as fallback
          // This ensures the shader works even if UBO binding fails
          const uniformDecls = binding.members
            .filter(member => {
              if (declaredUniforms.has(member.name)) {
                console.log(`[BindingConverter] Skipping duplicate uniform: ${member.name} from UBO ${binding.name}`);
                return false;
              }
              declaredUniforms.add(member.name);
              return true;
            })
            .map(member => {
              // Convert int/uint uniforms to float to avoid comparison type errors
              let glslType = member.type;
              if (glslType === 'int' || glslType === 'uint') {
                console.log(`[BindingConverter] Converting ${member.name} from ${glslType} to float`);
                glslType = 'float';
              }
              return `uniform ${glslType} ${member.name};`;
            })
            .join('\n');

          if (uniformDecls) {
            // Inject individual uniforms after precision declarations
            const precisionEnd = output.search(/precision\s+\w+\s+\w+\s*;\s*\n/g);
            if (precisionEnd !== -1) {
              const afterPrecision = output.substring(precisionEnd).match(/precision\s+\w+\s+\w+\s*;\s*\n/);
              if (afterPrecision) {
                const insertPos = precisionEnd + afterPrecision[0].length;
                output = output.substring(0, insertPos) + '\n' + uniformDecls + '\n' + output.substring(insertPos);
                console.log(`[BindingConverter] Added ${uniformDecls.split('\n').length} individual uniforms as fallback for UBO ${binding.name}`);
              }
            }
          }
        } else {
          // Convert UBO to individual uniforms using actual member types
          // Deduplicate - only create uniforms for members not already declared
          // IMPORTANT: Convert ALL int/uint types to float to avoid GLSL type mismatches
          const uniformDecls = binding.members
            .filter(member => {
              if (declaredUniforms.has(member.name)) {
                console.log(`[BindingConverter] Skipping duplicate uniform: ${member.name} from UBO ${binding.name}`);
                return false;
              }
              declaredUniforms.add(member.name);
              return true;
            })
            .map(member => {
              // Convert int/uint uniforms to float to avoid comparison type errors
              let glslType = member.type;
              if (glslType === 'int' || glslType === 'uint') {
                console.log(`[BindingConverter] Converting ${member.name} from ${glslType} to float`);
                glslType = 'float';
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
            console.log(`[BindingConverter] UBO ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
            output = output.replace(uboPattern, uniformDecls);
          } else {
            // UBO not in source (e.g., defined before #pragma stage) - inject uniforms after precision declarations
            console.log(`[BindingConverter] UBO ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

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
        }
      } else if (binding.type === 'pushConstant' && binding.members) {
        // Convert push constants to individual uniforms using actual member types
        // Deduplicate - only create uniforms for members not already declared
        const uniformDecls = binding.members
          .filter(member => {
            if (declaredUniforms.has(member.name)) {
              console.log(`[BindingConverter] Skipping duplicate uniform: ${member.name} from push constant ${binding.name}`);
              return false;
            }
            declaredUniforms.add(member.name);
            return true;
          })
          .map(member => `uniform ${member.type} ${member.name};`)
          .join('\n');

        // Try to find and replace the push constant block in the source
        const pushPattern = new RegExp(
          `layout\\s*\\(push_constant\\)\\s*uniform\\s+${binding.name}\\s*[\\s\\S]*?\\}\\s*\\w*\\s*;`,
          'g'
        );

        const testMatch = output.match(pushPattern);
        if (testMatch) {
          // Push constant found in source - replace it
          console.log(`[BindingConverter] Push constant ${binding.name} found in source, replacing with ${uniformDecls.split('\n').length} uniforms`);
          output = output.replace(pushPattern, uniformDecls);
        } else {
          // Push constant not in source - inject uniforms after precision
          console.log(`[BindingConverter] Push constant ${binding.name} not in source, injecting ${uniformDecls.split('\n').length} uniforms after precision`);

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
        if (binding.instanceName) {
          binding.members.forEach(member => {
            // Use word boundaries to match whole words only
            const pattern = new RegExp(`\\b${binding.instanceName}\\.${member.name}\\b`, 'g');
            output = output.replace(pattern, member.name);
          });
        }
      }
    }

    // Also fix #define aliases that reference struct members after UBO conversion
    // Example: #define beamg global.g_CRT_bg -> #define beamg g_CRT_bg
    console.log(`[BindingConverter] Before #define replacement, checking for #define global. references...`);
    const defineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    console.log(`[BindingConverter] Found #define global. references:`, defineGlobalRefs ? defineGlobalRefs.slice(0, 10) : 'none');

    output = output.replace(/#define\s+(\w+)\s+(global|params)\.(\w+)/g, '#define $1 $3');

    console.log(`[BindingConverter] After #define replacement, checking for remaining #define global. references...`);
    const remainingDefineGlobalRefs = output.match(/#define\s+\w+\s+global\.\w+/g);
    console.log(`[BindingConverter] Remaining #define global. references:`, remainingDefineGlobalRefs ? remainingDefineGlobalRefs.slice(0, 10) : 'none');

    // If there's a push_constant named 'params', replace global. references with params.
    // This fixes shaders that include common files designed for UBO but use push_constant
    const hasParamsPushConstant = bindings.some(b => b.type === 'pushConstant' && b.instanceName === 'params');
    console.log(`[BindingConverter] Has params push_constant: ${hasParamsPushConstant}`);
    console.log(`[BindingConverter] Push constant bindings:`, bindings.filter(b => b.type === 'pushConstant').map(b => ({ type: b.type, name: b.name, instanceName: b.instanceName })));

    if (hasParamsPushConstant) {
      console.log(`[BindingConverter] Before global. replacement, checking for global. references...`);
      const globalRefs = output.match(/\bglobal\.\w+\b/g);
      console.log(`[BindingConverter] Found global. references:`, globalRefs ? globalRefs.slice(0, 10) : 'none');

      output = output.replace(/\bglobal\.(\w+)\b/g, 'params.$1');

      console.log(`[BindingConverter] After global. replacement, checking for remaining global. references...`);
      const remainingGlobalRefs = output.match(/\bglobal\.\w+\b/g);
      console.log(`[BindingConverter] Remaining global. references:`, remainingGlobalRefs ? remainingGlobalRefs.slice(0, 10) : 'none');
    }

    return { source: output, ubos: preserveUBOs ? uboInfos : undefined };
  }
}