import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  const errors = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (msg.type() === 'error' || text.toLowerCase().includes('error')) {
      errors.push(text);
    }
  });

  await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  console.log('=== ERRORS ===');
  if (errors.length === 0) {
    console.log('✅ No errors');
  } else {
    errors.forEach(e => console.log(e));
  }

  console.log('\n=== TEXTURE LOADING ===');
  logs.filter(l => l.includes('Loaded texture') || l.includes('texture')).slice(0, 10).forEach(l => console.log(l));

  console.log('\n=== FIRST FRAME ===');
  logs.filter(l => l.includes('First frame')).forEach(l => console.log(l));

  console.log('\n=== PASS 8 (FINAL) ===');
  logs.filter(l => l.includes('pass 8') || l.includes('Pass 8') || l.includes('Final pass')).forEach(l => console.log(l));

  await browser.close();
})();
