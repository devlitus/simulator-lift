"""Tomás, el ganadero del rancho, reproducible: ejecutar con Blender 5.

blender --background --factory-startup --python assets/tomas/generar.py

Personaje chibi low-poly al estilo de Marta, Lila y Gon (cabeza grande,
cuerpo corto): sombrero vaquero de paja con cinta, pelo castaño con
patillas, bigote poblado, camisa roja de manga corta, peto vaquero con
tirantes y botones de latón, pañuelo amarillo al cuello y botas de cuero.
Modelado procedural propio (sin IA) con primitivas y un material plano por
color. Cara hacia +Y de Blender (convención del juego), pies en z=0.
Sin rig: Tomás no patrulla, se queda tras el mostrador del rancho.

Guarda assets/tomas.blend, exporta assets/models/tomas.glb (fuente) y la
copia publicada public/models/tomas.glb, y renderiza preview.png.
Blender termina con código 0 aunque el script falle: revisa la salida en
busca de `Traceback`.
"""

import json
import math
import shutil
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "tomas"
FUENTE = ASSETS / "models" / "tomas.glb"
PUBLIC = ASSETS.parent / "public" / "models" / "tomas.glb"


def lineal(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# Paleta en sRGB (0-1); el sombrero repite el color de las primitivas de la vista.
PIEL = (0.96, 0.78, 0.64)
MEJILLA = (0.93, 0.56, 0.52)
NARIZ = (0.92, 0.66, 0.54)
PELO = (0.36, 0.22, 0.13)
OJO = (0.10, 0.07, 0.06)
BRILLO = (1.0, 1.0, 1.0)
PAJA = (0.85, 0.72, 0.40)
PAJA_OSCURA = (0.70, 0.56, 0.28)
CINTA = (0.40, 0.24, 0.13)
CAMISA = (0.74, 0.22, 0.18)
CAMISA_OSCURA = (0.58, 0.16, 0.13)
VAQUERO = (0.27, 0.40, 0.60)
VAQUERO_OSCURO = (0.20, 0.30, 0.47)
LATON = (0.88, 0.70, 0.30)
PANUELO = (0.95, 0.75, 0.25)
BOTA = (0.42, 0.26, 0.15)
SUELA = (0.22, 0.14, 0.09)

_materiales = {}
partes = []


def material(color, rugosidad=0.8, metal=0.0):
    clave = (color, rugosidad, metal)
    if clave not in _materiales:
        mat = bpy.data.materials.new(f"M_Tomas_{len(_materiales):02d}")
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*lineal(color), 1)
        bsdf.inputs["Roughness"].default_value = rugosidad
        bsdf.inputs["Metallic"].default_value = metal
        _materiales[clave] = mat
    return _materiales[clave]


def _registrar(obj, color, suave=True, **kw):
    obj.data.materials.append(material(color, **kw))
    for p in obj.data.polygons:
        p.use_smooth = suave
    partes.append(obj)
    return obj


def esfera(centro, escala, color, rot=(0, 0, 0), seg=24, anillos=12, **kw):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=anillos, radius=1, location=centro)
    obj = bpy.context.object
    obj.scale = escala
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    return _registrar(obj, color, **kw)


def caja(centro, medidas, color, rot=(0, 0, 0), **kw):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro)
    obj = bpy.context.object
    obj.scale = medidas
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    # Un biselado leve suaviza las aristas sin perder la forma de caja
    mod = obj.modifiers.new("Bisel", "BEVEL")
    mod.width = min(medidas) * 0.3
    mod.segments = 2
    return _registrar(obj, color, suave=False, **kw)


def tubo(a, b, r1, r2, color, lados=20, **kw):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return _registrar(obj, color, **kw)


def anillo(centro, radio, grosor, color, escala=(1, 1, 1), rot=(0, 0, 0), **kw):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radio, minor_radius=grosor, major_segments=32, minor_segments=8, location=centro
    )
    obj = bpy.context.object
    obj.scale = escala
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    return _registrar(obj, color, **kw)


