// Harness testowy: aplikacja mobilna w trybie samodzielnym (jak /app i APK), na całe okno.
import { render } from 'preact';
import { initStore } from '../src/kernel/store.js';
import { makeSeed } from '../src/kernel/seed.js';
import { startKernelTimers } from '../src/kernel/api.js';
import '../src/ui/tokens.css';
import '../src/ui/components.css';
import MobileApp from '../src/endpoints/mobile/index.jsx';

initStore(makeSeed); startKernelTimers();
const st = document.createElement('style');
st.textContent = 'html,body,#app{margin:0;height:100%;} #app{--safe-top:env(safe-area-inset-top,24px);--safe-bottom:env(safe-area-inset-bottom,16px);}';
document.head.appendChild(st);
render(<MobileApp standalone />, document.getElementById('app'));
