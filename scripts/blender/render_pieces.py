"""
Render ChessButFree's original 3D piece set with Blender (bpy).

    python scripts/blender/render_pieces.py [out_dir] [size]

Pieces are lathe-turned from (radius, height) profiles; the knight is extruded from a hand-drawn
silhouette. Output: wP.png ... bK.png with transparent background and a soft contact shadow.
"""
import math
import os
import sys

import bpy  # must come before bmesh/mathutils
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from render_icons import assign, bevel, boolean, hexc, lathe, mat, prim, smooth  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../packages/web/public/img/pieces/3d')
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 256
os.makedirs(OUT, exist_ok=True)

WHITE = dict(base=hexc('#e9e2cf'), accent=hexc('#c9bb9a'))
BLACK = dict(base=hexc('#2e2c30'), accent=hexc('#1b1a1e'))

BASE = [(0.0, 0.0), (0.78, 0.0), (0.8, 0.07), (0.76, 0.16), (0.64, 0.22), (0.6, 0.28)]


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 128
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.35, 0.37, 1)
    for name, loc, energy, size in (('key', (3, -5, 7), 650, 4), ('fill', (-5, -3, 3), 180, 6), ('rim', (0, 6, 5), 700, 3)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy, d.size = energy, size
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 0.8)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam_d = bpy.data.cameras.new('c')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = 2.6
    cam = bpy.data.objects.new('c', cam_d)
    sc.collection.objects.link(cam)
    e = math.radians(14)
    target = Vector((0, 0, 1.12))
    cam.location = target + Vector((0, -9 * math.cos(e), 9 * math.sin(e)))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    floor = prim('plane', size=6, location=(0, 0, 0))
    floor.is_shadow_catcher = True


def finish(objs, color, name):
    m = mat(f'm{name}', color['base'], 0.32, coat=0.5)
    for o in objs:
        if not any(o.data.materials):
            assign(o, m)
    bpy.context.scene.render.filepath = os.path.join(OUT, f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)


def pawn(c):
    body = smooth(lathe('p', BASE + [(0.46, 0.4), (0.34, 0.55), (0.27, 0.8), (0.24, 0.98), (0.4, 1.04), (0.42, 1.1), (0.26, 1.16), (0.0, 1.17)]), 1)
    head = smooth(prim('uv_sphere', radius=0.34, location=(0, 0, 1.44), segments=48, ring_count=24), 1)
    return [body, head]


def rook(c):
    body = smooth(lathe('r', BASE + [(0.52, 0.42), (0.48, 0.55), (0.42, 1.1), (0.44, 1.3), (0.56, 1.36), (0.58, 1.72), (0.0, 1.72)]), 0)
    for i in range(4):
        a = math.radians(45 + 90 * i)
        cut = prim('cube', size=1, location=(0.5 * math.cos(a), 0.5 * math.sin(a), 1.68), scale=(0.62, 0.2, 0.3), rotation=(0, 0, a))
        boolean(body, cut)
    hollow = prim('cylinder', radius=0.38, depth=0.4, location=(0, 0, 1.78))
    boolean(body, hollow)
    bevel(body, 0.025, 3)
    for p in body.data.polygons:
        p.use_smooth = True
    return [body]


def bishop(c):
    body = smooth(lathe('b', BASE + [(0.44, 0.4), (0.3, 0.6), (0.22, 1.0), (0.38, 1.08), (0.4, 1.14), (0.24, 1.2), (0.0, 1.21)]), 1)
    mitre = smooth(prim('uv_sphere', radius=0.36, location=(0, 0, 1.52), scale=(0.9, 0.9, 1.25), segments=48, ring_count=24), 0)
    slit = prim('cube', size=1, location=(0.18, -0.1, 1.68), scale=(0.07, 1.2, 0.5), rotation=(0, math.radians(-35), math.radians(15)))
    boolean(mitre, slit)
    smooth(mitre, 1)
    ball = smooth(prim('uv_sphere', radius=0.1, location=(0, 0, 2.02)), 1)
    return [body, mitre, ball]


def queen(c):
    body = smooth(lathe('q', BASE + [(0.48, 0.4), (0.34, 0.6), (0.24, 1.15), (0.42, 1.24), (0.44, 1.3), (0.28, 1.36), (0.46, 1.78), (0.36, 1.82), (0.0, 1.84)]), 1)
    objs = [body]
    for i in range(8):
        a = 2 * math.pi * i / 8
        objs.append(smooth(prim('uv_sphere', radius=0.075, location=(0.45 * math.cos(a), 0.45 * math.sin(a), 1.82)), 1))
    objs.append(smooth(prim('uv_sphere', radius=0.13, location=(0, 0, 1.98)), 1))
    return objs


def king(c):
    body = smooth(lathe('k', BASE + [(0.5, 0.4), (0.36, 0.6), (0.26, 1.2), (0.44, 1.28), (0.46, 1.34), (0.3, 1.4), (0.42, 1.76), (0.3, 1.86), (0.0, 1.88)]), 1)
    v = prim('cube', size=1, location=(0, 0, 2.1), scale=(0.11, 0.11, 0.42))
    h = prim('cube', size=1, location=(0, 0, 2.14), scale=(0.34, 0.11, 0.11))
    boolean(v, h, 'UNION')
    bevel(v, 0.025, 3)
    return [body, v]


KNIGHT = [(0.46, 0.34), (0.5, 0.8), (0.47, 1.2), (0.36, 1.48), (0.26, 1.62), (0.2, 1.86), (0.08, 1.7), (-0.06, 1.66), (-0.24, 1.56),
          (-0.42, 1.38), (-0.56, 1.16), (-0.6, 1.02), (-0.52, 0.94), (-0.36, 0.96), (-0.2, 1.02), (-0.08, 0.98), (-0.12, 0.82),
          (-0.3, 0.6), (-0.42, 0.34)]


def knight(c):
    base = smooth(lathe('nb', BASE + [(0.52, 0.34), (0.0, 0.36)]), 1)
    mesh = bpy.data.meshes.new('nh')
    bm = bmesh.new()
    depth = 0.46
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in KNIGHT]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in KNIGHT]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    n = len(KNIGHT)
    for i in range(n):
        bm.faces.new((front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    head = bpy.data.objects.new('nh', mesh)
    bpy.context.scene.collection.objects.link(head)
    bevel(head, 0.1, 5)
    for p in head.data.polygons:
        p.use_smooth = True
    head.rotation_euler = (0, 0, math.radians(-12))
    eye = smooth(prim('uv_sphere', radius=0.055, location=(-0.2, -0.24, 1.38)), 1)
    assign(eye, mat('eye', hexc('#111111') if c is WHITE else hexc('#e9e4d6'), 0.2))
    mane = smooth(prim('uv_sphere', radius=1, location=(0.33, 0, 1.25), scale=(0.09, 0.2, 0.42)), 1)
    assign(mane, mat('mane', c['accent'], 0.4))
    return [base, head, eye, mane]


if __name__ == '__main__':
    only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
    for color, prefix in ((WHITE, 'w'), (BLACK, 'b')):
        for letter, fn in (('P', pawn), ('N', knight), ('B', bishop), ('R', rook), ('Q', queen), ('K', king)):
            name = prefix + letter
            if only and name not in only:
                continue
            setup()
            finish(fn(color), color, name)
