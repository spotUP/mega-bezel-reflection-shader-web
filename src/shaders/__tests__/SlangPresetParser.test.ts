/**
 * Tests for SlangPresetParser
 */

import { SlangPresetParser } from '../SlangPresetParser';

describe('SlangPresetParser', () => {
  describe('parse - simple single-pass preset', () => {
    it('should parse a basic CRT preset', () => {
      const content = `
shaders = 1

shader0 = shaders/crt-lottes.slang
filter_linear0 = false
scale_type0 = viewport
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.passes).toHaveLength(1);
      expect(preset.passes[0]).toEqual({
        shader: 'shaders/crt-lottes.slang',
        filterLinear: false,
        scaleType: 'viewport'
      });
    });
  });

  describe('parse - multi-pass preset with scaling', () => {
    it('should parse a 3-pass preset with different scale types', () => {
      const content = `
shaders = 3

shader0 = shaders/scale-pass.slang
filter_linear0 = false
scale_type0 = source
scale0 = 2.0
alias0 = "SCALED"

shader1 = shaders/blur-pass.slang
filter_linear1 = true
scale_type1 = source
scale1 = 1.0

shader2 = shaders/final-pass.slang
filter_linear2 = true
scale_type2 = viewport
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.passes).toHaveLength(3);

      expect(preset.passes[0].scale).toBe(2.0);
      expect(preset.passes[0].scaleType).toBe('source');
      expect(preset.passes[0].alias).toBe('SCALED');

      expect(preset.passes[1].filterLinear).toBe(true);
      expect(preset.passes[2].scaleType).toBe('viewport');
    });
  });

  describe('parse - preset with textures', () => {
    it('should parse texture definitions', () => {
      const content = `
shaders = 1
shader0 = shaders/test.slang

textures = "lut1;bezel"

lut1 = textures/color-lut.png
lut1_linear = true
lut1_wrap_mode = clamp_to_edge
lut1_mipmap = false

bezel = textures/bezel-frame.png
bezel_linear = false
bezel_wrap_mode = repeat
bezel_mipmap = true
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.textures).toHaveLength(2);

      const lut = preset.textures.find(t => t.name === 'lut1');
      expect(lut).toBeDefined();
      expect(lut?.path).toBe('textures/color-lut.png');
      expect(lut?.linear).toBe(true);
      expect(lut?.wrapMode).toBe('clamp_to_edge');
      expect(lut?.mipmap).toBe(false);

      const bezel = preset.textures.find(t => t.name === 'bezel');
      expect(bezel).toBeDefined();
      expect(bezel?.linear).toBe(false);
      expect(bezel?.wrapMode).toBe('repeat');
      expect(bezel?.mipmap).toBe(true);
    });
  });

  describe('parse - preset with parameters', () => {
    it('should parse parameter overrides', () => {
      const content = `
shaders = 1
shader0 = shaders/test.slang

parameters = "hardScan;maskDark;bloomAmount"

hardScan = -8.0
maskDark = 0.5
bloomAmount = 0.25
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.parameters).toHaveLength(3);

      const hardScan = preset.parameters.find(p => p.name === 'hardScan');
      expect(hardScan?.value).toBe(-8.0);

      const maskDark = preset.parameters.find(p => p.name === 'maskDark');
      expect(maskDark?.value).toBe(0.5);
    });
  });

  describe('parse - preset with #reference', () => {
    it('should parse reference directive', () => {
      const content = `
#reference "base-presets/crt-base.slangp"

hardScan = -10.0
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.reference).toBe('base-presets/crt-base.slangp');
    });
  });

  describe('parse - preset with comments', () => {
    it('should ignore comments', () => {
      const content = `
// This is a comment
shaders = 1

shader0 = shaders/test.slang  // inline comment
filter_linear0 = false  # hash comment
scale_type0 = viewport
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.passes).toHaveLength(1);
      expect(preset.passes[0].shader).toBe('shaders/test.slang');
    });
  });

  describe('parse - complex framebuffer options', () => {
    it('should parse framebuffer format and options', () => {
      const content = `
shaders = 1

shader0 = shaders/hdr-pass.slang
filter_linear0 = true
scale_type0 = source
scale0 = 1.0
srgb_framebuffer0 = true
float_framebuffer0 = true
format0 = R16G16B16A16_SFLOAT
mipmap_input0 = true
`;

      const preset = SlangPresetParser.parse(content);

      expect(preset.passes[0].srgbFramebuffer).toBe(true);
      expect(preset.passes[0].floatFramebuffer).toBe(true);
      expect(preset.passes[0].format).toBe('R16G16B16A16_SFLOAT');
      expect(preset.passes[0].mipmapInput).toBe(true);
    });
  });

  describe('serialize', () => {
    it('should serialize preset back to .slangp format', () => {
      const content = `
shaders = 2

shader0 = shaders/pass1.slang
filter_linear0 = false
scale_type0 = source
scale0 = 2.0

shader1 = shaders/pass2.slang
filter_linear1 = true
scale_type1 = viewport

textures = "lut"

lut = textures/lut.png
lut_linear = true
lut_wrap_mode = clamp_to_edge
lut_mipmap = false
`;

      const preset = SlangPresetParser.parse(content);
      const serialized = SlangPresetParser.serialize(preset);

      // Re-parse to verify round-trip
      const reparsed = SlangPresetParser.parse(serialized);

      expect(reparsed.passes).toHaveLength(2);
      expect(reparsed.textures).toHaveLength(1);
      expect(reparsed.passes[0].scale).toBe(2.0);
      expect(reparsed.textures[0].linear).toBe(true);
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative paths', () => {
      const basePath = 'presets/crt/my-preset.slangp';

      const resolved1 = SlangPresetParser.resolvePath(basePath, 'shaders/crt.slang');
      expect(resolved1).toBe('presets/crt/shaders/crt.slang');

      const resolved2 = SlangPresetParser.resolvePath(basePath, '../common/stock.slang');
      expect(resolved2).toBe('presets/common/stock.slang');

      const resolved3 = SlangPresetParser.resolvePath(basePath, '../../stock.slang');
      expect(resolved3).toBe('stock.slang');
    });
  });
});
