import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--use-gl=angle', '--no-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ERROR') || text.includes('error') || text.includes('undeclared') ||
        text.includes('Failed') || text.includes('pass_') || text.includes('shader')) {
      console.log(`[${msg.type()}] ${text.substring(0, 300)}`);
    }
  });

  try {
    console.log('Navigating to /404...');
    await page.goto('http://localhost:8081/404', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('Page loaded, waiting 20 seconds for shaders...');
    await new Promise(r => setTimeout(r, 20000));
    console.log('Done - browser stays open for inspection');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
