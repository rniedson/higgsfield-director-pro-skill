# Paints each face with the colour of the bone that moves it and renders 4 views at rest and 2 in a test pose.
# Usage: blender -b --factory-startup --python-exit-code 1 -P render_pieces_by_bone.py -- file.glb out_folder [--gray]
# With --gray it keeps the file's own materials (the gray of the pieces and of the joints) instead of one colour per bone.
import bpy, sys, os, math, colorsys
from collections import Counter
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; glb, out = a[0], a[1]; os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o.parent is None and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.vertex_groups)
if arm.animation_data: arm.animation_data_clear()
for pb in arm.pose.bones: pb.matrix_basis.identity()
idx = {g.index: g.name for g in body.vertex_groups}
me = body.data
vb = [max(v.groups, key=lambda g: g.weight).group if v.groups else -1 for v in me.vertices]
count = Counter(idx.get(b, '-') for b in vb)
print("VERTS " + str(dict(sorted(count.items()))))
names = [b.name for b in arm.data.bones if b.use_deform]
mats = {}
for i, n in enumerate(names):
    h = (i * 0.618) % 1.0; s = 0.55 + 0.35 * (i % 2); vv = 0.95 - 0.25 * ((i // 2) % 2)
    m = bpy.data.materials.new(n); m.use_nodes = True
    p = next(x for x in m.node_tree.nodes if x.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (*colorsys.hsv_to_rgb(h, s, vv), 1); p.inputs['Roughness'].default_value = 0.7
    mats[n] = m
if '--gray' not in a:
    me.materials.clear()
    for n in names: me.materials.append(mats[n])
    slot = {n: i for i, n in enumerate(names)}
    for f in me.polygons:
        c = Counter(idx.get(vb[v], names[0]) for v in f.vertices).most_common(1)[0][0]
        f.material_index = slot.get(c, 0)
me.polygons.foreach_set("use_smooth", [False] * len(me.polygons))
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'; sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x = 500; sc.render.resolution_y = 900; sc.render.film_transparent = True
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[1].default_value = 0.35
ctr = Vector((0, 0, 0.88)); H = 1.80
def lamp(n, loc, e):
    l = bpy.data.lights.new(n, 'AREA'); l.energy = e; l.size = 4; ob = bpy.data.objects.new(n, l); sc.collection.objects.link(ob)
    ob.location = ctr + Vector(loc); ob.rotation_euler = (ctr - ob.location).to_track_quat('-Z', 'Y').to_euler()
lamp('key', (2, -4, 3), 260); lamp('fill', (-3, -2, 1), 90); lamp('rim', (0, 4, 3), 160)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = H * 1.08
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
def shoot(name, az):
    r = math.radians(az); cam.location = ctr + Vector((math.sin(r) * 10, -math.cos(r) * 10, 0))
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, f'{name}.png'); bpy.ops.render.render(write_still=True)
for name, az in [('1_front', 0), ('2_three_quarter', 45), ('3_side', 90), ('4_back', 180)]: shoot(name, az)
# test pose: turns each bone about a world axis, through its head (parents before children)
def turn(name, axis, degrees):
    if name not in arm.pose.bones: print("NO BONE", name); return
    pb = arm.pose.bones[name]; bpy.context.view_layer.update()
    hd = (arm.matrix_world @ pb.matrix).translation
    R = Matrix.Translation(hd) @ Matrix.Rotation(math.radians(degrees), 4, Vector(axis)) @ Matrix.Translation(-hd)
    pb.matrix = arm.matrix_world.inverted() @ R @ arm.matrix_world @ pb.matrix
    bpy.context.view_layer.update()
# in Blender the character faces -Y and +X is its left
turn('Spine_01', (1, 0, 0), 12); turn('Spine_03', (0, 0, 1), 15)           # leans forward, chest turns
turn('Neck', (1, 0, 0), 10); turn('Head', (0, 0, 1), 30)
turn('Clavicle_R', (0, 1, 0), 8)
turn('UpperArm_R', (1, 0, 0), -95); turn('LowerArm_R', (1, 0, 0), -70)    # right arm forward, forearm up
turn('UpperArm_L', (0, 1, 0), -55); turn('LowerArm_L', (1, 0, 0), -45)    # left arm out to the side
turn('Thigh_L', (1, 0, 0), -75); turn('Calf_L', (1, 0, 0), 95); turn('Foot_L', (1, 0, 0), -20)   # knee up
turn('Thigh_R', (0, 1, 0), -12)
sc.render.resolution_x = 900   # square, so arms held out to the side stay in the frame
for name, az in [('5_pose_three_quarter', 35), ('6_pose_side', 90)]: shoot(name, az)
print("OK")
