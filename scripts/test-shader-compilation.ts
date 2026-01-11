import { MegaBezelCompiler } from '../src/shaders/MegaBezelCompiler';

async function testShaderCompilation() {
  console.log('Testing shader compilation...');
  const compiler = new MegaBezelCompiler();
  const presetPath = '/shaders/mega-bezel/test-remove-last.slangp';

  try {
    const preset = await compiler.compilePreset(presetPath, {
      webgl2: true,
      maxPasses: 40 // Check full chain
    });

    console.log('✅ Compilation successful!');
    console.log('Preset:', preset.name);
    console.log('Passes:', preset.passes.length);
    console.log('Parameters:', Object.keys(preset.parameters).length);

  } catch (error) {
    console.error('❌ Compilation failed:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

testShaderCompilation().catch(console.error);