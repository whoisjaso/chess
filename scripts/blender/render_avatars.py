"""
Render ChessButFree's bot + coach avatars with Blender (bpy): stylised toy-figure busts, all original.

    python scripts/blender/render_avatars.py [out_dir] [size] [only,ids]
"""
import math
import os
import sys

import bpy  # must come before mathutils
from mathutils import Vector  # noqa: E402

sys.path.insert(0, os.path.dirname(__file__))
from render_icons import assign, bevel, hexc, mat, prim, smooth  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../packages/web/public/img/avatars')
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 256
os.makedirs(OUT, exist_ok=True)


def setup(bg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.4, 0.4, 0.42, 1)
    for name, loc, energy, size in (('key', (3, -6, 5), 700, 4), ('fill', (-5, -4, 2), 250, 6), ('rim', (0, 5, 4), 600, 3)):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy, d.size = energy, size
        o = bpy.data.objects.new(name, d)
        sc.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = (Vector((0, 0, 1.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    backdrop = prim('plane', size=10, location=(0, 3, 1), rotation=(math.radians(90), 0, 0))
    assign(backdrop, mat('bg', hexc(bg), 0.9))
    cam_d = bpy.data.cameras.new('c')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = 2.6
    cam = bpy.data.objects.new('c', cam_d)
    sc.collection.objects.link(cam)
    target = Vector((0, 0, 1.15))
    cam.location = target + Vector((0.9, -8, 0.9))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam


def figure(skin, shirt, hair=None, hair_style='cap', eyes='#1b1b1f', mouth='smile', brows=None):
    """Torso + head + face. Returns head center."""
    torso = smooth(prim('uv_sphere', radius=1, location=(0, 0, -0.05), scale=(1.05, 0.7, 0.75), segments=48, ring_count=24), 1)
    assign(torso, mat('shirt', hexc(shirt), 0.6))
    neck = prim('cylinder', radius=0.22, depth=0.4, location=(0, 0, 0.72))
    assign(neck, mat('skin_n', hexc(skin), 0.5))
    head = smooth(prim('uv_sphere', radius=0.62, location=(0, 0, 1.35), scale=(0.92, 0.9, 1.0), segments=48, ring_count=24), 1)
    assign(head, mat('skin', hexc(skin), 0.5))
    for x in (-0.22, 0.22):
        e = smooth(prim('uv_sphere', radius=0.075, location=(x, -0.54, 1.42), scale=(1, 0.6, 1.25)), 1)
        assign(e, mat(f'eye{x}', hexc(eyes), 0.15, coat=1))
        g = prim('uv_sphere', radius=0.02, location=(x + 0.025, -0.6, 1.46))
        assign(g, mat(f'gl{x}', (1, 1, 1), 0.0, emission=(1, 1, 1)))
    if mouth == 'smile':
        m = smooth(prim('torus', major_radius=0.13, minor_radius=0.025, location=(0, -0.55, 1.2), rotation=(math.radians(90), 0, 0)), 1)
        # keep the lower half of the torus as a smile
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(0, 0, 1.2), plane_no=(0, 0, 1), clear_outer=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    elif mouth == 'flat':
        m = prim('cylinder', radius=0.022, depth=0.2, location=(0, -0.57, 1.17), rotation=(0, math.radians(90), 0))
    elif mouth == 'frown':
        m = smooth(prim('torus', major_radius=0.12, minor_radius=0.025, location=(0, -0.55, 1.08), rotation=(math.radians(90), 0, 0)), 1)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(0, 0, 1.08), plane_no=(0, 0, 1), clear_inner=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    elif mouth == 'grin':
        m = smooth(prim('uv_sphere', radius=0.12, location=(0, -0.53, 1.17), scale=(1.3, 0.5, 0.55)), 1)
        assign(m, mat('teeth', hexc('#ffffff'), 0.3))
    if mouth != 'grin':
        assign(m, mat('mouth', hexc('#5a2a2a'), 0.4))
    if brows:
        for x, tilt in ((-0.22, brows), (0.22, -brows)):
            b = prim('cylinder', radius=0.025, depth=0.2, location=(x, -0.55, 1.58), rotation=(0, math.radians(90 + tilt), 0))
            assign(b, mat(f'br{x}', hexc(hair or '#222222'), 0.5))
    if hair:
        hm = mat('hair', hexc(hair), 0.55)
        if hair_style in ('cap', 'side', 'long', 'spiky', 'messy'):
            cap = smooth(prim('uv_sphere', radius=0.66, location=(0, 0.06, 1.47), scale=(0.95, 0.92, 0.85), segments=48, ring_count=24), 1)
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.bisect(plane_co=(0, 0, 1.52), plane_no=(0, -0.35, 1), clear_inner=True)
            bpy.ops.object.mode_set(mode='OBJECT')
            assign(cap, hm)
        if hair_style == 'side':
            part = smooth(prim('uv_sphere', radius=0.3, location=(-0.3, -0.3, 1.78), scale=(1.2, 0.8, 0.5)), 1)
            assign(part, hm)
        if hair_style == 'long':
            back = smooth(prim('uv_sphere', radius=0.6, location=(0, 0.25, 1.05), scale=(1.05, 0.6, 1.2)), 1)
            assign(back, hm)
        if hair_style == 'spiky':
            for i in range(9):
                a = math.radians(-80 + i * 20)
                sp = prim('cone', radius1=0.17, radius2=0.0, depth=0.55, location=(0.5 * math.sin(a), 0.1 + 0.25 * math.cos(a), 1.85 - 0.1 * abs(math.sin(a))),
                          rotation=(math.radians(-25), math.radians(60 * math.sin(a)), 0))
                assign(sp, hm)
        if hair_style == 'messy':
            for i, (x, z) in enumerate(((-0.35, 1.9), (0.0, 2.0), (0.32, 1.92), (-0.15, 1.95), (0.18, 1.98))):
                tuft = smooth(prim('uv_sphere', radius=0.16, location=(x, -0.1, z)), 1)
                assign(tuft, hm)
    return head


def tie(color, z=0.5):
    t = prim('cone', radius1=0.09, radius2=0.04, depth=0.45, location=(0, -0.72, z), rotation=(math.radians(180 - 12), 0, 0))
    assign(t, mat('tie', hexc(color), 0.4))


def glasses(color='#222222'):
    m = mat('frames', hexc(color), 0.3, 0.5)
    for x in (-0.22, 0.22):
        g = smooth(prim('torus', major_radius=0.13, minor_radius=0.02, location=(x, -0.6, 1.42), rotation=(math.radians(90), 0, 0)), 0)
        assign(g, m)
    bridge = prim('cylinder', radius=0.015, depth=0.18, location=(0, -0.62, 1.44), rotation=(0, math.radians(90), 0))
    assign(bridge, m)


def lapels(color):
    for x in (-0.3, 0.3):
        lp = prim('cube', size=1, location=(x, -0.6, 0.35), scale=(0.25, 0.05, 0.55), rotation=(0, math.radians(-20 if x < 0 else 20), 0))
        assign(lp, mat(f'lap{x}', hexc(color), 0.5))


AVATARS = {
    # ---- bots (the six masks)
    'showman': dict(bg='#5b2a86', build=lambda: (
        figure('#f1c7a1', '#c0392b', hair='#3a2418', hair_style='cap', mouth='grin', brows=-10),
        assign(bevel(prim('cylinder', radius=0.42, depth=0.7, location=(0, 0.02, 2.2)), 0.02), mat('hat', hexc('#17151a'), 0.4)),
        assign(prim('cylinder', radius=0.75, depth=0.06, location=(0, 0.02, 1.86)), mat('brim', hexc('#17151a'), 0.4)),
        assign(prim('cylinder', radius=0.43, depth=0.12, location=(0, 0.02, 1.95)), mat('band', hexc('#f2c14e'), 0.3, 0.6)),
        lapels('#f2c14e'))),
    'diplomat': dict(bg='#2c6e8f', build=lambda: (
        figure('#e8b896', '#1f2a44', hair='#5a4636', hair_style='side', mouth='smile'),
        lapels('#16203a'), tie('#b23a48'))),
    'bookworm': dict(bg='#4f7a3a', build=lambda: (
        figure('#f0cba8', '#4c8c4a', hair='#7a4b2a', hair_style='cap', mouth='smile'),
        glasses('#3a2a1a'),
        assign(bevel(prim('cube', size=1, location=(0.55, -0.75, 0.35), scale=(0.5, 0.12, 0.65), rotation=(0, math.radians(-15), 0)), 0.03), mat('book', hexc('#a8653a'), 0.5)))),
    'professor': dict(bg='#6b5a45', build=lambda: (
        figure('#eac2a0', '#8a6f4e', hair=None, mouth='flat', brows=0),
        glasses('#c9a227'),
        assign(smooth(prim('uv_sphere', radius=0.45, location=(0, -0.3, 0.98), scale=(0.95, 0.6, 0.9)), 1), mat('beard', hexc('#e8e6e1'), 0.7)),
        [assign(smooth(prim('uv_sphere', radius=0.2, location=(x, 0.05, 1.5), scale=(0.6, 1, 0.9)), 1), mat(f'side{x}', hexc('#e8e6e1'), 0.7)) for x in (-0.58, 0.58)])),
    'underdog': dict(bg='#5b6470', build=lambda: (
        figure('#f3d0b2', '#8d949c', hair='#c08a4a', hair_style='messy', mouth='frown', brows=-18),
        assign(prim('cube', size=1, location=(0.33, -0.5, 1.28), scale=(0.18, 0.04, 0.07), rotation=(0, math.radians(25), 0)), mat('bandaid', hexc('#e9c6a0'), 0.6)),
        assign(smooth(prim('torus', major_radius=0.55, minor_radius=0.12, location=(0, 0.1, 1.85), rotation=(math.radians(10), 0, 0)), 1), mat('hood', hexc('#7a8189'), 0.7)))),
    'warlord': dict(bg='#7a2323', build=lambda: (
        figure('#d9a37f', '#8f1d1d', hair='#2a1a10', hair_style=None, mouth='flat', brows=20),
        assign(smooth(prim('uv_sphere', radius=0.68, location=(0, 0.04, 1.5), scale=(1, 0.95, 0.85)), 1), mat('helm', hexc('#8d949c'), 0.25, 0.9)),
        [assign(smooth(prim('cone', radius1=0.14, radius2=0.01, depth=0.6, location=(x, 0, 2.05), rotation=(0, math.radians(35 if x > 0 else -35), 0)), 0), mat(f'horn{x}', hexc('#efe6d2'), 0.4)) for x in (-0.6, 0.6)],
        [assign(smooth(prim('uv_sphere', radius=0.4, location=(x, -0.1, 0.55), scale=(1, 0.8, 0.6)), 1), mat(f'pad{x}', hexc('#8d949c'), 0.3, 0.8)) for x in (-0.75, 0.75)])),
    # ---- coaches (original characters)
    'kiyo': dict(bg='#2b3445', build=lambda: (
        figure('#f0d2b8', '#1d2a4a', hair='#3a2e2a', hair_style='side', mouth='flat', eyes='#3a2a4a'),
        lapels('#16213b'), tie('#9a2232'))),
    'lumen': dict(bg='#3d2f22', build=lambda: (
        figure('#f0cfb0', '#e8e4dc', hair='#8a5a33', hair_style='side', mouth='smile', eyes='#6a2020'),
        tie('#3a3f4a'),
        assign(smooth(prim('torus', major_radius=0.5, minor_radius=0.035, location=(0, 0.1, 2.2), rotation=(math.radians(15), 0, 0)), 0), mat('halo', hexc('#ffd56b'), 0.2, emission=hexc('#ffb52e'))))),
    'karasu': dict(bg='#2a1f2e', build=lambda: (
        figure('#ecd0bb', '#1a1a20', hair='#121216', hair_style='long', mouth='flat', eyes='#8a1a1a'),
        assign(smooth(prim('uv_sphere', radius=0.25, location=(0.85, -0.1, 0.95), scale=(0.9, 1.3, 0.9)), 1), mat('crow', hexc('#0e0e12'), 0.4, coat=0.6)),
        assign(smooth(prim('uv_sphere', radius=0.16, location=(0.85, -0.25, 1.25)), 1), mat('crowh', hexc('#0e0e12'), 0.4, coat=0.6)),
        assign(prim('cone', radius1=0.05, radius2=0.0, depth=0.22, location=(0.85, -0.45, 1.24), rotation=(math.radians(90), 0, 0)), mat('beak', hexc('#e2a34a'), 0.4)),
        assign(prim('uv_sphere', radius=0.025, location=(0.78, -0.37, 1.3)), mat('ceye', hexc('#dd3333'), 0.2, emission=hexc('#dd3333'))))),
    'tenka': dict(bg='#5a1e1e', build=lambda: (
        figure('#e6bfa0', '#7a1f1f', hair='#141418', hair_style='spiky', mouth='flat', brows=15),
        [assign(smooth(prim('uv_sphere', radius=0.42, location=(x, -0.05, 0.58), scale=(1, 0.8, 0.55)), 1), mat(f'arm{x}', hexc('#a32626'), 0.35, 0.3)) for x in (-0.75, 0.75)])),
    'flint': dict(bg='#2f5a4a', build=lambda: (
        figure('#f0caa8', '#f1f1ee', hair='#d8e8c8', hair_style='spiky', mouth='grin'),
        lapels('#dcdcd6'),
        [assign(smooth(prim('torus', major_radius=0.14, minor_radius=0.04, location=(x, -0.5, 1.8), rotation=(math.radians(70), 0, 0)), 0), mat(f'gog{x}', hexc('#e2a34a'), 0.3, 0.5)) for x in (-0.2, 0.2)],
        assign(prim('cylinder', radius=0.12, depth=0.04, location=(0.0, -0.58, 1.8), rotation=(math.radians(70), 0, 0), scale=(3.2, 1, 1)), mat('strap', hexc('#3a3f47'), 0.5)))),
    'shuji': dict(bg='#4a3b2a', build=lambda: (
        figure('#f0d0b4', '#c8a97a', hair='#4a3326', hair_style='messy', mouth='smile', eyes='#4a2a1a'),
        assign(smooth(prim('torus', major_radius=0.27, minor_radius=0.07, location=(0, 0, 0.8)), 1), mat('bandage', hexc('#f4f1ea'), 0.7)),
        lapels('#b0915f'))),
    'namenlos': dict(bg='#1e2a33', build=lambda: (
        figure('#f6e2d3', '#16171c', hair='#efe1a6', hair_style='side', mouth='flat', eyes='#3a6aa8'),
        lapels('#0e0f13'))),
}


if __name__ == '__main__':
    only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
    for name, spec in AVATARS.items():
        if only and name not in only:
            continue
        setup(spec['bg'])
        spec['build']()
        bpy.context.scene.render.filepath = os.path.join(OUT, f'{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
