const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const errors = [];
  const warnings = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
    } else if (type === 'warning' && !text.includes('Unable to serialize Texture')) {
      // Skip the harmless THREE.js texture serialization warnings
      warnings.push(text);
    }
  });

  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for rendering
  await new Promise(resolve => setTimeout(resolve, 3000));

  await browser.close();

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('✅ No errors');
  } else {
    errors.forEach(err => console.log('❌', err));
  }

  console.log('\n=== WARNINGS ===');
  if (warnings.length === 0) {
    console.log('✅ No warnings');
  } else {
    warnings.forEach(warn => console.log('⚠️', warn));
  }
})();
