import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MegaBezelPresetLoader } from '../shaders/MegaBezelPresetLoader';

/**
 * Shader Test Page
 * Tests the 18-pass CRT Guest Only shader
 */
export default function ShaderTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [passInfo, setPassInfo] = useState<string[]>([]);
  const loaderRef = useRef<MegaBezelPresetLoader | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const inputTextureRef = useRef<THREE.Texture | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = 800;
    const height = 600;

    // Initialize Three.js renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    rendererRef.current = renderer;

    // Create a simple test scene with colored quad as input
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    sceneRef.current = scene;
    cameraRef.current = camera;

    // Create test input texture (colorful gradient)
    const canvas2d = document.createElement('canvas');
    canvas2d.width = 256;
    canvas2d.height = 240;
    const ctx = canvas2d.getContext('2d')!;

    // Draw a colorful test pattern
    const gradient = ctx.createLinearGradient(0, 0, 256, 240);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.25, '#00ff00');
    gradient.addColorStop(0.5, '#0000ff');
    gradient.addColorStop(0.75, '#ffff00');
    gradient.addColorStop(1, '#ff00ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 240);

    // Add some test grid lines
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    for (let i = 0; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 240);
      ctx.stroke();
    }
    for (let i = 0; i < 240; i += 30) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }

    const inputTexture = new THREE.CanvasTexture(canvas2d);
    inputTexture.minFilter = THREE.LinearFilter;
    inputTexture.magFilter = THREE.LinearFilter;
    inputTextureRef.current = inputTexture;

    // Initialize Mega Bezel loader
    const loader = new MegaBezelPresetLoader(renderer, {
      webgl2: true,
      debug: true,
      maxPasses: 25, // Increase to allow all passes
      viewportWidth: width,
      viewportHeight: height
    });
    loaderRef.current = loader;

    // Load the 18-pass shader
    setStatus('Loading 18-pass CRT Guest shader...');

    loader.loadPreset('/shaders/mega-bezel/test-remove-last.slangp') // Use full standard preset (fixed paths)
      .then(result => {
        console.log('[ShaderTest] Preset load result:', result);
        if (result.success && result.preset) {
          setStatus(`✅ Shader loaded successfully! ${result.preset.passes.length} passes`);
          setPassInfo(result.preset.passes.map((pass, i) =>
            `Pass ${i}: ${pass.name} (${pass.alias || 'no alias'})`
          ));

          // Start render loop
          let frameCount = 0;
          const animate = () => {
            frameCount++;

            try {
              loader.render(inputTexture);

              // Update status every 60 frames
              if (frameCount % 60 === 0) {
                setStatus(`✅ Rendering... Frame ${frameCount}`);
              }
            } catch (error) {
              console.error('[ShaderTest] Render error:', error);
              setStatus(`❌ Render error: ${error instanceof Error ? error.message : String(error)}`);
              return; // Stop animation loop on error
            }

            requestAnimationFrame(animate);
          };

          animate();
        } else {
          console.error('[ShaderTest] Load failed:', result.error);
          setStatus(`❌ Failed to load shader: ${result.error}`);
        }
      })
      .catch(error => {
        console.error('[ShaderTest] Load error (catch):', error);
        console.error('[ShaderTest] Error stack:', error instanceof Error ? error.stack : 'no stack');
        setStatus(`❌ Load error: ${error instanceof Error ? error.message : String(error)}`);
      });

    // Cleanup
    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Mega Bezel 18-Pass Shader Test</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#222', borderRadius: '5px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>{status}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Press F12 to open console for detailed logs
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          border: '2px solid #444',
          boxShadow: '0 0 20px rgba(255,255,255,0.1)'
        }}
      />

      {passInfo.length > 0 && (
        <details style={{
          marginTop: '20px',
          width: '800px',
          background: '#222',
          padding: '10px',
          borderRadius: '5px'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Pass Information ({passInfo.length} passes)
          </summary>
          <div style={{
            marginTop: '10px',
            fontSize: '12px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {passInfo.map((info, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #333' }}>
                {info}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
