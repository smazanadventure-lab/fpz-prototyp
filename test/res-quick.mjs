import { open } from './res-lib.mjs';
const [,, view = 'home', id = '', name = 'quick'] = process.argv;
const { browser, page, errors, shot } = await open(`?view=${view}&id=${id}`);
await page.waitForTimeout(500); await shot(name);
await browser.close(); if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
