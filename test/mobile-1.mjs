export default async (page, { shot }) => {
  const ph = page.locator('.sh-phone__screen');
  const snap = async (n) => { await page.waitForTimeout(350); await ph.screenshot({ path: `shots/${n}.png` }); console.log('zrzut', n); };
  await page.waitForTimeout(300); await snap('mobile-01-splash');
  await page.waitForSelector('.m-onb', { timeout: 5000 }); await snap('mobile-02-lang');
  await page.click('.m-onb .fpz-btn'); await snap('mobile-03-tut');
  await page.click('.m-tut__skip button'); await page.waitForSelector('.m-bnav'); await snap('mobile-04-home');
  await page.evaluate(() => document.querySelector('.m-screen:not([hidden]) .m-scroll').scrollTop = 500); await snap('mobile-05-home-scroll');
};
