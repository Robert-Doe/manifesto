/**
 * Minimal markdown-lite renderer for DECISIONS.md prose: paragraphs, "- "
 * bullet lists, **bold**, and `code` spans. Not a general markdown parser,
 * just enough to render the real DECISIONS.md text without a wall-of-text
 * flatten or literal asterisks showing up in the UI. Also auto-links
 * "Module NN" mentions to jump the picker to that module.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\bModule (\d{2})\b/g, '<a class="mod-ref" data-mod="$1">Module $1</a>');
  return out;
}

export function mdLite(text: string): string {
  const lines = text.trim().split('\n');
  const html: string[] = [];
  let buf: string[] = [];
  let mode: 'p' | 'ul' | null = null;

  function flush() {
    if (buf.length === 0) return;
    if (mode === 'ul') {
      html.push('<ul>' + buf.map((l) => `<li>${inline(l)}</li>`).join('') + '</ul>');
    } else if (mode === 'p') {
      html.push(`<p>${buf.map(inline).join(' ')}</p>`);
    }
    buf = [];
    mode = null;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('- ')) {
      if (mode !== 'ul') flush();
      mode = 'ul';
      buf.push(line.slice(2));
    } else {
      if (mode !== 'p') flush();
      mode = 'p';
      buf.push(line);
    }
  }
  flush();

  return html.join('\n');
}

/** Wires up any .mod-ref links inside `root` to call `onJump(num)`. */
export function wireModRefs(root: HTMLElement, onJump: (num: number) => void): void {
  root.querySelectorAll<HTMLAnchorElement>('a.mod-ref').forEach((a) => {
    a.href = 'javascript:void(0)';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const num = Number(a.dataset.mod);
      if (num) onJump(num);
    });
  });
}
