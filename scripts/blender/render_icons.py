"""
Render ChessButFree's 3D icon set with Blender (bpy).

    pip install bpy==5.2.2
    python scripts/blender/render_icons.py [out_dir] [size]

Every model is built procedurally here (no external assets), so the icons are original and
reproducible. Output: transparent PNGs, one per icon.
"""
import math
import os
import sys

import bpy  # must come before bmesh/mathutils
import bmesh  # noqa: E402
from mathutils import Euler, Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../packages/web/public/img/icons')
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 256
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------- scene helpers

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.cycles.device = 'CPU'
    scene.render.film_transparent = True
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('w')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.32, 0.32, 0.34, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    return scene


def light(name, loc, energy, size=3.0, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    direction = Vector((0, 0, 0)) - Vector(loc)
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def studio():
    light('key', (4, -5, 6), 900, 4)
    light('fill', (-6, -3, 3), 300, 6, (0.85, 0.9, 1))
    light('rim', (0, 6, 4), 600, 3, (1, 0.95, 0.9))


def camera(dist=7.0, elev=24, azim=-30, ortho=3.2, target=(0, 0, 0.9)):
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.scene.collection.objects.link(cam)
    e, a = math.radians(elev), math.radians(azim)
    t = Vector(target)
    cam.location = t + Vector((dist * math.cos(e) * math.sin(a), -dist * math.cos(e) * math.cos(a), dist * math.sin(e)))
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam


def mat(name, color, rough=0.35, metal=0.0, emission=None, coat=0.3, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Alpha'].default_value = alpha
    if emission:
        b.inputs['Emission Color'].default_value = (*emission, 1)
        b.inputs['Emission Strength'].default_value = 2.0
    return m


def hexc(h):
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def assign(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def smooth(obj, subdiv=2):
    for p in obj.data.polygons:
        p.use_smooth = True
    if subdiv:
        mod = obj.modifiers.new('sub', 'SUBSURF')
        mod.levels = subdiv
        mod.render_levels = subdiv
    return obj


def lathe(name, profile, segs=64):
    """Revolve a (radius, z) profile around Z."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for i in range(segs):
            a, b = rings[j][i], rings[j][(i + 1) % segs]
            c, d = rings[j + 1][(i + 1) % segs], rings[j + 1][i]
            bm.faces.new((a, b, c, d))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def prim(kind, **kw):
    scale = kw.pop('scale', None)
    getattr(bpy.ops.mesh, f'primitive_{kind}_add')(**kw)
    obj = bpy.context.active_object
    if scale:
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def boolean(target, cutter, op='DIFFERENCE'):
    mod = target.modifiers.new('b', 'BOOLEAN')
    mod.operation = op
    mod.object = cutter
    mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter)


def bevel(obj, width=0.05, segs=4):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segs
    mod.limit_method = 'ANGLE'
    return obj


def render(name):
    path = os.path.join(OUT, f'{name}.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('rendered', path)


# ----------------------------------------------------------------------------- models

PAWN = [(0.0, 0.0), (0.82, 0.0), (0.84, 0.08), (0.8, 0.18), (0.66, 0.24), (0.62, 0.3), (0.5, 0.36), (0.38, 0.48),
        (0.3, 0.7), (0.26, 0.92), (0.42, 0.98), (0.44, 1.04), (0.3, 1.1), (0.0, 1.12)]


def icon_play():
    reset(); studio(); camera(target=(0, 0, 0.85), ortho=2.9)
    body = smooth(lathe('pawn', PAWN), 1)
    assign(body, mat('ivory', hexc('#f2efe6'), 0.3))
    head = prim('uv_sphere', radius=0.36, location=(0, 0, 1.42), segments=48, ring_count=24)
    smooth(head, 1); assign(head, mat('ivory2', hexc('#f2efe6'), 0.3))
    ring = prim('torus', major_radius=0.86, minor_radius=0.07, location=(0, 0, 0.08))
    smooth(ring, 1); assign(ring, mat('green', hexc('#81b64c'), 0.35))
    render('play')


def icon_bots():
    reset(); studio(); camera(target=(0, 0, 0.6), ortho=3.0)
    head = prim('cube', size=1.5, location=(0, 0, 0.75))
    bevel(head, 0.25, 6); assign(head, mat('steel', hexc('#9fb2c6'), 0.25, 0.3))
    visor = prim('cube', size=1, location=(0, -0.72, 0.85), scale=(0.62, 0.06, 0.32))
    bevel(visor, 0.08, 4); assign(visor, mat('visor', hexc('#1d2530'), 0.15))
    for x in (-0.28, 0.28):
        eye = prim('uv_sphere', radius=0.12, location=(x, -0.78, 0.86))
        smooth(eye, 1); assign(eye, mat(f'eye{x}', hexc('#46c2b4'), 0.2, emission=hexc('#46c2b4')))
    ant = prim('cylinder', radius=0.04, depth=0.5, location=(0, 0, 1.7)); assign(ant, mat('steel2', hexc('#9fb2c6'), 0.3, 0.4))
    tip = prim('uv_sphere', radius=0.11, location=(0, 0, 1.98)); smooth(tip, 1); assign(tip, mat('tip', hexc('#e2a34a'), 0.3, emission=hexc('#e2a34a')))
    for x in (-0.82, 0.82):
        ear = prim('cylinder', radius=0.2, depth=0.18, location=(x, 0, 0.8), rotation=(0, math.pi / 2, 0)); bevel(ear, 0.04); assign(ear, mat(f'ear{x}', hexc('#e2a34a'), 0.3))
    render('bots')


def icon_puzzles():
    reset(); studio(); camera(target=(0, 0, 0.2), ortho=3.2, elev=40)
    base = prim('cube', size=1.6, location=(0, 0, 0), scale=(1, 1, 0.22))
    for loc in ((0.95, 0, 0), (0, 0.95, 0)):
        knob = prim('cylinder', radius=0.32, depth=0.35, location=loc)
        boolean(base, knob, 'UNION')
    for loc in ((-0.68, 0, 0), (0, -0.68, 0)):
        hole = prim('cylinder', radius=0.3, depth=0.8, location=loc)
        boolean(base, hole, 'DIFFERENCE')
    bevel(base, 0.07, 5)
    for p in base.data.polygons:
        p.use_smooth = True
    assign(base, mat('orange', hexc('#f0803c'), 0.4))
    base.rotation_euler = (0, 0, math.radians(20))
    render('puzzles')


def icon_learn():
    reset(); studio(); camera(target=(0, 0, 0.55), ortho=3.1, elev=28)
    skull = prim('cylinder', radius=0.72, depth=0.6, location=(0, 0, 0.35)); bevel(skull, 0.08)
    assign(skull, mat('blue2', hexc('#1f6fb8'), 0.4))
    board = prim('cube', size=1, location=(0, 0, 0.72), scale=(1.75, 1.75, 0.07), rotation=(0, 0, math.radians(45)))
    bevel(board, 0.03); assign(board, mat('blue', hexc('#2e8ae6'), 0.35))
    button = prim('cylinder', radius=0.1, depth=0.08, location=(0, 0, 0.8)); assign(button, mat('gold', hexc('#f2c14e'), 0.3, 0.6))
    cord = prim('cylinder', radius=0.025, depth=1.2, location=(0.62, -0.62, 0.79), rotation=(math.radians(90), 0, math.radians(45)))
    assign(cord, mat('gold2', hexc('#f2c14e'), 0.3, 0.6))
    drop = prim('cylinder', radius=0.025, depth=0.35, location=(1.04, -1.04, 0.62)); assign(drop, mat('gold4', hexc('#f2c14e'), 0.3, 0.6))
    tassel = prim('cone', radius1=0.11, radius2=0.03, depth=0.34, location=(1.04, -1.04, 0.32))
    assign(tassel, mat('gold3', hexc('#f2c14e'), 0.4, 0.5))
    render('learn')


def icon_review():
    reset(); studio(); camera(target=(0, 0, 0), ortho=3.3, elev=15, azim=-20)
    rim = prim('torus', major_radius=0.85, minor_radius=0.13, location=(0, 0, 0.3), rotation=(math.radians(90), 0, 0))
    smooth(rim, 1); assign(rim, mat('silver', hexc('#d7dee6'), 0.2, 0.9))
    glass = prim('cylinder', radius=0.82, depth=0.06, location=(0, 0, 0.3), rotation=(math.radians(90), 0, 0))
    assign(glass, mat('glass', hexc('#9fd3ff'), 0.05, coat=1.0))
    # a little board inside the lens
    for i in range(2):
        for j in range(2):
            sq = prim('cube', size=0.5, location=(-0.25 + 0.5 * i, -0.06, 0.05 + 0.5 * j), scale=(1, 0.05, 1))
            assign(sq, mat(f'sq{i}{j}', hexc('#2f5f9a') if (i + j) % 2 == 0 else hexc('#cfe6ff'), 0.4))
    handle = prim('cylinder', radius=0.12, depth=1.0, location=(0.88, 0, -0.58), rotation=(0, math.radians(-45), 0))
    bevel(handle, 0.04); assign(handle, mat('handle', hexc('#3a3f47'), 0.4))
    render('review')


def icon_openings():
    reset(); studio(); camera(target=(0, 0, 0.3), ortho=3.2, elev=35)
    for z, h in ((0.0, 0.08), (0.52, 0.08)):
        cover = prim('cube', size=1, location=(0, 0, z), scale=(1.1, 1.5, h)); bevel(cover, 0.04)
        assign(cover, mat(f'cover{z}', hexc('#a8653a'), 0.45))
    pages = prim('cube', size=1, location=(0.04, 0, 0.26), scale=(1.02, 1.42, 0.42)); bevel(pages, 0.02)
    assign(pages, mat('pages', hexc('#f4ead8'), 0.6))
    spine = prim('cylinder', radius=0.3, depth=1.5, location=(-0.55, 0, 0.26), rotation=(math.radians(90), 0, 0))
    smooth(spine, 0); assign(spine, mat('spine', hexc('#8c4f2b'), 0.45))
    band = prim('cube', size=1, location=(0.3, -0.76, 0.56), scale=(0.18, 0.02, 0.02)); assign(band, mat('gold', hexc('#f2c14e'), 0.3, 0.7))
    render('openings')


def icon_coaches():
    reset(); studio(); camera(target=(0, 0, 0), ortho=3.0, elev=10, azim=-15)
    face = prim('uv_sphere', radius=1, location=(0, 0, 0), scale=(0.8, 0.45, 1.0), segments=64, ring_count=32)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.bisect(plane_co=(0, 0.05, 0), plane_no=(0, 1, 0), clear_outer=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    sol = face.modifiers.new('solid', 'SOLIDIFY'); sol.thickness = 0.08
    bpy.context.view_layer.objects.active = face; bpy.ops.object.modifier_apply(modifier='solid')
    for x in (-0.3, 0.3):
        eye = prim('uv_sphere', radius=0.2, location=(x, -0.42, 0.2), scale=(1.4, 1.5, 0.75))
        boolean(face, eye)
    smooth(face, 1); assign(face, mat('porcelain', hexc('#f3efe8'), 0.25, coat=0.6))
    for x in (-0.3, 0.3):
        brow = prim('cylinder', radius=0.035, depth=0.42, location=(x, -0.43, 0.42), rotation=(0, math.radians(90 + (12 if x < 0 else -12)), 0))
        assign(brow, mat(f'brow{x}', hexc('#9b6be0'), 0.3))
    lips = prim('uv_sphere', radius=0.16, location=(0, -0.41, -0.45), scale=(1.6, 0.4, 0.45)); smooth(lips, 1)
    assign(lips, mat('lips', hexc('#9b6be0'), 0.3))
    for x in (-0.82, 0.82):
        rib = prim('torus', major_radius=0.12, minor_radius=0.04, location=(x, 0.0, 0.2), rotation=(0, math.radians(90), 0))
        smooth(rib, 1); assign(rib, mat(f'rib{x}', hexc('#9b6be0'), 0.35))
    render('coaches')


def icon_mind():
    reset(); studio(); camera(target=(0, 0, 0), ortho=2.6, elev=8, azim=-10)
    ball = prim('uv_sphere', radius=1, segments=64, ring_count=32); smooth(ball, 1)
    assign(ball, mat('white', hexc('#f4f4f2'), 0.15, coat=0.8))
    iris = prim('uv_sphere', radius=0.52, location=(0, -0.86, 0), scale=(1, 0.35, 1), segments=64, ring_count=32); smooth(iris, 1)
    assign(iris, mat('iris', hexc('#2fb3a3'), 0.3, emission=hexc('#0f5e55')))
    pupil = prim('uv_sphere', radius=0.24, location=(0, -1.02, 0), scale=(1, 0.3, 1)); smooth(pupil, 1)
    assign(pupil, mat('pupil', hexc('#0b0f12'), 0.1, coat=1.0))
    glint = prim('uv_sphere', radius=0.07, location=(0.16, -1.07, 0.17)); assign(glint, mat('glint', (1, 1, 1), 0.0, emission=(1, 1, 1)))
    render('mind')


if __name__ == '__main__':
    only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
    for fn in (icon_play, icon_bots, icon_puzzles, icon_learn, icon_review, icon_openings, icon_coaches, icon_mind):
        name = fn.__name__.removeprefix('icon_')
        if only is None or name in only:
            fn()
