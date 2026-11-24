import { open } from './res-lib.mjs';
const { browser, page, errors, W, M } = await open();
await page.waitForTimeout(300);
await W.locator('.r-scroll').evaluate((el) => { el.scrollTop = el.querySelector('.r-plist').offsetTop - 40; });
await M.locator('.r-scroll').evaluate((el) => { const p = [...el.querySelectorAll('.r-prod')].find((x) => x.textContent.includes('Pakiet')); el.scrollTop = p.offsetTop - 60; });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/res-packages.png', clip: { x: 0, y: 0, width: 1660, height: 840 } });
await browser.close(); if (errors.length) { console.error(errors.join('\n')); process.exit(1); } console.log('ok');
