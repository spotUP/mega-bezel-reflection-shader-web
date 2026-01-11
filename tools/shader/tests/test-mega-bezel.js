import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--disable-cache'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  console.log('Loading page...');
  await page.goto('http://localhost:8080/slang-demo', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(resolve => setTimeout(resolve, 5000));

  await page.screenshot({ path: '/tmp/mega-bezel-real-textures.png' });
  console.log('✅ Screenshot saved to /tmp/mega-bezel-real-textures.png');

  await browser.close();
})();
