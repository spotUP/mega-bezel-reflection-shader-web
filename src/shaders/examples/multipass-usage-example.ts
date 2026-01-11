/**
 * Example usage of MultiPassRenderer
 *
 * Demonstrates how to set up and use the multi-pass rendering pipeline
 */

import * as THREE from 'three';
import { SlangPresetParser } from '../SlangPresetParser';
import { MultiPassRenderer } from '../MultiPassRenderer';

// Example 1: Basic single-pass CRT setup
async function setupBasicCRT() {
  // Create Three.js renderer
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(800, 800);

  // Parse preset
  const presetContent = `
shaders = 1

shader0 = shaders/crt-scanlines.slang
filter_linear0 = false
scale_type0 = viewport
`;

  const preset = SlangPresetParser.parse(presetContent);

  // Create multi-pass renderer
  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 800,
    height: 800,
    webgl2: true
  });

  // Load shaders
  await multipass.loadShaders(async (path) => {
    const response = await fetch(path);
    return await response.text();
  });

  // Create input texture (your game content)
  const gameTexture = new THREE.TextureLoader().load('game-frame.png');
  multipass.setInputTexture(gameTexture);

  // Render loop
  function animate() {
    requestAnimationFrame(animate);

    // Render multi-pass pipeline (outputs to screen)
    multipass.render();
  }

  animate();

  console.log('Basic CRT setup complete');
  return multipass;
}

// Example 2: Multi-pass with bloom
async function setupBloomCRT() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas });

  // Parse multi-pass preset
  const presetContent = `
shaders = 3

# Pass 0: Horizontal blur for bloom
shader0 = shaders/blur-h.slang
filter_linear0 = true
scale_type0 = source
scale0 = 1.0
float_framebuffer0 = true

# Pass 1: Vertical blur for bloom
shader1 = shaders/blur-v.slang
filter_linear1 = true
scale_type1 = source
scale1 = 1.0
float_framebuffer1 = true
alias1 = "BloomPass"

# Pass 2: CRT with bloom composite
shader2 = shaders/crt-with-bloom.slang
filter_linear2 = false
scale_type2 = viewport

parameters = "bloomAmount;scanlineIntensity"
bloomAmount = 0.15
scanlineIntensity = 0.25
`;

  const preset = SlangPresetParser.parse(presetContent);

  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 800,
    height: 800,
    webgl2: true,
    historyDepth: 4 // For temporal effects
  });

  await multipass.loadShaders(async (path) => {
    const response = await fetch(path);
    return await response.text();
  });

  console.log('Multi-pass bloom CRT setup complete');
  console.log('Pass count:', multipass.getPassCount());

  return multipass;
}

// Example 3: Render to custom target
async function renderToTarget() {
  const renderer = new THREE.WebGLRenderer();
  const preset = SlangPresetParser.parse(`shaders = 1\nshader0 = test.slang`);

  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 1024,
    height: 1024
  });

  await multipass.loadShaders(async (path) => '/* shader source */');

  // Create custom output target
  const outputTarget = new THREE.WebGLRenderTarget(1920, 1080);

  // Create input texture
  const inputTexture = new THREE.Texture();
  multipass.setInputTexture(inputTexture);

  // Render to custom target
  multipass.render(outputTarget);

  // Use outputTarget.texture in your scene
  console.log('Rendered to custom target:', outputTarget.width, 'x', outputTarget.height);

  return outputTarget;
}

// Example 4: Parameter control
async function parameterControl() {
  const renderer = new THREE.WebGLRenderer();

  const presetContent = `
shaders = 1

shader0 = shaders/adjustable-crt.slang

parameters = "scanlineIntensity;curvature;brightness"
scanlineIntensity = 0.25
curvature = 0.05
brightness = 1.0
`;

  const preset = SlangPresetParser.parse(presetContent);
  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 800,
    height: 800
  });

  await multipass.loadShaders(async () => '/* shader */');

  // Get all parameters
  const params = multipass.getAllParameters();
  console.log('Available parameters:');
  params.forEach((value, name) => {
    console.log(`  ${name}: ${value}`);
  });

  // Adjust parameter at runtime
  multipass.setParameter('scanlineIntensity', 0.5);
  multipass.setParameter('curvature', 0.08);

  // Read parameter
  const intensity = multipass.getParameter('scanlineIntensity');
  console.log('Scanline intensity:', intensity);

  return multipass;
}

// Example 5: Integration with existing Three.js scene
class GameWithShaderEffects {
  private renderer: THREE.WebGLRenderer;
  private gameScene: THREE.Scene;
  private gameCamera: THREE.PerspectiveCamera;
  private gameRenderTarget: THREE.WebGLRenderTarget;
  private multipass: MultiPassRenderer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Setup Three.js renderer
    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setSize(800, 800);

