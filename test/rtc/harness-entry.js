import { initStore, getState } from '../../src/kernel/store.js';
import { makeSeed } from '../../src/kernel/seed.js';
import { startRemote } from '../../src/kernel/remote.js';
import * as rtc from '../../src/kernel/rtc.js';
initStore(makeSeed); startRemote('');
window.rtcTest = { ...rtc, getState };
