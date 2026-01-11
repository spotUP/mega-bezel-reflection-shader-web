import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl2-compute-context']
});

const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  console.log(text);
});

page.on('pageerror', err => {
  console.log('Page error: ' + err.message);
});

console.log('Loading page...');
await page.goto('http://localhost:8081/404', { waitUntil: 'domcontentloaded', timeout: 30000 });

await new Promise(r => setTimeout(r, 15000));

await browser.close();
process.exit(0);
