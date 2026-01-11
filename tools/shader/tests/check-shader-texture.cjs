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
    if (text.includes('[MultiPass]') || text.includes('Pass 0') || text.includes('input') || text.includes('Source')) {
      logs.push(text);
    }
  });

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== RENDER LOGS ===');
  logs.forEach(log => console.log(log));

  await browser.close();
})();
