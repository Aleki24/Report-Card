const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');

  console.log('Filling form...');
  await page.fill('input[type="email"]', 'alexotieno246@gmail.com');
  await page.fill('input[type="password"]', '123456');

  console.log('Submitting...');
  await page.click('button[type="submit"]');

  console.log('Waiting for response...');
  await page.waitForTimeout(5000);

  console.log('Done.');
  await browser.close();
})();
