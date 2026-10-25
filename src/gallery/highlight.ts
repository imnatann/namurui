const KEYWORDS =
  /\b(import|from|export|default|function|return|const|let|var|if|else|for|of|in|new|type|interface|extends|as|await|async|typeof|instanceof|void|null|undefined|true|false|useState|useEffect|useRef|useLayoutEffect|useMemo|useCallback|useId|useReducer)\b/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A small TSX highlighter. Deliberately not a parser: it walks the source once,
 * recognises strings, comments, JSX tags, numbers and keywords, and leaves
 * everything else alone. That is enough to read the file and costs no dependency.
 */
export function highlight(source: string): string {
  const pattern =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(<\/?[A-Za-z][\w.]*|\/?>)|(\b\d+(?:\.\d+)?(?:ms|s|px|%|em|rem|fr|vh|vw|dvh)?\b)|([A-Za-z_$][\w$]*)/g;

  let out = "";
  let last = 0;
  for (const m of source.matchAll(pattern)) {
    const i = m.index ?? 0;
    out += escapeHtml(source.slice(last, i));
    const [text, comment, str, tag, num, word] = m;
    if (comment) out += `<span class="tok-c">${escapeHtml(text)}</span>`;
    else if (str) out += `<span class="tok-s">${escapeHtml(text)}</span>`;
    else if (tag) out += `<span class="tok-t">${escapeHtml(text)}</span>`;
    else if (num) out += `<span class="tok-n">${escapeHtml(text)}</span>`;
    else if (word && KEYWORDS.test(word)) {
      KEYWORDS.lastIndex = 0;
      out += `<span class="tok-k">${escapeHtml(text)}</span>`;
    } else out += escapeHtml(text);
    KEYWORDS.lastIndex = 0;
    last = i + text.length;
  }
  return out + escapeHtml(source.slice(last));
}
