const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto('http://localhost:3000/signup', { waitUntil: 'networkidle' });
    
    // Find the first input
    const input = page.locator('input').first();
    await input.waitFor({ state: 'visible' });
    
    // Type something
    await input.fill('55');
    
    // Evaluate the styles of the input
    const computedStyles = await input.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            fontSize: styles.fontSize,
            lineHeight: styles.lineHeight,
            opacity: styles.opacity,
            height: styles.height,
            padding: styles.padding,
            boxSizing: styles.boxSizing,
            visibility: styles.visibility,
            display: styles.display
        };
    });
    
    console.log(JSON.stringify(computedStyles, null, 2));
    
    await browser.close();
})();
