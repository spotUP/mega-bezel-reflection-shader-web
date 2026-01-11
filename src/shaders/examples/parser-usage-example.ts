/**
 * Example usage of SlangPresetParser
 *
 * Demonstrates how to parse .slangp preset files and inspect their contents
 */

import { SlangPresetParser } from '../SlangPresetParser';

// Example 1: Parse from string
function parseSimplePreset() {
  const presetContent = `
shaders = 1

shader0 = shaders/crt-lottes.slang
filter_linear0 = false
scale_type0 = viewport
`;

  const preset = SlangPresetParser.parse(presetContent);

  console.log('Preset parsed:', {
    passCount: preset.passes.length,
    firstPass: preset.passes[0]
  });

  // Output:
  // {
  //   passCount: 1,
  //   firstPass: {
  //     shader: 'shaders/crt-lottes.slang',
  //     filterLinear: false,
  //     scaleType: 'viewport'
  //   }
  // }
}

// Example 2: Parse multi-pass preset
function parseMultiPassPreset() {
  const presetContent = `
shaders = 3

shader0 = shaders/scale.slang
filter_linear0 = false
scale_type0 = source
scale0 = 2.0
alias0 = "SCALED"

shader1 = shaders/blur.slang
filter_linear1 = true
scale_type1 = source
scale1 = 1.0

shader2 = shaders/output.slang
filter_linear2 = true
scale_type2 = viewport
`;

  const preset = SlangPresetParser.parse(presetContent);

  preset.passes.forEach((pass, index) => {
    console.log(`Pass ${index}:`, {
      shader: pass.shader,
      scale: pass.scale,
      scaleType: pass.scaleType,
      alias: pass.alias
    });
  });

  // Output:
  // Pass 0: { shader: 'shaders/scale.slang', scale: 2, scaleType: 'source', alias: 'SCALED' }
  // Pass 1: { shader: 'shaders/blur.slang', scale: 1, scaleType: 'source', alias: undefined }
  // Pass 2: { shader: 'shaders/output.slang', scale: undefined, scaleType: 'viewport', alias: undefined }
}

// Example 3: Parse preset with textures
function parsePresetWithTextures() {
  const presetContent = `
shaders = 1
shader0 = shaders/bezel.slang

textures = "BezelFrame;ColorLUT"

BezelFrame = textures/bezel.png
BezelFrame_linear = true
BezelFrame_wrap_mode = clamp_to_edge

ColorLUT = textures/lut.png
ColorLUT_linear = true
ColorLUT_mipmap = true
`;

  const preset = SlangPresetParser.parse(presetContent);

  console.log('Textures:', preset.textures);

  // Output:
  // [
  //   {
  //     name: 'BezelFrame',
  //     path: 'textures/bezel.png',
  //     linear: true,
  //     wrapMode: 'clamp_to_edge',
  //     mipmap: false
  //   },
  //   {
  //     name: 'ColorLUT',
  //     path: 'textures/lut.png',
  //     linear: true,
  //     wrapMode: 'clamp_to_edge',
  //     mipmap: true
  //   }
  // ]
}

// Example 4: Load from URL
async function loadPresetFromURL() {
  try {
    const preset = await SlangPresetParser.loadFromURL(
      'https://example.com/presets/crt.slangp'
    );

    console.log('Loaded preset:', {
      passes: preset.passes.length,
      textures: preset.textures.length,
      parameters: preset.parameters.length
    });
  } catch (error) {
    console.error('Failed to load preset:', error);
  }
}

// Example 5: Serialize preset back to .slangp format
function serializePreset() {
  const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = shaders/pass1.slang
filter_linear0 = false
scale_type0 = source
scale0 = 2.0

shader1 = shaders/pass2.slang
filter_linear1 = true
scale_type1 = viewport
`);

  const serialized = SlangPresetParser.serialize(preset);
  console.log('Serialized preset:\n', serialized);

  // Output:
  // shaders = 2
  //
  // shader0 = "shaders/pass1.slang"
  // filter_linear0 = false
  // scale_type0 = source
  // scale0 = 2
  //
  // shader1 = "shaders/pass2.slang"
  // filter_linear1 = true
  // scale_type1 = viewport
}

// Example 6: Resolve relative paths
function resolveShaderPaths() {
  const presetPath = 'presets/crt/my-preset.slangp';

  const presetContent = `
shaders = 2

shader0 = shaders/pass1.slang
shader1 = ../../common/stock.slang
`;

  const preset = SlangPresetParser.parse(presetContent, presetPath);

  preset.passes.forEach((pass, index) => {
    const resolvedPath = SlangPresetParser.resolvePath(
      preset.basePath || '',
      pass.shader
    );
    console.log(`Pass ${index}: ${pass.shader} → ${resolvedPath}`);
  });

  // Output:
  // Pass 0: shaders/pass1.slang → presets/crt/shaders/pass1.slang
  // Pass 1: ../../common/stock.slang → common/stock.slang
}

// Example 7: Extract all shader files for loading
function extractShaderFilePaths() {
  const preset = SlangPresetParser.parse(`
shaders = 3
shader0 = shaders/a.slang
shader1 = shaders/b.slang
shader2 = shaders/c.slang
`);

  const shaderPaths = preset.passes.map(pass => pass.shader);
  console.log('Shader files to load:', shaderPaths);

  // Output:
  // ['shaders/a.slang', 'shaders/b.slang', 'shaders/c.slang']
}

// Example 8: Build shader pipeline with Three.js (pseudo-code)
function buildThreeJSPipeline() {
  const preset = SlangPresetParser.parse(`
shaders = 2

shader0 = shaders/blur.slang
filter_linear0 = true
scale_type0 = source
scale0 = 1.0

shader1 = shaders/output.slang
filter_linear1 = false
scale_type1 = viewport
`);

  preset.passes.forEach((pass, index) => {
    console.log(`Creating Three.js pass ${index}:`, {
      shader: pass.shader,
      // Create THREE.ShaderMaterial with compiled shader
      // Create THREE.WebGLRenderTarget based on scale settings
      // Configure texture filtering based on filterLinear
      filterMode: pass.filterLinear ? 'LINEAR' : 'NEAREST',
      scaleMode: pass.scaleType,
      scaleFactor: pass.scale
    });
  });
}

// Run examples
if (require.main === module) {
  console.log('=== Example 1: Simple Preset ===');
  parseSimplePreset();

  console.log('\n=== Example 2: Multi-Pass Preset ===');
  parseMultiPassPreset();

  console.log('\n=== Example 3: Textures ===');
  parsePresetWithTextures();

  console.log('\n=== Example 5: Serialize ===');
  serializePreset();

  console.log('\n=== Example 6: Resolve Paths ===');
  resolveShaderPaths();

  console.log('\n=== Example 7: Extract Shader Paths ===');
  extractShaderFilePaths();

  console.log('\n=== Example 8: Three.js Pipeline ===');
  buildThreeJSPipeline();
}

export {
  parseSimplePreset,
  parseMultiPassPreset,
  parsePresetWithTextures,
  loadPresetFromURL,
  serializePreset,
  resolveShaderPaths,
  extractShaderFilePaths,
  buildThreeJSPipeline
};