def recortar(obj, conservar):
    """Borra los vértices (en coordenadas de mundo) que no cumplen `conservar`."""
    bpy.context.view_layer.update()
    mw = obj.matrix_world
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    fuera = [v for v in bm.verts if not conservar(mw @ v.co)]
    bmesh.ops.delete(bm, geom=fuera, context="VERTS")
    bm.to_mesh(obj.data)
    bm.free()


# ---------- Cabeza (centro z=1.10, radio ~0.30) ----------
CABEZA = Vector((0, 0, 1.10))


def cabeza():
    esfera(CABEZA, (0.31, 0.29, 0.29), PIEL, seg=32, anillos=16)
    for s in (-1, 1):
        esfera((s * 0.30, -0.01, 1.08), (0.055, 0.035, 0.07), PIEL)  # orejas
        esfera((s * 0.10, 0.262, 1.12), (0.034, 0.02, 0.046), OJO, rot=(-8, 0, 0))
        esfera((s * 0.10 + 0.012, 0.279, 1.137), (0.011, 0.006, 0.011), BRILLO)
        esfera((s * 0.175, 0.225, 1.03), (0.05, 0.02, 0.032), MEJILLA, rot=(0, 0, s * 35))
        # Cejas pobladas, algo inclinadas hacia fuera
        caja((s * 0.10, 0.278, 1.2), (0.075, 0.02, 0.024), PELO, rot=(-20, s * -10, s * -8))
        # Bigote: dos mechones que caen hacia las comisuras
        esfera((s * 0.055, 0.285, 1.005), (0.065, 0.03, 0.03), PELO, rot=(0, s * 18, s * -12))
    esfera((0, 0.295, 1.06), (0.04, 0.035, 0.035), NARIZ)

    # Pelo: casquete más ancho que la cabeza, sin la parte de la cara
    pelo = esfera(CABEZA + Vector((0, -0.02, 0.02)), (0.322, 0.305, 0.30), PELO, seg=32, anillos=16)
    recortar(pelo, lambda co: co.y < 0.06 or co.z > 1.27)
    for s in (-1, 1):
        caja((s * 0.285, 0.07, 1.06), (0.04, 0.09, 0.15), PELO, rot=(0, 0, s * 8))  # patillas


def sombrero():
    # Sombrero vaquero de paja, inclinado un poco atrás para que se vea la cara
    rot = (-10, 0, 0)
    base = Vector((0, -0.02, 1.29))
    ala = tubo(base, base + Vector((0, 0, 0.025)), 0.47, 0.47, PAJA, lados=40)
    ala.scale = (1.0, 0.86, 1.0)
    # Bordes del ala doblados hacia arriba a los lados
    anillo(base + Vector((0, 0, 0.03)), 0.455, 0.028, PAJA_OSCURA, escala=(1.0, 0.86, 1.0))
    tubo(base, base + Vector((0, 0, 0.22)), 0.235, 0.205, PAJA, lados=32)
    esfera(base + Vector((0, 0, 0.22)), (0.205, 0.19, 0.045), PAJA)  # tapa abombada
    tubo(base + Vector((0, 0, 0.02)), base + Vector((0, 0, 0.075)), 0.238, 0.232, CINTA, lados=32)
    bpy.context.view_layer.update()
    giro = (
        Matrix.Translation(base)
        @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
        @ Matrix.Translation(-base)
    )
    for obj in partes[-5:]:
        obj.matrix_world = giro @ obj.matrix_world


