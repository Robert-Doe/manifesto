import './style.css';
import { MODULES, type ModuleDef } from './modules';
import { highlightManifest } from './highlight';
import { highlightCode } from './codehighlight';
import { mdLite, wireModRefs } from './mdlite';
import { MODULE_CONTENT } from './content.generated';
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

type TabId = 'overview' | 'code' | 'why' | 'docs' | 'live';
const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'code', label: 'Real Code' },
  { id: 'why', label: 'Why These Decisions' },
  { id: 'docs', label: 'Official Docs' },
  { id: 'live', label: 'Live Simulator' },
];

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
      'Chrome extensions can’t run as a plain webpage, so this is an honest reference and simulator instead: pick a module for its real, annotated manifest.json, every real source file it ships, the actual DECISIONS.md trade-offs behind it, and the official docs to confirm it all yourself. Message passing and the service worker also get a genuine live simulator — a real content-script ↔ background-worker exchange over real postMessage calls.'
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
  let activeTab: TabId = 'overview';

  function linkTo(label: string, num: number): HTMLElement {
    const a = el('a', {}, label);
    a.addEventListener('click', () => selectModule(num));
    return a;
  }

  function renderOverview(mod: ModuleDef, body: HTMLElement) {
    body.append(
      el('p', { className: 'desc' }, mod.description),
      el('div', { className: 'section-label' }, 'manifest.json (annotated)'),
      el('pre', { className: 'manifest', innerHTML: highlightManifest(mod.manifest) })
    );
  }

  function renderCode(num: number, body: HTMLElement) {
    const content = MODULE_CONTENT[num];
    if (!content || content.files.length === 0) {
      body.append(el('div', { className: 'no-live' }, 'No source files found for this module.'));
      return;
    }

    const strip = el('div', { className: 'file-tab-strip' });
    const view = el('pre', { className: 'code-view' }, el('code', {}));
    body.append(strip, view);

    const fileButtons = new Map<string, HTMLButtonElement>();

    function showFile(name: string) {
      const f = content.files.find((ff) => ff.name === name)!;
      fileButtons.forEach((b, n) => b.classList.toggle('active', n === name));
      const code = view.querySelector('code')!;
      code.className = `language-${f.lang}`;
      code.innerHTML = highlightCode(f.code, f.lang);
    }

    for (const f of content.files) {
      const btn = el('button', { className: 'file-tab', type: 'button' }, f.name) as HTMLButtonElement;
      btn.addEventListener('click', () => showFile(f.name));
      fileButtons.set(f.name, btn);
      strip.append(btn);
    }

    showFile(content.files[0].name);
  }

  function renderWhy(num: number, body: HTMLElement) {
    const content = MODULE_CONTENT[num];
    if (!content || content.decisions.length === 0) {
      body.append(el('div', { className: 'no-live' }, 'No recorded decisions for this module.'));
      return;
    }

    for (const d of content.decisions) {
      const card = el('div', { className: 'decision-card' });
      card.append(el('div', { className: 'decision-title' }, `Decision ${d.num} — ${d.title}`));

      if (d.body !== undefined) {
        const box = el('div', { className: 'decision-body', innerHTML: mdLite(d.body) });
        card.append(box);
      } else {
        if (d.decision) card.append(el('div', { className: 'decision-field decision', innerHTML: `<span class="field-label">Decision</span>${mdLite(d.decision)}` }));
        if (d.why) card.append(el('div', { className: 'decision-field why', innerHTML: `<span class="field-label">Why</span>${mdLite(d.why)}` }));
        if (d.tradeoff) card.append(el('div', { className: 'decision-field tradeoff', innerHTML: `<span class="field-label">Trade-off</span>${mdLite(d.tradeoff)}` }));
      }

      wireModRefs(card, selectModule);
      body.append(card);
    }
  }

  function renderDocs(num: number, body: HTMLElement) {
    const content = MODULE_CONTENT[num];
    if (!content || content.docs.length === 0) {
      body.append(el('div', { className: 'no-live' }, 'No documentation links recorded for this module.'));
      return;
    }

    for (const doc of content.docs) {
      body.append(
        el(
          'div',
          { className: 'doc-card' },
          el('span', { className: 'doc-card-icon' }, '\u{1F4C4}'),
          el(
            'div',
            { className: 'doc-card-body' },
            el('strong', {}, doc.title),
            ' — ',
            doc.description,
            el('br'),
            el('a', { href: doc.url, target: '_blank', rel: 'noopener' }, doc.url)
          )
        )
      );
    }
  }

  function renderLive(mod: ModuleDef, body: HTMLElement) {
    if (mod.hasLive) {
      const liveRoot = el('div', {});
      body.append(liveRoot);
      cleanupLive = mountLiveSimulator(liveRoot);
    } else {
      body.append(
        el(
          'div',
          { className: 'no-live' },
          'This module doesn’t have a live simulation — an extension can’t run as a plain webpage, so most modules are best explored through their real code and manifest. ',
          'Try ',
          linkTo('Module 05 — Service Worker Internals', 5),
          ' or ',
          linkTo('Module 06 — Message Passing', 6),
          ' for a genuinely interactive demo.'
        )
      );
    }
  }

  function renderTabBody(mod: ModuleDef, tabsEl: HTMLElement) {
    if (cleanupLive) {
      cleanupLive();
      cleanupLive = null;
    }

    const body = el('div', { className: 'tab-body' });
    tabsEl.append(body);

    switch (activeTab) {
      case 'overview':
        renderOverview(mod, body);
        break;
      case 'code':
        renderCode(mod.num, body);
        break;
      case 'why':
        renderWhy(mod.num, body);
        break;
      case 'docs':
        renderDocs(mod.num, body);
        break;
      case 'live':
        renderLive(mod, body);
        break;
    }
  }

  function selectModule(num: number) {
    const mod = MODULES.find((m) => m.num === num)!;
    buttons.forEach((b, n) => b.classList.toggle('active', n === num));
    activeTab = 'overview';

    detail.innerHTML = '';

    const eyebrowRow = el(
      'div',
      { className: 'mod-eyebrow' },
      `Module ${String(mod.num).padStart(2, '0')} · ${mod.group}`
    );
    const heading = el('h2', {}, mod.title);

    const tabStrip = el('div', { className: 'tab-strip' });
    const tabsWrap = el('div', {});
    detail.append(eyebrowRow, heading, tabStrip, tabsWrap);

    const tabButtons = new Map<TabId, HTMLButtonElement>();
    for (const t of TABS) {
      const btn = el('button', { className: 'tab-btn', type: 'button' }, t.label) as HTMLButtonElement;
      btn.addEventListener('click', () => {
        activeTab = t.id;
        tabButtons.forEach((b, id) => b.classList.toggle('active', id === t.id));
        tabsWrap.innerHTML = '';
        renderTabBody(mod, tabsWrap);
      });
      tabButtons.set(t.id, btn);
      tabStrip.append(btn);
    }
    tabButtons.get('overview')!.classList.add('active');

    renderTabBody(mod, tabsWrap);
  }

  selectModule(MODULES[0].num);
}

renderApp();
