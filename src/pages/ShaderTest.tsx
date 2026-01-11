import React, { useEffect, useRef, useState } from 'react';
import { PureWebGL2MultiPassRenderer } from '../shaders/PureWebGL2MultiPassRenderer';

/**
 * Shader Test Page
 * Tests the 18-pass CRT Guest Only shader using Pure WebGL2 Renderer (No Three.js)
 */
export default function ShaderTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [passInfo, setPassInfo] = useState<string[]>([]);
  const rendererRef = useRef<PureWebGL2MultiPassRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = 800;
    const height = 600;

    // Get WebGL2 context
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
    if (!gl) {
      setStatus('❌ WebGL2 not supported by your browser');
      return;
    }

    // Initialize Pure WebGL2 renderer
    const renderer = new PureWebGL2MultiPassRenderer(gl, width, height);
    rendererRef.current = renderer;

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

    // Create and register input texture
    const inputTexture = gl.createTexture();
    if (inputTexture) {
      gl.bindTexture(gl.TEXTURE_2D, inputTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      renderer.registerTexture('InputTexture', inputTexture);
    } else {
      setStatus('❌ Failed to create input texture');
      return;
    }

    // Load the shader preset
    setStatus('Loading shader preset (MBZ__3__STD__GDV)...');

    renderer.loadPreset('/shaders/mega-bezel/MBZ__3__STD__GDV.slangp')
      .then(success => {
        if (success) {
          const passCount = renderer.getPassCount();
          setStatus(`✅ Shader loaded successfully! ${passCount} passes`);
          
          const info = renderer.getPassInfo();
          setPassInfo(info.map(p => `Pass ${p.index}: ${p.name} ${p.alias ? `(${p.alias})` : ''}`));

          // Start render loop
          let frameCount = 0;
          const animate = () => {
            frameCount++;

            try {
              renderer.render('InputTexture');

              // Update status every 60 frames
              if (frameCount % 60 === 0) {
                setStatus(`✅ Rendering... Frame ${frameCount} (Gradient is a synthetic test pattern)`);
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
          setStatus(`❌ Failed to load shader preset`);
        }
      })
      .catch(error => {
        console.error('[ShaderTest] Load error:', error);
        setStatus(`❌ Load error: ${error instanceof Error ? error.message : String(error)}`);
      });

    // Cleanup
    return () => {
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
      <h1 style={{ marginBottom: '20px' }}>Mega Bezel 18-Pass Shader Test (Pure WebGL2)</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#222', borderRadius: '5px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>{status}</div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Press F12 to open console for detailed logs
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{
          width: '800px',
          height: '600px',
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
