import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--disable-cache'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
  });

  console.log('Loading http://localhost:8080/slang-demo...');
  await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log('\n=== TEXTURE LOADING ===');
  const textureLogs = logs.filter(l => l.includes('texture') || l.includes('Texture'));
  textureLogs.forEach(l => console.log(l));

  console.log('\n=== MULTIPASS RENDERER LOGS ===');
  const multipassLogs = logs.filter(l => l.includes('[MultiPassRenderer]')).slice(-15);
  multipassLogs.forEach(l => console.log(l));

  console.log('\n=== ERRORS ===');
  const errors = logs.filter(l => l.toLowerCase().includes('error'));
  if (errors.length === 0) {
    console.log('✅ No errors');
  } else {
    errors.forEach(l => console.log(l));
  }

  await page.screenshot({ path: '/tmp/slang-demo.png' });
  console.log('\n📸 Screenshot saved to /tmp/slang-demo.png');

  await browser.close();
})();
