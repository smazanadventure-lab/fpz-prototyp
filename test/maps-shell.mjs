// Skrypt dla tools/shot.mjs: panel „Otoczenie telefonu” – plan terenu i mapa miasta
export default async (page, { shot }) => {
  await page.waitForTimeout(400); await shot('maps-shell-fpz');
  const b = await page.locator('.sh-env__map [data-poi]').first(); const box = await b.boundingBox(); if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await page.getByRole('tab', { name: 'Miasto' }).click().catch(async () => { await page.getByText('Miasto', { exact: true }).click(); });
  await page.waitForTimeout(500); await shot('maps-shell-city');
};
