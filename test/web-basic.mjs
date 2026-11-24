export default async (page, { shot }) => {
  const w = (n) => page.waitForTimeout(n);
  await w(600);
  await shot('web-home-desktop');
  await page.evaluate(() => document.querySelector('.ep-web .w-scroll').scrollTop = 900); await w(300);
  await shot('web-home-desktop2');
  await page.evaluate(() => document.querySelector('.ep-web .w-scroll').scrollTop = 2200); await w(300);
  await shot('web-home-desktop3');
  const seg = page.locator('.sh-browser__bar .sh-seg button');
  await seg.nth(1).click(); await w(400);
  await page.evaluate(() => document.querySelector('.ep-web .w-scroll').scrollTop = 0); await w(200);
  await shot('web-home-tablet');
  await seg.nth(2).click(); await w(400);
  await shot('web-home-phone');
};
