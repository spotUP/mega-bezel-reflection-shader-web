/**
 * Example usage of SlangShaderCompiler
 *
 * Demonstrates how to compile Slang shaders to WebGL GLSL
 */

import { SlangShaderCompiler } from '../SlangShaderCompiler';
import * as THREE from 'three';

// Example 1: Compile a simple shader
function compileSimpleShader() {
  const slangSource = `
#version 450

#pragma parameter intensity "Effect Intensity" 0.5 0.0 1.0 0.1

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

layout(set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
};

void main()
{
   gl_Position = MVP * Position;
   vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;

layout(push_constant) uniform Push
{
   float intensity;
} params;

void main()
{
   vec3 color = texture(Source, vTexCoord).rgb;
   color *= params.intensity;
   FragColor = vec4(color, 1.0);
}
`;

  const compiled = SlangShaderCompiler.compile(slangSource, true);

  console.log('Compiled Shader:');
  console.log('================');
  console.log('\nVertex Shader:');
  console.log(compiled.vertex);
  console.log('\nFragment Shader:');
  console.log(compiled.fragment);
  console.log('\nParameters:', compiled.parameters);
  console.log('Uniforms:', compiled.uniforms);
  console.log('Samplers:', compiled.samplers);
}

// Example 2: Create Three.js ShaderMaterial from compiled shader
function createThreeJSMaterial() {
  const slangSource = `
#version 450

#pragma parameter scanlineIntensity "Scanline Intensity" 0.25 0.0 1.0 0.05
#pragma parameter scanlineCount "Scanline Count" 800.0 200.0 1200.0 100.0

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

layout(set = 0, binding = 0) uniform UBO {
   mat4 MVP;
   vec4 OutputSize;
};

void main() {
   gl_Position = MVP * Position;
   vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;

layout(push_constant) uniform Push {
   float scanlineIntensity;
   float scanlineCount;
} params;

void main() {
   vec3 color = texture(Source, vTexCoord).rgb;

   float scanline = sin(vTexCoord.y * params.scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
   scanline = mix(1.0, scanline, params.scanlineIntensity);
   color *= scanline;

   FragColor = vec4(color, 1.0);
}
`;

  // Compile to WebGL 2.0
  const compiled = SlangShaderCompiler.compile(slangSource, true);

  // Create Three.js uniforms from parameters
  const uniforms: Record<string, THREE.IUniform> = {
    Source: { value: null }, // Will be set to input texture
    MVP: { value: new THREE.Matrix4() },
    OutputSize: { value: new THREE.Vector2(800, 800) }
  };

  // Add parameter uniforms with default values
  compiled.parameters.forEach(param => {
    uniforms[param.name] = { value: param.default };
  });

  // Create ShaderMaterial
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: compiled.vertex,
    fragmentShader: compiled.fragment
  });

  console.log('Created Three.js ShaderMaterial:');
  console.log('Material:', material);
  console.log('Uniforms:', Object.keys(uniforms));

  return material;
}

// Example 3: Compile for WebGL 1.0
function compileForWebGL1() {
  const slangSource = `
#version 450

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;

void main() {
   vec3 color = texture(Source, vTexCoord).rgb;
   gl_FragColor = vec4(color, 1.0);
}
`;

  // Compile to WebGL 1.0
  const compiled = SlangShaderCompiler.compile(slangSource, false);

  console.log('WebGL 1.0 Fragment Shader:');
  console.log(compiled.fragment);

  // Should contain:
  // - No #version directive (or GLSL ES 1.0)
  // - precision mediump float
  // - varying instead of in
  // - texture2D instead of texture
  // - gl_FragColor (if present in source)
}

// Example 4: Extract and use shader parameters
function useShaderParameters() {
  const slangSource = `
#pragma parameter brightness "Brightness" 1.0 0.5 2.0 0.1
#pragma parameter contrast "Contrast" 1.0 0.5 2.0 0.1
#pragma parameter saturation "Saturation" 1.0 0.0 2.0 0.1

#pragma stage fragment
void main() {}
`;

  const compiled = SlangShaderCompiler.compile(slangSource);

  console.log('Shader Parameters:');
  compiled.parameters.forEach(param => {
    console.log(`  ${param.displayName}:`);
    console.log(`    Name: ${param.name}`);
    console.log(`    Range: ${param.min} - ${param.max} (step ${param.step})`);
    console.log(`    Default: ${param.default}`);
  });

  // Create UI controls from parameters
  const controls: Record<string, any> = {};
  compiled.parameters.forEach(param => {
    controls[param.name] = {
      label: param.displayName,
      value: param.default,
      min: param.min,
      max: param.max,
      step: param.step,
      onChange: (value: number) => {
        console.log(`${param.name} changed to ${value}`);
        // Update shader uniform here
      }
    };
  });

  console.log('\nGenerated UI Controls:', controls);
}

