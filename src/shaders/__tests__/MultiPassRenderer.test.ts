/**
 * Tests for MultiPassRenderer
 */

import * as THREE from 'three';
import { SlangPresetParser } from '../SlangPresetParser';
import { MultiPassRenderer } from '../MultiPassRenderer';

// Mock shader source
const mockShaderSource = `
#version 450

#pragma parameter intensity "Intensity" 0.5 0.0 1.0 0.1

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

layout(set = 0, binding = 0) uniform UBO { mat4 MVP; };

void main() {
  gl_Position = MVP * Position;
  vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;
layout(push_constant) uniform Push { float intensity; } params;

void main() {
  vec3 color = texture(Source, vTexCoord).rgb;
  FragColor = vec4(color * params.intensity, 1.0);
}
`;

describe('MultiPassRenderer', () => {
  let renderer: THREE.WebGLRenderer;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Create mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ canvas });
  });

  afterEach(() => {
    renderer.dispose();
  });

  describe('initialization', () => {
    it('should create renderer with single pass', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 1
shader0 = test.slang
filter_linear0 = false
scale_type0 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      expect(multipass.getPassCount()).toBe(1);

      multipass.dispose();
    });

    it('should create renderer with multiple passes', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 3

shader0 = pass1.slang
filter_linear0 = true
scale_type0 = source
scale0 = 1.0

shader1 = pass2.slang
filter_linear1 = true
scale_type1 = source
scale1 = 1.0

shader2 = pass3.slang
filter_linear2 = false
scale_type2 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      expect(multipass.getPassCount()).toBe(3);

      multipass.dispose();
    });
  });

  describe('render target creation', () => {
    it('should create render targets with correct scale', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 3

shader0 = scale2x.slang
scale_type0 = source
scale0 = 2.0

shader1 = scale1x.slang
scale_type1 = source
scale1 = 1.0

shader2 = output.slang
scale_type2 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 400,
        height: 400
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const pass0 = multipass.getPass(0);
      const pass1 = multipass.getPass(1);
      const pass2 = multipass.getPass(2);

      // Pass 0: 2x scale from 400x400 = 800x800
      expect(pass0?.renderTarget?.width).toBe(800);
      expect(pass0?.renderTarget?.height).toBe(800);

      // Pass 1: 1x scale from 800x800 = 800x800
      expect(pass1?.renderTarget?.width).toBe(800);
      expect(pass1?.renderTarget?.height).toBe(800);

      // Pass 2: Final pass, no render target
      expect(pass2?.renderTarget).toBeNull();

      multipass.dispose();
    });

    it('should apply filter settings to render targets', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = nearest.slang
filter_linear0 = false

shader1 = linear.slang
filter_linear1 = true
scale_type1 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const pass0 = multipass.getPass(0);

      expect(pass0?.renderTarget?.texture.minFilter).toBe(THREE.NearestFilter);
      expect(pass0?.renderTarget?.texture.magFilter).toBe(THREE.NearestFilter);

      multipass.dispose();
    });
  });

  describe('parameter management', () => {
    it('should set parameter values', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 1
shader0 = test.slang

parameters = "intensity"
intensity = 0.5
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      multipass.setParameter('intensity', 0.75);

      const value = multipass.getParameter('intensity');
      expect(value).toBe(0.75);

      multipass.dispose();
    });

    it('should get all parameters', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 1
shader0 = test.slang
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const params = multipass.getAllParameters();

      expect(params.has('intensity')).toBe(true);
      expect(params.get('intensity')).toBe(0.5); // Default from shader

      multipass.dispose();
    });

    it('should apply parameter overrides from preset', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 1
shader0 = test.slang

parameters = "intensity"
intensity = 0.8
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const value = multipass.getParameter('intensity');
      expect(value).toBe(0.8);

      multipass.dispose();
    });
  });

  describe('pass aliasing', () => {
    it('should find pass by alias', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = blur.slang
alias0 = "BloomPass"

shader1 = output.slang
scale_type1 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const bloomPass = multipass.getPassByAlias('BloomPass');
      expect(bloomPass).toBeDefined();
      expect(bloomPass?.alias).toBe('BloomPass');

      multipass.dispose();
    });
  });

  describe('rendering', () => {
    it('should render without errors', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 1
shader0 = test.slang
scale_type0 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      // Create mock input texture
      const inputTexture = new THREE.Texture();
      inputTexture.image = { width: 800, height: 800 };
      multipass.setInputTexture(inputTexture);

      // Should not throw
      expect(() => {
        multipass.render();
      }).not.toThrow();

      multipass.dispose();
    });
  });

  describe('resizing', () => {
    it('should resize render targets', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = pass1.slang
scale_type0 = source
scale0 = 1.0

shader1 = pass2.slang
scale_type1 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      const pass0Before = multipass.getPass(0);
      expect(pass0Before?.renderTarget?.width).toBe(800);
      expect(pass0Before?.renderTarget?.height).toBe(800);

      // Resize
      multipass.resize(1024, 1024);

      const pass0After = multipass.getPass(0);
      expect(pass0After?.renderTarget?.width).toBe(1024);
      expect(pass0After?.renderTarget?.height).toBe(1024);

      multipass.dispose();
    });
  });

  describe('disposal', () => {
    it('should dispose resources', async () => {
      const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = pass1.slang
shader1 = pass2.slang
scale_type1 = viewport
`);

      const multipass = new MultiPassRenderer(renderer, preset, {
        width: 800,
        height: 800
      });

      await multipass.loadShaders(async () => mockShaderSource);

      // Should not throw
      expect(() => {
        multipass.dispose();
      }).not.toThrow();
    });
  });
});
