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

  // Wait for rendering
  await new Promise(resolve => setTimeout(resolve, 3000));

  await browser.close();

  // Filter and display logs
  console.log('\n=== ALL MULTIPASSRENDERER LOGS ===');
  logs.filter(l => l.includes('MultiPassRenderer')).forEach(log => console.log(log));

  console.log('\n=== PASS 0 LOGS ===');
  const pass0Logs = logs.filter(l => l.includes('Pass 0') || l.includes('pass 0'));
  if (pass0Logs.length === 0) {
    console.log('❌ No Pass 0 logs found!');
  } else {
    pass0Logs.forEach(log => console.log(log));
  }

  console.log('\n=== ORIGINAL UNIFORM LOGS ===');
  const originalLogs = logs.filter(l => l.toLowerCase().includes('original'));
  if (originalLogs.length === 0) {
    console.log('❌ No Original uniform logs found!');
  } else {
    originalLogs.forEach(log => console.log(log));
  }

  console.log('\n=== FIRST 20 LOGS ===');
  logs.slice(0, 20).forEach(log => console.log(log));

  console.log('\n=== LAST 20 LOGS ===');
  logs.slice(-20).forEach(log => console.log(log));
})();