// Example 5: Load shader from URL and compile
async function loadAndCompileShader() {
  try {
    const compiled = await SlangShaderCompiler.loadFromURL(
      'shaders/scanlines.slang'
    );

    console.log('Loaded and compiled shader:');
    console.log('Parameters:', compiled.parameters.length);
    console.log('Uniforms:', compiled.uniforms.length);
    console.log('Samplers:', compiled.samplers.length);
  } catch (error) {
    console.error('Failed to load shader:', error);
  }
}

// Example 6: Multi-stage shader compilation pipeline
function buildShaderPipeline() {
  const shaderSources = [
    // Pass 1: Blur
    `
#pragma stage fragment
layout(set = 0, binding = 1) uniform sampler2D Source;
void main() {
  // Blur implementation
}
`,
    // Pass 2: Scanlines
    `
#pragma parameter intensity "Intensity" 0.25 0.0 1.0 0.05

#pragma stage fragment
layout(set = 0, binding = 1) uniform sampler2D Source;
layout(push_constant) uniform Push { float intensity; } params;
void main() {
  // Scanline implementation
}
`,
    // Pass 3: Output
    `
#pragma stage fragment
layout(set = 0, binding = 1) uniform sampler2D Source;
void main() {
  // Final output
}
`
  ];

  const compiledShaders = shaderSources.map((source, index) => {
    console.log(`\nCompiling shader pass ${index}...`);
    const compiled = SlangShaderCompiler.compile(source);
    console.log(`  Parameters: ${compiled.parameters.length}`);
    console.log(`  Uniforms: ${compiled.uniforms.length}`);
    console.log(`  Samplers: ${compiled.samplers.length}`);
    return compiled;
  });

  console.log(`\nTotal passes: ${compiledShaders.length}`);
  return compiledShaders;
}

// Example 7: Extract all uniform declarations for debugging
function debugUniformExtraction() {
  const slangSource = `
#version 450

#pragma stage vertex

layout(set = 0, binding = 0) uniform UBO {
   mat4 MVP;
   vec4 OutputSize;
   vec4 OriginalSize;
   vec4 SourceSize;
   uint FrameCount;
};

layout(set = 0, binding = 1) uniform sampler2D Source;
layout(set = 0, binding = 2) uniform sampler2D Original;

layout(push_constant) uniform Push {
   float param1;
   float param2;
} params;

void main() {}
`;

  const compiled = SlangShaderCompiler.compile(slangSource);

  console.log('Extracted Bindings:');
  console.log('===================');
  console.log('\nUBO Uniforms:', compiled.uniforms.filter(u =>
    ['MVP', 'OutputSize', 'OriginalSize', 'SourceSize', 'FrameCount'].includes(u)
  ));
  console.log('\nPush Constant Uniforms:', compiled.uniforms.filter(u =>
    ['param1', 'param2'].includes(u)
  ));
  console.log('\nSamplers:', compiled.samplers);

  console.log('\n\nConverted Vertex Shader:');
  console.log(compiled.vertex);
}

// Run examples
if (require.main === module) {
  console.log('=== Example 1: Simple Shader Compilation ===');
  compileSimpleShader();

  console.log('\n=== Example 2: Three.js Material Creation ===');
  createThreeJSMaterial();

  console.log('\n=== Example 3: WebGL 1.0 Compilation ===');
  compileForWebGL1();

  console.log('\n=== Example 4: Shader Parameters ===');
  useShaderParameters();

  console.log('\n=== Example 6: Multi-Pass Pipeline ===');
  buildShaderPipeline();

  console.log('\n=== Example 7: Debug Uniform Extraction ===');
  debugUniformExtraction();
}

export {
  compileSimpleShader,
  createThreeJSMaterial,
  compileForWebGL1,
  useShaderParameters,
  loadAndCompileShader,
  buildShaderPipeline,
  debugUniformExtraction
};
