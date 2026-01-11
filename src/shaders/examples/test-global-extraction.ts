/**
 * Test script to verify global definitions extraction
 */

import { SlangShaderCompiler } from '../SlangShaderCompiler';

// Simplified hsm-grade.slang excerpt with global definitions
const testShader = `
#version 450

// Global #define constants (should be extracted)
#define M_PI            3.1415926535897932384626433832795/180.0
#define RW              vec3(0.950457397565471, 1.0, 1.089436035930324)
#define signal          params.g_signal_type

// Global const declarations (should be extracted)
const float GAMMA_INPUT = 2.4;
const vec3 WHITE_POINT = vec3(1.0, 1.0, 1.0);

// Global function definitions (should be extracted)
vec3 RGB_to_XYZ(vec3 RGB, mat3 primaries) {
    return RGB * primaries;
}

float moncurve_f(float color, float gamma, float offs) {
    color = clamp(color, 0.0, 1.0);
    float fs = ((gamma - 1.0) / offs) * pow(offs * gamma / ((gamma - 1.0) * (1.0 + offs)), gamma);
    float xb = offs / (gamma - 1.0);
    color = (color > xb) ? pow((color + offs) / (1.0 + offs), gamma) : color * fs;
    return color;
}

vec3 moncurve_f_f3(vec3 color, float gamma, float offs) {
    color.r = moncurve_f(color.r, gamma, offs);
    color.g = moncurve_f(color.g, gamma, offs);
    color.b = moncurve_f(color.b, gamma, offs);
    return color.rgb;
}

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main()
{
    gl_Position = Position;
    vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D Source;

layout(push_constant) uniform Push
{
    float g_signal_type;
} params;

void main()
{
    vec3 color = texture(Source, vTexCoord).rgb;

    // Use global function
    vec3 gammaColor = moncurve_f_f3(color, GAMMA_INPUT, 0.055);

    // Use global constant
    vec3 whiteBalance = gammaColor * WHITE_POINT;

    // Use global define
    vec3 adjusted = whiteBalance * RW;

    FragColor = vec4(adjusted, 1.0);
}
`;

console.log('='.repeat(80));
console.log('Testing Global Definitions Extraction');
console.log('='.repeat(80));
console.log('');

try {
  const compiled = SlangShaderCompiler.compile(testShader, true);

  console.log('Compilation successful!');
  console.log('');
  console.log('Parameters:', compiled.parameters.length);
  console.log('Uniforms:', compiled.uniforms);
  console.log('Samplers:', compiled.samplers);
  console.log('');

  console.log('-'.repeat(80));
  console.log('VERTEX SHADER (first 1500 chars):');
  console.log('-'.repeat(80));
  console.log(compiled.vertex.substring(0, 1500));
  console.log('...');
  console.log('');

  console.log('-'.repeat(80));
  console.log('FRAGMENT SHADER (first 2000 chars):');
  console.log('-'.repeat(80));
  console.log(compiled.fragment.substring(0, 2000));
  console.log('...');
  console.log('');

  // Verify global definitions are present
  const checks = [
    { name: '#define M_PI', present: compiled.fragment.includes('#define M_PI') },
    { name: '#define RW', present: compiled.fragment.includes('#define RW') },
    { name: 'const float GAMMA_INPUT', present: compiled.fragment.includes('const float GAMMA_INPUT') },
    { name: 'vec3 RGB_to_XYZ', present: compiled.fragment.includes('vec3 RGB_to_XYZ') },
    { name: 'float moncurve_f', present: compiled.fragment.includes('float moncurve_f') },
    { name: 'vec3 moncurve_f_f3', present: compiled.fragment.includes('vec3 moncurve_f_f3') }
  ];

  console.log('-'.repeat(80));
  console.log('VERIFICATION CHECKS:');
  console.log('-'.repeat(80));
  checks.forEach(check => {
    const status = check.present ? '✓ PASS' : '✗ FAIL';
    console.log(`${status}: ${check.name}`);
  });
  console.log('');

  const allPassed = checks.every(c => c.present);
  if (allPassed) {
    console.log('✓ All checks passed! Global definitions are correctly injected.');
  } else {
    console.log('✗ Some checks failed. Global definitions may be missing.');
  }

} catch (error) {
  console.error('Compilation failed:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

console.log('');
console.log('='.repeat(80));
