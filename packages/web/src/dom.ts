type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript: h('div.card', { onclick }, 'text', child). */
export function h<K extends keyof HTMLElementTagNameMap>(sel: K | `${K}.${string}` | `${K}#${string}`, attrs?: Attrs | Child, ...children: Child[]): HTMLElementTagNameMap[K] {
  const [tagAndId, ...classes] = sel.split('.');
  const [tag, id] = tagAndId.split('#');
  const el = document.createElement(tag) as HTMLElementTagNameMap[K];
  if (id) el.id = id;
  if (classes.length) el.className = classes.join(' ');
  if (attrs !== undefined && attrs !== null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs as Child);
  } else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false || v === null) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
      else if (k in el && k !== 'style' && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

export const fmtClock = (ms: number): string => {
  const t = Math.max(0, ms);
  const s = Math.floor(t / 1000);
  const m = Math.floor(s / 60);
  if (t < 10_000) return `${m}:${String(s % 60).padStart(2, '0')}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};
