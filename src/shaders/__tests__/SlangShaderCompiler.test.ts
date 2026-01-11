/**
 * Tests for SlangShaderCompiler
 */

import { SlangShaderCompiler } from '../SlangShaderCompiler';

describe('SlangShaderCompiler', () => {
  describe('extractPragmas', () => {
    it('should extract shader parameters', () => {
      const source = `
#version 450

#pragma parameter scanlineIntensity "Scanline Intensity" 0.25 0.0 1.0 0.05
#pragma parameter bloom "Bloom Amount" 0.15 0.0 1.0 0.01

void main() {}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.parameters).toHaveLength(2);

      const scanline = compiled.parameters.find(p => p.name === 'scanlineIntensity');
      expect(scanline).toBeDefined();
      expect(scanline?.displayName).toBe('Scanline Intensity');
      expect(scanline?.default).toBe(0.25);
      expect(scanline?.min).toBe(0.0);
      expect(scanline?.max).toBe(1.0);
      expect(scanline?.step).toBe(0.05);
    });

    it('should extract shader name and format', () => {
      const source = `
#version 450

#pragma name TestShader
#pragma format R16G16B16A16_SFLOAT

#pragma stage fragment
void main() {}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.name).toBe('TestShader');
      expect(compiled.format).toBe('R16G16B16A16_SFLOAT');
    });
  });

  describe('splitStages', () => {
    it('should separate vertex and fragment stages', () => {
      const source = `
#version 450

#pragma stage vertex
layout(location = 0) in vec4 Position;
void main() {
  gl_Position = Position;
}

#pragma stage fragment
layout(location = 0) out vec4 FragColor;
void main() {
  FragColor = vec4(1.0);
}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.vertex).toContain('gl_Position');
      expect(compiled.fragment).toContain('FragColor');
    });
  });

  describe('extractBindings', () => {
    it('should extract sampler bindings', () => {
      const source = `
#version 450

#pragma stage fragment

layout(set = 0, binding = 1) uniform sampler2D Source;
layout(set = 0, binding = 2) uniform sampler2D Original;

void main() {}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.samplers).toContain('Source');
      expect(compiled.samplers).toContain('Original');
    });

    it('should extract UBO members', () => {
      const source = `
#version 450

#pragma stage vertex

layout(set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
   vec4 OutputSize;
   vec4 SourceSize;
};

void main() {}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.uniforms).toContain('MVP');
      expect(compiled.uniforms).toContain('OutputSize');
      expect(compiled.uniforms).toContain('SourceSize');
    });

    it('should extract push constant members', () => {
      const source = `
#version 450

#pragma stage fragment

layout(push_constant) uniform Push
{
   float scanlineIntensity;
   float bloom;
} params;

void main() {
  float intensity = params.scanlineIntensity;
}
`;

      const compiled = SlangShaderCompiler.compile(source);

      expect(compiled.uniforms).toContain('scanlineIntensity');
      expect(compiled.uniforms).toContain('bloom');

      // Should replace params.member with just member
      expect(compiled.fragment).toContain('scanlineIntensity');
      expect(compiled.fragment).not.toContain('params.scanlineIntensity');
    });
  });

  describe('convertToWebGL - WebGL 2.0', () => {
    it('should convert to WebGL 2.0 GLSL', () => {
      const source = `
#version 450

#pragma stage fragment

layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;

void main() {
  vec3 color = texture(Source, vTexCoord).rgb;
  FragColor = vec4(color, 1.0);
}
`;

      const compiled = SlangShaderCompiler.compile(source, true);

      expect(compiled.fragment).toContain('#version 300 es');
      expect(compiled.fragment).toContain('precision highp float');
      expect(compiled.fragment).toContain('uniform sampler2D Source');
      expect(compiled.fragment).toContain('in vec2 vTexCoord');
      expect(compiled.fragment).toContain('out vec4 FragColor');
    });
  });

  describe('convertToWebGL - WebGL 1.0', () => {
    it('should convert to WebGL 1.0 GLSL', () => {
      const source = `
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

      const compiled = SlangShaderCompiler.compile(source, false);

      expect(compiled.fragment).not.toContain('#version');
      expect(compiled.fragment).toContain('precision mediump float');
      expect(compiled.fragment).toContain('uniform sampler2D Source');
      expect(compiled.fragment).toContain('varying vec2 vTexCoord');

      // Should convert texture() to texture2D()
      expect(compiled.fragment).toContain('texture2D');
      expect(compiled.fragment).not.toContain('texture(');
    });
  });

  describe('complete shader compilation', () => {
    it('should compile a full scanline shader', () => {
      const source = `
#version 450

#pragma parameter scanlineIntensity "Scanline Intensity" 0.25 0.0 1.0 0.05

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
   float scanlineIntensity;
} params;

void main()
{
   vec3 color = texture(Source, vTexCoord).rgb;
   float scanline = sin(vTexCoord.y * 800.0 * 3.14159) * 0.5 + 0.5;
   color *= mix(1.0, scanline, params.scanlineIntensity);
   FragColor = vec4(color, 1.0);
}
`;

      const compiled = SlangShaderCompiler.compile(source, true);

      // Check vertex shader
      expect(compiled.vertex).toContain('#version 300 es');
      expect(compiled.vertex).toContain('uniform mat4 MVP');
      expect(compiled.vertex).toContain('in vec4 Position');
      expect(compiled.vertex).toContain('out vec2 vTexCoord');

      // Check fragment shader
      expect(compiled.fragment).toContain('#version 300 es');
      expect(compiled.fragment).toContain('uniform sampler2D Source');
      expect(compiled.fragment).toContain('uniform float scanlineIntensity');
      expect(compiled.fragment).toContain('in vec2 vTexCoord');
      expect(compiled.fragment).toContain('out vec4 FragColor');

      // Check parameters
      expect(compiled.parameters).toHaveLength(1);
      expect(compiled.parameters[0].name).toBe('scanlineIntensity');

      // Check uniforms and samplers
      expect(compiled.uniforms).toContain('MVP');
      expect(compiled.uniforms).toContain('scanlineIntensity');
      expect(compiled.samplers).toContain('Source');
    });
  });
});
