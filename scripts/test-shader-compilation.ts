import { MegaBezelCompiler } from '../src/shaders/MegaBezelCompiler';

async function testShaderCompilation() {
  console.log('Testing shader compilation...');

  try {
    const compiler = new MegaBezelCompiler();
    const preset = await compiler.compilePreset('/shaders/mega-bezel/test-remove-last.slangp', {
      webgl2: true,
      debug: true,
      maxPasses: 16
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