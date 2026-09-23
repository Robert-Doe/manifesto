/**
 * Extremely small "syntax highlighter" for the annotated manifest.json
 * snippets shown in the module picker. These snippets carry `//` teaching
 * comments (real manifest.json can't have comments, these are display-only,
 * pulled from the actual module manifests and annotated for the reader).
 *
 * This is intentionally not a JSON parser, it's a few regex passes that are
 * good enough to color keys, string values, and trailing comments.
 */
export function highlightManifest(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return src
    .split('\n')
    .map((line) => {
      const commentIdx = line.indexOf('//');
      const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
      const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

      let coded = esc(codePart);
      // "key":
      coded = coded.replace(/"([^"]+)"(\s*:)/g, '<span class="key">"$1"</span>$2');
      // remaining string values
      coded = coded.replace(/:(\s*)"([^"]*)"/g, ':$1<span class="str">"$2"</span>');
      // bare string array items ("value" not followed by :)
      coded = coded.replace(/(^|[[,]\s*)"([^"]*)"(?!\s*:)/g, (m, pre, val) => {
        if (m.includes('<span')) return m;
        return `${pre}<span class="str">"${val}"</span>`;
      });

      const comment = commentPart ? `<span class="comment">${esc(commentPart)}</span>` : '';
      return coded + comment;
    })
    .join('\n');
}
