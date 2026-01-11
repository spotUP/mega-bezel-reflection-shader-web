import puppeteer from 'puppeteer';

async function checkConsole() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      console.log(`[ERROR] ${text}`);
    }
  });

  console.log('Opening http://localhost:8081/404...');
  await page.goto('http://localhost:8081/404', { waitUntil: 'networkidle2', timeout: 30000 });

  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Clicking to start...');
  await page.click('body');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== PASS OUTPUT COLORS ===\n');
  const passColors = consoleMessages.filter(m =>
    m.text.includes('[Pass')
  );
  passColors.forEach(m => console.log(`${m.text}`));

  console.log('\n=== SHADER LOADED? ===\n');
  const loaded = consoleMessages.filter(m =>
    m.text.includes('LOADED') || m.text.includes('shadersEnabled')
  );
  loaded.forEach(m => console.log(`${m.text}`));

  console.log('\n=== ALL ERRORS ===\n');
  const errors = consoleMessages.filter(m => m.type === 'error');
  if (errors.length === 0) {
    console.log('No errors!');
  } else {
    errors.forEach(m => console.log(`[ERROR] ${m.text}`));
  }

  console.log('\nTaking screenshot...');
  await page.screenshot({ path: '/tmp/reflection-test.png', fullPage: false });
  console.log('Screenshot saved to /tmp/reflection-test.png');

  console.log('\nBrowser open for 15 seconds...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  await browser.close();
}

checkConsole().catch(console.error);
