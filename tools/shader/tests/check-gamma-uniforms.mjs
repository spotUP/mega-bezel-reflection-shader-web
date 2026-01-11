import puppeteer from 'puppeteer';

async function checkGammaUniforms() {
  console.log('Checking gamma uniforms in CRT shader...');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--use-gl=angle', '--enable-webgl2-compute-context']
  });

  const page = await browser.newPage();

  // Capture console messages
  const uniformLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('gamma_out') ||
        text.includes('GAMMA_INPUT') ||
        text.includes('brightboost') ||
        text.includes('post_br') ||
        text.includes('[CRT-PARAM]') ||
        text.includes('Injected critical CRT')) {
      uniformLogs.push(text);
      console.log(`[LOG] ${text}`);
    }
  });

  console.log('Navigating to /404...');
  await page.goto('http://localhost:8081/404', { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('Waiting for shaders to compile (10 seconds)...');
  await new Promise(r => setTimeout(r, 10000));

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

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (r > 10 || g > 10 || b > 10) {
        nonBlackCount++;
      }
      maxR = Math.max(maxR, r);
      maxG = Math.max(maxG, g);
      maxB = Math.max(maxB, b);
    }

    return {
      canvasSize: { width, height },
      totalPixels: width * height,
      nonBlackPixels: nonBlackCount,
      percentNonBlack: (nonBlackCount / (width * height) * 100).toFixed(2),
      maxValues: { r: maxR, g: maxG, b: maxB }
    };
  });

  console.log('\n=== CANVAS RESULT ===');
  console.log('Canvas size:', result.canvasSize);
  console.log('Non-black pixels:', result.nonBlackPixels, `(${result.percentNonBlack}%)`);
  console.log('Max RGB values:', result.maxValues);

  if (result.maxValues && result.maxValues.r > 50 && result.maxValues.g > 50) {
    console.log('\n✅ SUCCESS: Canvas has visible content!');
  } else {
    console.log('\n❌ ISSUE: Canvas appears dark/black');
  }

  console.log('\n=== UNIFORM LOGS ===');
  uniformLogs.forEach(log => console.log(log));

  await browser.close();
  process.exit(0);
}

checkGammaUniforms().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
