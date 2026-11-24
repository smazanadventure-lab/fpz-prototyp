export default async (page, { shot }) => {
  await page.evaluate(() => localStorage.clear());
  await page.click('[data-testid=v-login-submit]'); await page.waitForTimeout(300);
  await page.click('.ep-validator .v-tcode >> nth=0'); await page.waitForTimeout(400);
  await shot('validator-narrow');
  await page.evaluate(() => document.querySelector('.ep-validator .v-wrap').scrollTo(0, 2000)); await page.waitForTimeout(200);
  await shot('validator-narrow-tester');
};