# ---------- Cuerpo ----------
def cuerpo():
    # Torso de camisa roja, algo barrigón
    esfera((0, 0, 0.60), (0.235, 0.20, 0.24), CAMISA)
    tubo((0, 0, 0.79), (0, 0, 0.86), 0.09, 0.085, PIEL)  # cuello
    # Pañuelo anudado: anillo y pico delantero
    anillo((0, 0.01, 0.815), 0.105, 0.035, PANUELO)
    esfera((0, 0.115, 0.765), (0.06, 0.03, 0.06), PANUELO, rot=(0, 45, 0))

    # Peto vaquero: pantalón (cadera) y babero con tirantes
    esfera((0, 0, 0.44), (0.245, 0.21, 0.17), VAQUERO)
    tubo((0, 0, 0.42), (0, 0, 0.53), 0.25, 0.238, VAQUERO, lados=32)
    caja((0, 0.178, 0.6), (0.24, 0.05, 0.2), VAQUERO, rot=(-12, 0, 0))
    caja((0, 0.205, 0.6), (0.11, 0.012, 0.07), VAQUERO_OSCURO, rot=(-12, 0, 0))  # bolsillo
    for s in (-1, 1):
        caja((s * 0.09, 0.12, 0.735), (0.04, 0.12, 0.022), VAQUERO, rot=(-35, 0, 0))
        caja((s * 0.09, -0.12, 0.66), (0.04, 0.06, 0.2), VAQUERO, rot=(18, 0, 0))  # tirantes por detrás
        esfera((s * 0.09, 0.2, 0.69), (0.022, 0.012, 0.022), LATON, rugosidad=0.4, metal=0.6)
    anillo((0, 0, 0.405), 0.245, 0.018, VAQUERO_OSCURO, escala=(1, 0.86, 1))  # costura de la cintura

    # Piernas y botas
    for s in (-1, 1):
        tubo((s * 0.11, 0, 0.36), (s * 0.115, 0.0, 0.13), 0.085, 0.078, VAQUERO)
        anillo((s * 0.115, 0, 0.14), 0.08, 0.02, VAQUERO_OSCURO)  # dobladillo
        tubo((s * 0.115, 0, 0.16), (s * 0.115, 0, 0.05), 0.075, 0.08, BOTA)
        esfera((s * 0.115, 0.04, 0.06), (0.085, 0.13, 0.065), BOTA)
        tubo((s * 0.115, 0.03, 0.0), (s * 0.115, 0.03, 0.018), 0.09, 0.09, SUELA)
    # Las botas no bajan de z=0: el pie de la esfera se recorta
    for obj in partes[-15:]:
        recortar(obj, lambda co: co.z > -0.0001)


def brazos():
    for s in (-1, 1):
        hombro = Vector((s * 0.215, 0, 0.73))
        mano = Vector((s * 0.33, 0.05, 0.43))
        esfera(hombro, (0.095, 0.095, 0.09), CAMISA)  # manga abombada
        anillo(hombro + (mano - hombro) * 0.22, 0.072, 0.02, CAMISA_OSCURA, rot=(0, s * 22, 0))
        tubo(hombro + (mano - hombro) * 0.2, mano, 0.058, 0.05, PIEL)
        esfera(mano, (0.065, 0.055, 0.07), PIEL)


def construir():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cuerpo()
    brazos()
    cabeza()
    sombrero()

    bpy.ops.object.select_all(action="DESELECT")
    for obj in partes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = partes[0]
    bpy.ops.object.convert(target="MESH")  # aplica biseles
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = obj.data.name = "SM_Tomas"
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")  # origen entre los pies
    return obj


def exportar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    FUENTE.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(FUENTE), export_format="GLB", use_selection=True)
    shutil.copyfile(FUENTE, PUBLIC)

    metricas = {
        "triangulos": sum(len(p.vertices) - 2 for p in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "materiales": len(obj.data.materials),
        "dimensiones_m": [round(d, 3) for d in obj.dimensions],
    }
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    print("METRICAS", metricas)


def preview():
    escena = bpy.context.scene
    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.5
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(25))
    escena.collection.objects.link(sol_obj)

    cam = bpy.data.cameras.new("Camara")
    cam.lens = 60
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (1.6, 3.6, 1.9)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0, 0.8))
    cam_obj.rotation_euler = (objetivo - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    mundo = bpy.data.worlds.new("Fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.08, 0.09, 0.11, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.5
    escena.world = mundo

    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 800
    escena.render.resolution_y = 1000
    escena.render.filepath = str(OUT / "preview.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    tomas = construir()
    exportar(tomas)
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "tomas.blend"))
    preview()
