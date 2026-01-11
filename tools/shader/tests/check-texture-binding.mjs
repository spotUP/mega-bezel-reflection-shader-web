#!/usr/bin/env node
/**
 * Debug texture binding for specific shader passes
 */
import puppeteer from 'puppeteer';

async function main() {
  console.log('Starting Puppeteer debug...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=default',
      '--enable-webgl',
      '--ignore-gpu-blacklist'
    ]
  });

  const page = await browser.newPage();

  // Collect all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log('[BROWSER]', text);
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message);
  });

  console.log('Navigating to http://localhost:8081/404...');

  try {
    await page.goto('http://localhost:8081/404', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('Page loaded, waiting for shaders...');
    await page.waitForTimeout(3000);

    // Debug: Check texture inputs for pass 4
    const result = await page.evaluate(() => {
      const debug = {
        aliasMapEntries: [],
        passConfigs: [],
        textureNames: [],
        pass4Uniforms: []
      };

      // Try to access the renderer
      if (window.shaderDebug) {
        const renderer = window.shaderDebug.renderer;
        if (renderer) {
          // Get alias map
          if (renderer.aliasMap) {
            renderer.aliasMap.forEach((value, key) => {
              debug.aliasMapEntries.push({ alias: key, texture: value });
            });
          }

          // Get pass configs
          if (renderer.passConfigs) {
            debug.passConfigs = renderer.passConfigs.map((p, i) => ({
              index: i,
              name: p.name,
              alias: p.alias,
              shader: p.shaderPath
            }));
          }

          // Get texture names from inner renderer
          if (renderer.renderer && renderer.renderer.textures) {
            renderer.renderer.textures.forEach((_, name) => {
              debug.textureNames.push(name);
            });
          }

          // Check what uniforms exist in pass_4 program
          if (renderer.renderer && renderer.renderer.programs) {
            const pass4Program = renderer.renderer.programs.get('pass_4');
            if (pass4Program) {
              const gl = renderer.renderer.gl;
              const numUniforms = gl.getProgramParameter(pass4Program, gl.ACTIVE_UNIFORMS);
              for (let i = 0; i < numUniforms; i++) {
                const info = gl.getActiveUniform(pass4Program, i);
                if (info) {
                  debug.pass4Uniforms.push({
                    name: info.name,
                    type: info.type,
                    size: info.size
                  });
                }
              }
            }
          }
        }
      }

      return debug;
    });

    console.log('\n=== DEBUG RESULTS ===\n');
    console.log('Alias Map:', JSON.stringify(result.aliasMapEntries, null, 2));
    console.log('\nPass Configs (first 5):', JSON.stringify(result.passConfigs.slice(0, 5), null, 2));
    console.log('\nTexture Names:', result.textureNames.join(', '));
    console.log('\nPass 4 Uniforms (samplers):',
      result.pass4Uniforms
        .filter(u => u.type === 35678) // GL_SAMPLER_2D
        .map(u => u.name)
        .join(', ')
    );
    console.log('\nAll Pass 4 Uniforms:', JSON.stringify(result.pass4Uniforms, null, 2));

    // Now do a render test with texture binding debug
    console.log('\n=== RUNNING RENDER TEST ===\n');

    const renderResult = await page.evaluate(() => {
      if (!window.shaderDebug) return { error: 'No shaderDebug' };

      const renderer = window.shaderDebug.renderer;
      if (!renderer) return { error: 'No renderer' };

      // Manually check what textures would be bound to pass 4
      const textureInputs = {
        Source: 'pass_3_output', // Previous pass output
        Original: 'gameCanvas'   // Original input
      };

      // Add aliases
      if (renderer.aliasMap) {
        renderer.aliasMap.forEach((outputTextureName, aliasName) => {
          if (renderer.renderer.textures.has(outputTextureName)) {
            textureInputs[aliasName] = outputTextureName;
          }
        });
      }

      return {
        textureInputsForPass4: textureInputs,
        hasPreCRTPass: 'PreCRTPass' in textureInputs,
        preCRTPassTexture: textureInputs['PreCRTPass'] || 'NOT FOUND'
      };
    });

    console.log('Texture inputs for Pass 4:', JSON.stringify(renderResult, null, 2));

    // Read pixel output from pass 4
    const pixelResult = await page.evaluate(() => {
      const gl = document.querySelector('canvas')?.getContext('webgl2');
      if (!gl) return { error: 'No WebGL2 context' };

      // Read center pixel of screen
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(gl.canvas.width / 2),
        Math.floor(gl.canvas.height / 2),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels
      );

      return {
        centerPixel: `rgb(${pixels[0]},${pixels[1]},${pixels[2]})`,
        isBlack: pixels[0] === 0 && pixels[1] === 0 && pixels[2] === 0
      };
    });

    console.log('\nFinal output:', pixelResult.centerPixel, pixelResult.isBlack ? '(BLACK!)' : '');

  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(console.error);
