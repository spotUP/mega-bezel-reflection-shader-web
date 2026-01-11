import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl2-compute-context']
});

const page = await browser.newPage();

const errors = [];
const passInfo = [];
const shaderErrors = [];

page.on('console', msg => {
  const text = msg.text();
  if (text.includes('WebGL error') || text.includes('Failed to')) {
    errors.push(text);
  }
  if (text.includes('[Pass ')) {
    passInfo.push(text);
  }
  if (text.includes('MEGA BEZEL')) {
    console.log(text);
  }
  if (text.includes('pass_20') || text.includes('reflection') || text.includes('REFLECTION') || text.includes('texture inputs')) {
    console.log(text);
  }
  if (text.includes('compile') && text.includes('error')) {
    shaderErrors.push(text);
  }
  // Show alias debug
  if (text.includes('[DEBUG]') && text.includes('alias')) {
    console.log(text);
  }
  // Show all MultiPass messages
  if (text.includes('[MultiPass]') || text.includes('textureInputs')) {
    console.log(text);
  }
  // Show DEBUG pass_20 messages
  if (text.includes('[DEBUG pass_20]') || text.includes('pass_20]') || text.includes('PASS20')) {
    console.log(text);
  }
  // Capture ALL input texture logs
  if (text.includes('Input textures') || text.includes('PASS20') || text.includes('Bound')) {
    console.log('>>> ' + text);
  }
  // Capture draw debug and WebGL errors
  if (text.includes('quadVAO') || text.includes('Framebuffer bound') || text.includes('WebGL error')) {
    console.log('>>> ' + text);
  }
});

page.on('pageerror', err => {
  errors.push('Page error: ' + err.message);
});

console.log('Loading page...');
await page.goto('http://localhost:8081/404', { waitUntil: 'domcontentloaded', timeout: 30000 });

console.log('Waiting for shaders...');
await new Promise(r => setTimeout(r, 10000));

try {
  await page.waitForFunction(() => window.shaderDebug !== undefined, { timeout: 15000 });
} catch (e) {
  console.log('Shader debug not available');
}

await new Promise(r => setTimeout(r, 2000));

console.log('\n=== ERRORS ===');
if (errors.length === 0) {
  console.log('No errors!');
} else {
  errors.forEach(e => console.log(e));
}

console.log('\n=== SHADER ERRORS ===');
shaderErrors.forEach(e => console.log(e));

console.log('\n=== PASS INFO ===');
passInfo.forEach(p => console.log(p));

const passCount = await page.evaluate(() => window.shaderDebug?.passCount || 0);
console.log('\nTotal passes:', passCount);

await browser.close();
process.exit(0);
