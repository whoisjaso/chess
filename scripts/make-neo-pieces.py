"""Derive the ChessButFree "Neo" piece set from cburnett (GPLv2+): soft gradients, charcoal blacks, softer outlines."""
import os, re, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'packages/web/public/img/pieces/cburnett'
out = sys.argv[2] if len(sys.argv) > 2 else 'packages/web/public/img/pieces/neo'
os.makedirs(out, exist_ok=True)
DEFS = {
    'w': '<defs><linearGradient id="g" x1="0" y1="6" x2="0" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f4f3f1"/><stop offset="1" stop-color="#cfcdca"/></linearGradient></defs>',
    'b': '<defs><linearGradient id="g" x1="0" y1="6" x2="0" y2="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6b6764"/><stop offset=".5" stop-color="#55514e"/><stop offset="1" stop-color="#3a3735"/></linearGradient></defs>',
}
for f in sorted(os.listdir(src)):
    if not f.endswith('.svg'):
        continue
    side = f[0]
    s = open(os.path.join(src, f)).read()
    if side == 'w':
        s = re.sub(r'fill="#fff"', 'fill="url(#g)"', s)
        s = s.replace('stroke="#000"', 'stroke="#363431"').replace('fill="#000"', 'fill="#363431"')
    else:
        s = re.sub(r'fill="#000"', 'fill="url(#g)"', s)
        s = s.replace('stroke="#000"', 'stroke="#262421"')
        s = s.replace('#ececec', '#d8d6d3').replace('stroke="#fff"', 'stroke="#d8d6d3"').replace('fill="#fff"', 'fill="#d8d6d3"')
    s = s.replace('stroke-width="1.5"', 'stroke-width="1.6"')
    # Wrap everything so elements relying on the default (black) fill inherit the gradient too.
    s = re.sub(r'(<svg[^>]*>)', lambda m: m.group(1) + DEFS[side] + ('<g fill="url(#g)">' if side == 'b' else ''), s, count=1)
    if side == 'b':
        s = s.replace('</svg>', '</g></svg>')
    open(os.path.join(out, f), 'w').write(s)
print('neo pieces written to', out)
