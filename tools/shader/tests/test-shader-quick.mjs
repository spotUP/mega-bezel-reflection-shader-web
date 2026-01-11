import puppeteer from 'puppeteer';

async function quickTest() {
  console.log('Quick shader compilation test...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--use-gl=angle']
  });

  const page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ERROR') || text.includes('Failed') || text.includes('undeclared')) {
      errors.push(text.substring(0, 200));
    }
  });

  await page.goto('http://localhost:8081/404', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 8000));

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'No canvas' };
    const gl = canvas.getContext('webgl2');
    if (!gl) return { error: 'No WebGL2' };

    const pixels = new Uint8Array(4);
    gl.readPixels(canvas.width / 2, canvas.height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return { centerPixel: Array.from(pixels), size: { w: canvas.width, h: canvas.height } };
  });

  console.log('Result:', result);
  console.log('Errors found:', errors.length);
  if (errors.length > 0) {
    console.log('First 5 errors:');
    errors.slice(0, 5).forEach(e => console.log(' -', e));
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
}

quickTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
