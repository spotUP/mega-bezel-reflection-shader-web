import React, { useEffect, useRef, useState } from 'react';
import { MegaBezel } from '../lib/MegaBezel';

/**
 * Shader Test Page
 * Tests the mega-bezel shader pipeline via WASM+WebGL2 renderer.
 */
export default function ShaderTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>('Initializing...');

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    let disposed = false;
    let rafId: number | undefined;

    // Create SMPTE-style test pattern (256x224)
    const patternWidth = 256;
    const patternHeight = 224;
    const imageData = new ImageData(patternWidth, patternHeight);
    const data = imageData.data;

    // SMPTE color bars (top half)
    const bars = [
      [255, 255, 255], // white
      [255, 255, 0],   // yellow
      [0, 255, 255],   // cyan
      [0, 255, 0],     // green
      [255, 0, 255],   // magenta
      [255, 0, 0],     // red
      [0, 0, 255],     // blue
    ];
    const barWidth = Math.floor(patternWidth / bars.length);
    const halfHeight = Math.floor(patternHeight / 2);

    for (let y = 0; y < halfHeight; y++) {
      for (let x = 0; x < patternWidth; x++) {
        const barIndex = Math.min(Math.floor(x / barWidth), bars.length - 1);
        const [r, g, b] = bars[barIndex];
        const idx = (y * patternWidth + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    // Checkerboard (bottom half)
    const cell = 16;
    for (let y = halfHeight; y < patternHeight; y++) {
      for (let x = 0; x < patternWidth; x++) {
        const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
        const v = on ? 26 : 230;
        const idx = (y * patternWidth + x) * 4;
        data[idx] = v;
        data[idx + 1] = v;
        data[idx + 2] = v;
        data[idx + 3] = 255;
      }
    }

    const mb = new MegaBezel({ canvas });

    async function start() {
      try {
        setStatus('Loading WASM module...');
        await mb.init();
        if (disposed) return;

        setStatus('Loading preset...');
        const info = await mb.loadPreset(
          '/shaders/mega-bezel/MBZ__3__STD__GDV-local.slangp',
          '/shaders/mega-bezel',
        );
        if (disposed) return;

        setStatus(`Rendering (${info.passes} passes)...`);

        let frameCount = 0;
        const animate = () => {
          if (disposed) return;
          frameCount++;
          mb.renderFrame(imageData);

          if (frameCount % 60 === 0) {
            setStatus(`Rendering (${info.passes} passes) - frame ${frameCount}`);
          }

          rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);
      } catch (err) {
        if (disposed) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ShaderTest] Error:', err);
        setStatus(`Error: ${msg}`);
      }
    }

    start();

    return () => {
      disposed = true;
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      mb.destroy();
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
      padding: '20px',
    }}>
      <h1 style={{ marginBottom: '20px' }}>Mega Bezel Shader Test (WASM)</h1>

      <div style={{
        marginBottom: '20px',
        padding: '10px',
        background: '#222',
        borderRadius: '5px',
      }}>
        <div style={{ fontWeight: 'bold' }}>{status}</div>
      </div>

      <canvas
        ref={canvasRef}
        id="mega-bezel-canvas"
        width={800}
        height={600}
        style={{
          width: '800px',
          height: '600px',
          border: '2px solid #444',
          boxShadow: '0 0 20px rgba(255,255,255,0.1)',
        }}
      />
    </div>
  );
}
