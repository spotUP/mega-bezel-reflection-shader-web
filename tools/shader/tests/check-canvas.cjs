const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check canvas details
  const canvasInfo = await page.evaluate(() => {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas found' };

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return { error: 'No WebGL context' };

      // Sample a few pixels from different locations
      const width = canvas.width;
      const height = canvas.height;

      const pixels = new Uint8Array(4);
      const samples = [];

      // Center
      gl.readPixels(width / 2, height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      samples.push({ location: 'center', rgba: Array.from(pixels) });

      // Top-left
      gl.readPixels(10, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      samples.push({ location: 'top-left', rgba: Array.from(pixels) });

      // Bottom-right
      gl.readPixels(width - 10, height - 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      samples.push({ location: 'bottom-right', rgba: Array.from(pixels) });

      return {
        success: true,
        canvasSize: `${width}x${height}`,
        contextType: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
        samples
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  });

  console.log('\n=== CANVAS INFO ===');
  console.log(JSON.stringify(canvasInfo, null, 2));

  await browser.close();
})();
