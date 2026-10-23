/** Download helpers + a dependency-free TypeScript highlighter. */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(
  text: string,
  filename: string,
  mime = "text/plain",
) {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TOKEN =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|\b(const|let|var|function|return|if|else|for|while|of|in|new|import|from|export|type|interface|class|extends|implements|void|null|undefined|true|false|as|await|async|private|public|readonly|default|try|catch|throw|typeof|instanceof)\b|\b(\d+(?:\.\d+)?(?:e-?\d+)?)\b|\b([A-Z][A-Za-z0-9_]*)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;

const CLASS = ["c-com", "c-str", "c-key", "c-num", "c-typ", "c-fn"];

/** Very small tokeniser: good enough to make 1000 lines of TS readable. */
export function highlightTS(src: string): string {
  let out = "";
  let last = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(src))) {
    out += esc(src.slice(last, m.index));
    const cls = CLASS[m.slice(1).findIndex((g) => g !== undefined)] ?? "c-fn";
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += esc(src.slice(last));
  return out
    .split("\n")
    .map(
      (line, i) =>
        `<span class="c-ln">${String(i + 1).padStart(4, " ")}</span>${line}`,
    )
    .join("\n");
}
