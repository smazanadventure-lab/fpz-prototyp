export default async (page, { shot, errors }) => {
  await shot('cms-login');
  await page.click('.c-login__acc >> nth=0'); await page.click('[data-testid=c-login-submit]');
  await page.waitForTimeout(300);
  await shot('cms-dash');
  const secs = ['content','places','triggers','game','offer','community','i18n','push','settings'];
  for (const [i, id] of secs.entries()) {
    await page.click(`.c-side__it >> nth=${i + 1}`); await page.waitForTimeout(250);
    await shot('cms-s-' + id);
  }
  console.log('errors', errors.length);
};
