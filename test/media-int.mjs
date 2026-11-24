// Integracja: kiosk TZ.T1.5 – słuchawka i przełączanie ścieżek (useSoundscape z media.jsx)
export default async (page, { shot }) => {
  await page.getByText(/Dźwięki miasta/).first().click(); await page.waitForTimeout(600);
  const h = page.getByText(/Podnieś/).first(); if (await h.count()) { await h.click(); await page.waitForTimeout(1200); }
  for (let i = 0; i < 3; i++) { const n = page.locator('button[aria-label*="astępn"], button[aria-label*="ext"]').first(); if (await n.count()) { await n.click(); await page.waitForTimeout(900); } }
  await shot('media-int-kiosk-sound2');
};
