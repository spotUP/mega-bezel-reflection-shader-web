/**
 * Test for global definitions extraction in SlangShaderCompiler
 */

import { SlangShaderCompiler } from '../SlangShaderCompiler';

describe('SlangShaderCompiler - Global Definitions Extraction', () => {
  it('should extract #define constants before first #pragma stage', () => {
    const source = `
#version 450

#define M_PI 3.1415926535897932384626433832795/180.0
#define RW vec3(0.950457397565471, 1.0, 1.089436035930324)
#define signal params.g_signal_type

#pragma stage vertex
layout(location = 0) in vec4 Position;
void main() {
  gl_Position = Position;
}

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  FragColor = vec4(RW * M_PI, 1.0);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Both vertex and fragment shaders should contain the #define macros
    expect(compiled.vertex).toContain('#define M_PI');
    expect(compiled.vertex).toContain('#define RW');
    expect(compiled.fragment).toContain('#define M_PI');
    expect(compiled.fragment).toContain('#define RW');
  });

  it('should extract const declarations before first #pragma stage', () => {
    const source = `
#version 450

const float GAMMA_INPUT = 2.4;
const vec3 WHITE_POINT = vec3(1.0, 1.0, 1.0);

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  FragColor = vec4(WHITE_POINT, GAMMA_INPUT);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Fragment shader should contain the const declarations
    expect(compiled.fragment).toContain('const float GAMMA_INPUT = 2.4;');
    expect(compiled.fragment).toContain('const vec3 WHITE_POINT');
  });

  it('should extract function definitions before first #pragma stage', () => {
    const source = `
#version 450

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

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  vec3 color = RGB_to_XYZ(vec3(1.0), mat3(1.0));
  float gamma = moncurve_f(0.5, 2.2, 0.055);
  FragColor = vec4(color, gamma);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Fragment shader should contain the function definitions
    expect(compiled.fragment).toContain('vec3 RGB_to_XYZ');
    expect(compiled.fragment).toContain('float moncurve_f');
  });

  it('should extract all types of global definitions together', () => {
    const source = `
#version 450

// Global defines
#define RW vec3(0.950428545, 1.000000000, 1.089057751)
#define M_PI 3.14159

// Global consts
const float GAMMA = 2.4;

// Global functions
vec3 wp_temp(vec3 color) {
  return color * RW;
}

#pragma stage vertex
layout(location = 0) in vec4 Position;
void main() {
  gl_Position = Position;
}

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  vec3 color = wp_temp(vec3(1.0));
  FragColor = vec4(color * M_PI, GAMMA);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Both shaders should have all global definitions
    expect(compiled.vertex).toContain('#define RW');
    expect(compiled.vertex).toContain('#define M_PI');
    expect(compiled.vertex).toContain('const float GAMMA');
    expect(compiled.vertex).toContain('vec3 wp_temp');

    expect(compiled.fragment).toContain('#define RW');
    expect(compiled.fragment).toContain('#define M_PI');
    expect(compiled.fragment).toContain('const float GAMMA');
    expect(compiled.fragment).toContain('vec3 wp_temp');
  });

  it('should skip UBO member #defines', () => {
    const source = `
#version 450

#define RW vec3(0.95, 1.0, 1.09)
#define MVP global.MVP
#define SourceSize params.OriginalSize

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  FragColor = vec4(RW, 1.0);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Should include RW but skip UBO member defines
    expect(compiled.fragment).toContain('#define RW');
    expect(compiled.fragment).not.toContain('#define MVP global.MVP');
    expect(compiled.fragment).not.toContain('#define SourceSize params.OriginalSize');
  });

  it('should handle complex multi-line function definitions', () => {
    const source = `
#version 450

mat3 RGB_to_XYZ_mat(mat3 primaries) {
    vec3 RW = vec3(0.95, 1.0, 1.09);
    vec3 T = RW * inverse(primaries);

    mat3 TB = mat3(
        T.x, 0.0, 0.0,
        0.0, T.y, 0.0,
        0.0, 0.0, T.z
    );

    return TB * primaries;
}

vec3 XYZ_to_RGB(vec3 XYZ, mat3 primaries) {
    return XYZ * inverse(RGB_to_XYZ_mat(primaries));
}

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  mat3 prims = mat3(1.0);
  vec3 result = XYZ_to_RGB(vec3(1.0), prims);
  FragColor = vec4(result, 1.0);
}
`;

    const compiled = SlangShaderCompiler.compile(source);

    // Fragment shader should contain both function definitions
    expect(compiled.fragment).toContain('mat3 RGB_to_XYZ_mat');
    expect(compiled.fragment).toContain('vec3 XYZ_to_RGB');
    expect(compiled.fragment).toContain('return TB * primaries');
  });
});
