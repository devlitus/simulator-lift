"""Añade la regadera y la animación `water` al granjero y reexporta el GLB.

Sobre `assets/granjero_texturizado.blend`:
1. Trae la regadera de `assets/regadera/regadera.blend` y la emparenta al
   hueso `hand.R` (agarre en la mano, pitorro hacia delante). El juego la
   oculta salvo mientras riega.
2. Crea la acción `water` (30 frames a 24 fps): brazo derecho al frente,
   inclina la regadera, la sostiene vertiendo y vuelve a reposo. Usa el
   mismo método que walk.py/idle.py (~/blender-mcp/granjero/): rotaciones
   absolutas en espacio de armature sobre la pose de reposo.
3. Rehace las pistas NLA (walk, idle, water), guarda el .blend y exporta
   `assets/granjero_texturizado.glb` y `public/models/granjero.glb`.

Convenciones del rig: el granjero mira hacia +Y; un pitch positivo en
`upper_arm.R` lleva el brazo hacia delante, y uno negativo en el pecho o la
cabeza los inclina hacia delante.

Ejecutar desde la raíz del repo:
blender --background assets/granjero_texturizado.blend --python assets/regadera/animar_riego.py
"""

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]

arm = bpy.data.objects["Rig"]
scene = bpy.context.scene
scene.render.fps = 24
ad = arm.animation_data or arm.animation_data_create()


def R_ejes(pitch=0.0, roll=0.0, yaw=0.0):
    q = Quaternion((0, 0, 1), math.radians(yaw))
    q = q @ Quaternion((0, 1, 0), math.radians(roll))
    q = q @ Quaternion((1, 0, 0), math.radians(pitch))
    return q


def poner_hueso(nombre, q_mundo, pos_mundo=None):
    pb = arm.pose.bones[nombre]
    M_rest = pb.bone.matrix_local
    M = q_mundo.to_matrix().to_4x4() @ M_rest
    M.translation = Vector(pos_mundo) if pos_mundo is not None else M_rest.translation
    pb.matrix = M
    bpy.context.view_layer.update()


def clave(nombre, f, pos=False):
    pb = arm.pose.bones[nombre]
    pb.keyframe_insert("rotation_quaternion", frame=f)
    if pos:
        pb.keyframe_insert("location", frame=f)


# ---------- Acción water ----------
for t in list(ad.nla_tracks):
    ad.nla_tracks.remove(t)
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()
if "water" in bpy.data.actions:
    bpy.data.actions.remove(bpy.data.actions["water"])
act = bpy.data.actions.new("water")
ad.action = act

# Claves: (frame, brazo, antebrazo, mano, pecho, cabeza). Rotaciones
# absolutas en grados de pitch. Reposo = pose de idle en su frame 1.
REPOSO = None
CLAVES = [
    (1, REPOSO),
    (8, (62, 78, 80, -6, -10)),  # brazo al frente, regadera horizontal
    (12, (62, 78, 42, -9, -16)),  # inclina: empieza a caer agua
    (17, (60, 76, 36, -10, -18)),  # vierte
    (22, (62, 78, 40, -10, -18)),  # vierte (leve vaivén)
    (26, (62, 78, 80, -6, -10)),  # endereza la regadera
    (31, REPOSO),
]
GRIP_FRAME = 8

for f, pose in CLAVES:
    poner_hueso("hips", R_ejes(pitch=1, roll=0.5), (0.006, 0.02, -0.42))
    clave("hips", f, pos=True)
    brazo, antebrazo, mano, pecho, cabeza = pose or (None, None, None, 0, 0)
    poner_hueso("spine", R_ejes(pitch=pecho * 0.4))
    clave("spine", f)
    poner_hueso("chest", R_ejes(pitch=pecho * 0.6))
    clave("chest", f)
    poner_hueso("neck", R_ejes())
    clave("neck", f)
    poner_hueso("head", R_ejes(pitch=cabeza))
    clave("head", f)
    for lado, s in (("R", 1), ("L", -1)):
        poner_hueso(f"upper_leg.{lado}", R_ejes(pitch=1))
        clave(f"upper_leg.{lado}", f)
        poner_hueso(f"lower_leg.{lado}", R_ejes(pitch=-2.5))
        clave(f"lower_leg.{lado}", f)
        poner_hueso(f"foot.{lado}", R_ejes(pitch=1.5))
        clave(f"foot.{lado}", f)
        poner_hueso(f"shoulder.{lado}", R_ejes(roll=s * -2))
        clave(f"shoulder.{lado}", f)
        if lado == "R" and pose:
            poner_hueso("upper_arm.R", R_ejes(pitch=brazo, roll=-4))
            poner_hueso("forearm.R", R_ejes(pitch=antebrazo, roll=-4))
            poner_hueso("hand.R", R_ejes(pitch=mano))
        else:
            poner_hueso(f"upper_arm.{lado}", R_ejes(roll=s * -6))
            poner_hueso(f"forearm.{lado}", R_ejes(pitch=6, roll=s * -4))
            poner_hueso(f"hand.{lado}", R_ejes())
        clave(f"upper_arm.{lado}", f)
        clave(f"forearm.{lado}", f)
        clave(f"hand.{lado}", f)

for layer in act.layers:
    for strip in layer.strips:
        for cb in strip.channelbags:
            for fc in cb.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.handle_left_type = "AUTO_CLAMPED"
                    kp.handle_right_type = "AUTO_CLAMPED"

# ---------- Regadera en la mano ----------
for nombre in ("Regadera", "spout_tip"):
    viejo = bpy.data.objects.get(nombre)
    if viejo:
        bpy.data.objects.remove(viejo, do_unlink=True)
with bpy.data.libraries.load(str(HERE / "regadera.blend")) as (src, dst):
    dst.objects = ["Regadera", "spout_tip"]
for ob in dst.objects:
    scene.collection.objects.link(ob)
can = bpy.data.objects["Regadera"]
spout = bpy.data.objects["spout_tip"]

# En la pose de agarre (regadera horizontal): agarre en la punta de la mano,
# pitorro (+X de la regadera) hacia delante (+Y) y asa hacia arriba.
scene.frame_set(GRIP_FRAME)
bpy.context.view_layer.update()
hand_tip = arm.matrix_world @ arm.pose.bones["hand.R"].tail
ESCALA = 0.33  # ~0.43 de alto: un cuarto del granjero, estilo cartoon
destino = (
    Matrix.Translation(hand_tip)
    @ Matrix.Rotation(math.pi / 2, 4, "Z")
    @ Matrix.Diagonal((ESCALA, ESCALA, ESCALA, 1))
)
can.parent = arm
can.parent_type = "BONE"
can.parent_bone = "hand.R"
bpy.context.view_layer.update()
can.matrix_world = destino
bpy.context.view_layer.update()

# ---------- NLA, guardado y exportación (como exportar.py) ----------
ad.action = None
for nombre in ("walk", "idle", "water"):
    track = ad.nla_tracks.new()
    track.name = nombre
    strip = track.strips.new(nombre, 1, bpy.data.actions[nombre])
    strip.name = nombre
    track.mute = True
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
scene.frame_set(1)

bpy.ops.wm.save_mainfile(filepath=str(REPO / "assets" / "granjero_texturizado.blend"))
for target in (
    REPO / "assets" / "granjero_texturizado.glb",
    REPO / "public" / "models" / "granjero.glb",
):
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_yup=True,
    )
print("EXPORT OK")
