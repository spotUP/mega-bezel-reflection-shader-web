/**
 * Simple test/demo for SemanticMapper functionality
 */

import { SemanticMapper } from './SemanticMapper';

// Simple test function to verify semantic mapping works
function testSemanticMapper() {
  console.log('🧪 Testing SemanticMapper functionality...');

  const mapper = new SemanticMapper();

  // Test parameter mapping
  const parameters = {
    'HSM_FAKE_SCANLINE_OPACITY': 30,
    'HSM_SCREEN_POSITION_X': 10,
    'HSM_NON_INTEGER_SCALE': 0.8,
    'g_sat': 0.2,
    'g_cntrst': 0.2,
    'UNKNOWN_PARAM': 42
  };

  const availableUniforms = [
    'scanline_opacity',
    'screen_pos_x',
    'scale_factor',
    'saturation',
    'contrast',
    'unmapped_param'
  ];

  console.log('📊 Testing parameter mapping...');
  const result = mapper.mapParameters(parameters, availableUniforms);

  console.log(`✅ Mapped ${result.mappedParameters.size} parameters`);
  console.log(`⚠️  Unmapped ${result.unmappedParameters.length} parameters:`, result.unmappedParameters);

  // Check specific mappings
  const scanlineMapping = result.mappedParameters.get('HSM_FAKE_SCANLINE_OPACITY');
  if (scanlineMapping) {
    console.log(`✅ HSM_FAKE_SCANLINE_OPACITY -> ${scanlineMapping.uniformName} = ${scanlineMapping.value}`);
  }

  const saturationMapping = result.mappedParameters.get('g_sat');
  if (saturationMapping) {
    console.log(`✅ g_sat -> ${saturationMapping.uniformName} = ${saturationMapping.value}`);
  }

  // Test texture mapping
  console.log('🖼️  Testing texture mapping...');
  const textureUniforms = [
    'Source',
    'Original',
    'OriginalHistory0',
    'OriginalHistory1',
    'LUTTexture'
  ];

  // Create mock texture objects
  const textureObjects = {
    'Original': { /* mock texture */ },
    'Source': { /* mock texture */ },
    'OriginalHistory0': { /* mock texture */ }
  };

  const textureResult = mapper.mapTextures(textureObjects, textureUniforms);

  console.log(`✅ Mapped ${textureResult.mappedTextures.size} textures`);
  console.log(`⚠️  Unmapped ${textureResult.unmappedTextures.length} textures:`, textureResult.unmappedTextures);

  // Check texture mappings
  textureResult.mappedTextures.forEach((mapping, textureName) => {
    console.log(`✅ ${textureName} -> ${mapping.uniformName} (unit ${mapping.textureUnit})`);
  });

  console.log('🎉 SemanticMapper test completed successfully!');
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  testSemanticMapper();
} else {
  // Browser environment - expose for manual testing
  (window as any).testSemanticMapper = testSemanticMapper;
}