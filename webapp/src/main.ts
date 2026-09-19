import './style.css';
import { MODULES, type ModuleDef } from './modules';
import { highlightManifest } from './highlight';
import { mountLiveSimulator } from './live/simulator';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) node.append(c);
  return node;
}

const GROUPS = ['Foundations', 'Browser APIs', 'Advanced', 'Production'];

function renderApp() {
  const app = document.getElementById('app')!;

  const topbar = el(
    'div',
    { className: 'topbar' },
    el('div', { className: 'brand' }, el('span', { className: 'dot' }), 'Manifesto'),
    el(
      'nav',
      {},
      el('a', { href: 'https://github.com/Robert-Doe/manifesto', target: '_blank', rel: 'noopener' }, 'GitHub'),
      el('a', { href: 'https://robertdoe.com', target: '_blank', rel: 'noopener' }, '← robertdoe.com')
    )
  );

  const hero = el(
    'div',
    { className: 'hero' },
    el('div', { className: 'eyebrow' }, '● manifest v3 explorer'),
    el('h1', {}, 'All 25 modules of a real MV3 extension, ', el('span', {}, 'one manifest at a time'), '.'),
    el(
      'p',
      { className: 'tagline' },
      "Chrome extensions can't run as a plain webpage, so this is an honest reference and simulator instead: pick a module to see its real, annotated manifest.json, and for message passing and the service worker — the two modules where a live simulation actually makes sense — drive a genuine content-script ↔ background-worker exchange over real postMessage calls."
    )
  );

  const picker = el('div', { className: 'picker' });
  const detail = el('div', { className: 'detail' });
  const explorer = el('div', { className: 'explorer' }, picker, detail);

  const footer = el(
    'footer',
    {},
    'Reference built from the manifesto course, modules 01–25. ',
    el('a', { href: 'https://github.com/Robert-Doe/manifesto', target: '_blank', rel: 'noopener' }, 'View source on GitHub')
  );

  app.append(topbar, hero, explorer, footer);

  const buttons = new Map<number, HTMLButtonElement>();

  for (const group of GROUPS) {
    picker.append(el('div', { className: 'group-label' }, group));
    for (const m of MODULES.filter((mm) => mm.group === group)) {
      const btn = el(
        'button',
        { className: 'mod-btn', type: 'button' },
        el('span', { className: 'num' }, String(m.num).padStart(2, '0')),
        el('span', {}, m.title),
        ...(m.hasLive ? [el('span', { className: 'live-dot', title: 'Has a live simulator' })] : [])
      ) as HTMLButtonElement;
      btn.addEventListener('click', () => selectModule(m.num));
      buttons.set(m.num, btn);
      picker.append(btn);
    }
  }

  let cleanupLive: (() => void) | null = null;

  function selectModule(num: number) {
    const mod = MODULES.find((m) => m.num === num)!;
    buttons.forEach((b, n) => b.classList.toggle('active', n === num));

    if (cleanupLive) {
      cleanupLive();
      cleanupLive = null;
    }

    detail.innerHTML = '';
    detail.append(
      el('div', { className: 'mod-eyebrow' }, `Module ${String(mod.num).padStart(2, '0')} · ${mod.group}`),
      el('h2', {}, mod.title),
      el('p', { className: 'desc' }, mod.description),
      el('div', { className: 'section-label' }, 'manifest.json (annotated)'),
      el('pre', { className: 'manifest', innerHTML: highlightManifest(mod.manifest) })
    );

    if (mod.hasLive) {
      detail.append(el('div', { className: 'section-label' }, 'Live simulator'));
      const liveRoot = el('div', {});
      detail.append(liveRoot);
      cleanupLive = mountLiveSimulator(liveRoot);
    } else {
      detail.append(
        el('div', { className: 'section-label' }, 'Live simulator'),
        el(
          'div',
          { className: 'no-live' },
          "This module doesn't have a live simulation — an extension can't run as a plain webpage, so most modules are best shown as their real, annotated manifest. ",
          'Try ',
          linkTo('Module 05 — Service Worker Internals', 5),
          ' or ',
          linkTo('Module 06 — Message Passing', 6),
          ' for a genuinely interactive demo.'
        )
      );
    }
  }

  function linkTo(label: string, num: number): HTMLElement {
    const a = el('a', {}, label);
    a.addEventListener('click', () => selectModule(num));
    return a;
  }

  selectModule(MODULES[0].num);
}

renderApp();