    // Setup game scene
    this.gameScene = new THREE.Scene();
    this.gameCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

    // Create render target for game
    this.gameRenderTarget = new THREE.WebGLRenderTarget(800, 800);

    // Add some game objects
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.gameScene.add(cube);

    this.gameCamera.position.z = 5;
  }

  async loadCRTShader(presetPath: string) {
    // Load preset
    const response = await fetch(presetPath);
    const presetContent = await response.text();
    const preset = SlangPresetParser.parse(presetContent);

    // Create multi-pass renderer
    this.multipass = new MultiPassRenderer(this.renderer, preset, {
      width: 800,
      height: 800,
      webgl2: true
    });

    await this.multipass.loadShaders(async (path) => {
      const response = await fetch(path);
      return await response.text();
    });

    console.log('CRT shader loaded');
  }

  render() {
    // 1. Render game to render target
    this.renderer.setRenderTarget(this.gameRenderTarget);
    this.renderer.render(this.gameScene, this.gameCamera);
    this.renderer.setRenderTarget(null);

    // 2. Apply CRT shader pipeline to game output
    if (this.multipass) {
      this.multipass.setInputTexture(this.gameRenderTarget.texture);
      this.multipass.render(); // Renders to screen
    }
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    // Rotate cube
    this.gameScene.children[0].rotation.x += 0.01;
    this.gameScene.children[0].rotation.y += 0.01;

    this.render();
  };
}

// Example 6: Dynamic preset switching
class ShaderPresetManager {
  private renderer: THREE.WebGLRenderer;
  private currentMultipass: MultiPassRenderer | null = null;
  private inputTexture: THREE.Texture;

  constructor(renderer: THREE.WebGLRenderer, inputTexture: THREE.Texture) {
    this.renderer = renderer;
    this.inputTexture = inputTexture;
  }

  async loadPreset(presetPath: string) {
    // Dispose old multipass
    if (this.currentMultipass) {
      this.currentMultipass.dispose();
    }

    // Load new preset
    const response = await fetch(presetPath);
    const presetContent = await response.text();
    const preset = SlangPresetParser.parse(presetContent, presetPath);

    // Create new multipass renderer
    this.currentMultipass = new MultiPassRenderer(this.renderer, preset, {
      width: 800,
      height: 800,
      webgl2: true
    });

    // Load shaders
    await this.currentMultipass.loadShaders(async (path) => {
      const fullPath = presetPath.substring(0, presetPath.lastIndexOf('/') + 1) + path;
      const response = await fetch(fullPath);
      return await response.text();
    });

    this.currentMultipass.setInputTexture(this.inputTexture);

    console.log('Loaded preset:', presetPath);
    console.log('Passes:', this.currentMultipass.getPassCount());
  }

  render() {
    if (this.currentMultipass) {
      this.currentMultipass.render();
    }
  }

  dispose() {
    if (this.currentMultipass) {
      this.currentMultipass.dispose();
    }
  }
}

// Example 7: Responsive resizing
class ResponsiveMultiPass {
  private renderer: THREE.WebGLRenderer;
  private multipass: MultiPassRenderer;

  constructor(renderer: THREE.WebGLRenderer, multipass: MultiPassRenderer) {
    this.renderer = renderer;
    this.multipass = multipass;

    // Setup resize listener
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Resize renderer
    this.renderer.setSize(width, height);

    // Resize multipass pipeline
    this.multipass.resize(width, height);

    console.log('Resized to', width, 'x', height);
  };

  dispose() {
    window.removeEventListener('resize', this.handleResize);
  }
}

// Example 8: Performance monitoring
async function monitorPerformance() {
  const renderer = new THREE.WebGLRenderer();
  const preset = SlangPresetParser.parse(`shaders = 5\n/* ... */`);

  const multipass = new MultiPassRenderer(renderer, preset, {
    width: 1920,
    height: 1080,
    webgl2: true
  });

  await multipass.loadShaders(async () => '/* shader */');

  let frameCount = 0;
  let lastTime = performance.now();

  function measurePerformance() {
    const startTime = performance.now();

    // Render
    multipass.render();

    const renderTime = performance.now() - startTime;

    frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;

    if (deltaTime >= 1000) {
      const fps = Math.round((frameCount * 1000) / deltaTime);
      console.log(`FPS: ${fps}, Render time: ${renderTime.toFixed(2)}ms`);
      console.log(`Passes: ${multipass.getPassCount()}`);

      frameCount = 0;
      lastTime = currentTime;
    }

    requestAnimationFrame(measurePerformance);
  }

  measurePerformance();
}

// Export examples
export {
  setupBasicCRT,
  setupBloomCRT,
  renderToTarget,
  parameterControl,
  GameWithShaderEffects,
  ShaderPresetManager,
  ResponsiveMultiPass,
  monitorPerformance
};
