"""Modela la regadera low-poly en Blender a partir de regadera_referencia.png.

Pieza sencilla hecha con primitivas y colores planos (sin Hunyuan3D): cuerpo
cilíndrico verde salvia con aros más oscuros, asa arqueada, pitorro y
alcachofa de latón. El origen queda en el agarre del asa (para colgarla de
la mano del granjero) y el empty `spout_tip` marca la salida del agua.
Ejes Blender: el pitorro apunta a +X y el asa queda arriba (+Z).

Ejecutar desde la raíz del repo:
blender --background --factory-startup --python assets/regadera/modelar_regadera.py
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, rgb, metallic=0.0, roughness=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def srgb(r, g, b):
    # Colores medidos en la referencia (sRGB) → lineales para el BSDF
    to_lin = lambda c: (c / 12.92) if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(to_lin(c / 255) for c in (r, g, b))


VERDE = material("regadera_verde", srgb(132, 168, 122))
VERDE_OSCURO = material("regadera_verde_oscuro", srgb(76, 118, 80))
INTERIOR = material("regadera_interior", srgb(52, 78, 54))
LATON = material("regadera_laton", srgb(214, 170, 72), metallic=0.6, roughness=0.45)

parts = []


def add(obj, mat):
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj


def cylinder_between(a, b, r1, r2, mat, verts=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(
        vertices=verts, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2
    )
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return add(obj, mat)


# Cuerpo: cilindro algo más estrecho arriba
bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.5, radius2=0.46, depth=0.9, location=(0, 0, 0.45))
add(bpy.context.object, VERDE)

# Aros del borde inferior y superior, y la boca oscura
for z, r in ((0.03, 0.5), (0.9, 0.46)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.035, major_segments=24, minor_segments=6, location=(0, 0, z))
    add(bpy.context.object, VERDE_OSCURO)
bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.42, depth=0.01, location=(0, 0, 0.905))
add(bpy.context.object, INTERIOR)

# Asa: medio toro vertical en el plano XZ sobre el cuerpo
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.42, minor_radius=0.05, major_segments=24, minor_segments=8,
    location=(-0.05, 0, 0.88), rotation=(math.pi / 2, 0, 0),
)
handle = add(bpy.context.object, VERDE)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for v in handle.data.vertices:
    v.select = (handle.matrix_world @ v.co).z < 0.88
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")

# Pitorro: del lateral bajo del cuerpo hacia arriba y adelante (+X)
base = (0.42, 0, 0.22)
tip = (1.05, 0, 0.78)
cylinder_between(base, tip, 0.1, 0.05, VERDE)

# Alcachofa: cono que se abre en la punta y disco de latón
d = (Vector(tip) - Vector(base)).normalized()
rose_end = Vector(tip) + d * 0.16
cylinder_between(tip, rose_end, 0.06, 0.15, VERDE)
cylinder_between(rose_end, rose_end + d * 0.02, 0.15, 0.15, LATON)

# Unir en un solo objeto con sombreado plano (estilo low-poly)
bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
can = bpy.context.object
can.name = "Regadera"
bpy.ops.object.shade_flat()

# Origen en el agarre: punto más alto del asa
grip = Vector((-0.05, 0, 0.88 + 0.42))
bpy.context.scene.cursor.location = grip
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
can.location = (0, 0, 0)

# Salida del agua, hija de la regadera
spout = bpy.data.objects.new("spout_tip", None)
spout.empty_display_size = 0.05
bpy.context.scene.collection.objects.link(spout)
spout.parent = can
spout.location = rose_end + d * 0.03 - grip

blend_path = HERE / "regadera.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
# El juego no la carga suelta: animar_riego.py la emparenta a la mano del
# granjero y viaja dentro de granjero.glb. Este GLB es solo la pieza fuente.
bpy.ops.export_scene.gltf(filepath=str(REPO / "assets" / "regadera.glb"), export_format="GLB")
print("ok", len(can.data.polygons), "caras")
