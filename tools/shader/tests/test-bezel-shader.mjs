import puppeteer from 'puppeteer';

async function testBezelShader() {
  console.log('Testing CRT Guest with Bezel shader preset...');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--use-gl=angle', '--enable-webgl2-compute-context']
  });

  const page = await browser.newPage();

  // Capture console messages
  const errors = [];
  const warnings = [];
  const info = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
      console.log(`[ERROR] ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
    } else if (text.includes('shader') || text.includes('Shader') ||
               text.includes('pass') || text.includes('Pass') ||
               text.includes('bezel') || text.includes('Bezel') ||
               text.includes('tube') || text.includes('Tube') ||
               text.includes('ERROR') || text.includes('Failed')) {
      info.push(text);
      console.log(`[LOG] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  console.log('Navigating to /404...');
  await page.goto('http://localhost:8081/404', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('Waiting for shaders to compile (15 seconds)...');
  await new Promise(r => setTimeout(r, 15000));

  // Read canvas pixels
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas found' };

    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2 context' };

    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let nonBlackCount = 0;
    let maxR = 0, maxG = 0, maxB = 0;
    let avgR = 0, avgG = 0, avgB = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      avgR += r;
      avgG += g;
      avgB += b;

      if (r > 10 || g > 10 || b > 10) {
        nonBlackCount++;
      }
      maxR = Math.max(maxR, r);
      maxG = Math.max(maxG, g);
      maxB = Math.max(maxB, b);
    }

    const pixelCount = width * height;
    return {
      canvasSize: { width, height },
      totalPixels: pixelCount,
      nonBlackPixels: nonBlackCount,
      percentNonBlack: (nonBlackCount / pixelCount * 100).toFixed(2),
      maxValues: { r: maxR, g: maxG, b: maxB },
      avgValues: { r: (avgR / pixelCount).toFixed(1), g: (avgG / pixelCount).toFixed(1), b: (avgB / pixelCount).toFixed(1) }
    };
  });

  console.log('\n=== CANVAS RESULT ===');
  console.log('Canvas size:', result.canvasSize);
  console.log('Non-black pixels:', result.nonBlackPixels, `(${result.percentNonBlack}%)`);
  console.log('Max RGB values:', result.maxValues);
  console.log('Avg RGB values:', result.avgValues);

  console.log('\n=== SUMMARY ===');
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info logs: ${info.length}`);

  if (errors.length > 0) {
    console.log('\n=== TOP ERRORS ===');
    errors.slice(0, 10).forEach(e => console.log(`- ${e}`));
  }

  if (result.maxValues && result.maxValues.r > 50 && result.maxValues.g > 50) {
    console.log('\n✅ SUCCESS: Canvas has visible content!');
  } else {
    console.log('\n❌ ISSUE: Canvas appears dark/black');
  }

  // Keep browser open for inspection
  console.log('\nBrowser left open for inspection. Press Ctrl+C to exit.');

  // Don't close browser - leave for manual inspection
  // await browser.close();
  // process.exit(0);
}

testBezelShader().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
