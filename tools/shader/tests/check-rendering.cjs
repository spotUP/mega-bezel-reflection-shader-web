const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if shaders are rendering
  const hasCanvas = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;

    // Get WebGL context
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;

    // Check if anything is being rendered (not just grey)
    const pixels = new Uint8Array(4);
    gl.readPixels(canvas.width / 2, canvas.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      canvasFound: true,
      contextType: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
      centerPixel: Array.from(pixels),
      canvasSize: `${canvas.width}x${canvas.height}`
    };
  });

  console.log('\n=== RENDERING INFO ===');
  console.log(JSON.stringify(hasCanvas, null, 2));

  console.log('\n=== SHADER LOGS (last 20) ===');
  const shaderLogs = logs.filter(l =>
    l.includes('[MultiPass]') ||
    l.includes('[SlangCompiler]') ||
    l.includes('shader') ||
    l.includes('Pass 0')
  ).slice(-20);
  shaderLogs.forEach(log => console.log(log));

  await browser.close();
})();
