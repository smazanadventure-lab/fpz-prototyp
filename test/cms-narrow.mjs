export default async (page, { shot, errors }) => {
  const wait = (ms = 250) => page.waitForTimeout(ms);
  await page.click('.c-login__acc:has-text("Administrator")'); await page.click('[data-testid=c-login-submit]'); await wait();
  await shot('cms-narrow-dash');
  await page.click('.c-side__it >> nth=1'); await wait(); await shot('cms-narrow-entries');
  await page.click('.c-table tbody tr >> nth=0'); await wait(); await shot('cms-narrow-editor');
  await page.click('.c-side__it >> nth=3'); await wait(); await page.click('.c-table tbody tr >> nth=0'); await wait(); await shot('cms-narrow-trigger');
  if (errors.length) throw new Error('błędy konsoli');
};
