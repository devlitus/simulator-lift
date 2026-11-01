"""Props del escenario modelados por script en Blender (low-poly, deterministas).

"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python assets/escenario/generar.py

Genera assets/escenario.blend y assets/escenario.glb (copia en
public/models/escenario.glb). Cada prop es un grupo de objetos con prefijo
común (`Roca_01`, `Pino_tronco`/`Pino_copa`…), con las transformaciones
aplicadas y el origen en la base: el juego los repite con thin instances.
`Colinas` es la única malla que se coloca tal cual (anillo del horizonte).
"""

import math
import random
import shutil
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())

import bmesh
import bpy
from mathutils import Vector, noise

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent
PUBLIC = ASSETS.parent / "public" / "models"
RNG = random.Random(2610010031)

# Escena vacía antes de crear materiales (se crean al importar el módulo)
bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------- utilidades ----------


def material(nombre, color, rugosidad=0.9, textura=None):
    # Los colores se escriben en sRGB (como en un selector); Blender y glTF
    # trabajan en lineal.
    color = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in color)
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rugosidad
    bsdf.inputs["Metallic"].default_value = 0.0
    if textura:
        tex = ns.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(HERE / textura))
        tex.image.pack()
        # El color del material tiñe la textura (glTF: baseColorFactor × textura)
        mix = ns.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = (*color, 1)
        links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return mat


def objeto(nombre, bm, mat, plano=True):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = not plano
    obj = bpy.data.objects.new(nombre, me)
    bpy.context.collection.objects.link(obj)
    return obj


def uv_caja(bm, escala=1.0):
    """Proyección de caja por cara según la normal dominante."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        eje = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = loop.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][eje]
            loop[uv].uv = (u * escala, v * escala)


def deformar(bm, amp, frec, semilla):
    off = Vector((semilla * 3.1, semilla * 7.7, semilla * 1.3))
    for v in bm.verts:
        n = noise.noise(v.co * frec + off)
        v.co += v.co.normalized() * n * amp if v.co.length > 1e-5 else Vector()


def apoyar(bm):
    """Base en z=0 (el origen queda en el suelo)."""
    zmin = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= zmin


# ---------- props ----------

MAT_ROCA = material("M_Roca", (0.92, 0.9, 0.86), 0.95, "roca.png")
MAT_MUSGO = material("M_Musgo", (0.42, 0.58, 0.27))
MAT_HOJA = [
    material("M_Hoja_A", (0.24, 0.5, 0.2)),
    material("M_Hoja_B", (0.33, 0.58, 0.22)),
]
MAT_HIERBA = material("M_Hierba", (0.36, 0.62, 0.24))
MAT_TALLO = material("M_Tallo", (0.3, 0.52, 0.2))
MAT_FLOR = {
    "Blanca": material("M_Flor_Blanca", (0.96, 0.95, 0.9)),
    "Amarilla": material("M_Flor_Amarilla", (0.98, 0.8, 0.22)),
    "Malva": material("M_Flor_Malva", (0.72, 0.5, 0.88)),
}
MAT_CORAZON = material("M_Flor_Corazon", (0.95, 0.7, 0.15))
MAT_MADERA = material("M_Madera", (0.5, 0.36, 0.22))
MAT_TRONCO = material("M_Tronco_Pino", (0.36, 0.24, 0.15))
MAT_PINO = material("M_Pino", (0.16, 0.36, 0.2))


def roca(nombre, tam, aplastar, semilla):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    deformar(bm, 0.28, 1.4, semilla)
    for v in bm.verts:
        v.co.x *= tam[0]
        v.co.y *= tam[1]
        v.co.z *= tam[2] * (aplastar if v.co.z < 0 else 1.0)
    apoyar(bm)
    # Medio hundida en el suelo: recorta lo que queda bajo z=0.15·alto
    alto = max(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= alto * 0.15
    bm.normal_update()
    uv_caja(bm, 0.6)
    return objeto(nombre, bm, MAT_ROCA)


def arbusto(nombre, bolas, semilla):
    rng = random.Random(semilla)
    piezas = []
    for i, (x, y, z, r) in enumerate(bolas):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        deformar(bm, r * 0.18, 2.0, semilla + i)
        bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((x, y, z)))
        bm.normal_update()
        piezas.append(objeto(f"{nombre}_{i}", bm, MAT_HOJA[rng.randrange(2)]))
    return unir(nombre, piezas)


def unir(nombre, piezas):
    bpy.ops.object.select_all(action="DESELECT")
    for p in piezas:
        p.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = nombre
    obj.data.name = nombre
    return obj


def hoja(bm, base, angulo, inclinacion, largo, ancho):
    """Brizna triangular con un pliegue central (dos triángulos)."""
    d = Vector((math.cos(angulo), math.sin(angulo), 0))
    lado = Vector((-d.y, d.x, 0)) * ancho
    punta = base + d * largo * math.sin(inclinacion) + Vector((0, 0, largo * math.cos(inclinacion)))
    centro = base + d * 0.01 + Vector((0, 0, largo * 0.35))
    v = [bm.verts.new(p) for p in (base - lado, base + lado, punta, centro)]
    bm.faces.new((v[0], v[3], v[2]))
    bm.faces.new((v[3], v[1], v[2]))


def mata_hierba(nombre, briznas, alto, semilla):
    rng = random.Random(semilla)
    bm = bmesh.new()
    for i in range(briznas):
        ang = i / briznas * math.tau + rng.uniform(-0.3, 0.3)
        base = Vector((math.cos(ang), math.sin(ang), 0)) * rng.uniform(0.0, 0.06)
        hoja(bm, base, ang, rng.uniform(0.25, 0.7), alto * rng.uniform(0.65, 1.0), 0.035)
    bm.normal_update()
    return objeto(nombre, bm, MAT_HIERBA)


def flores(nombre, color, semilla):
    rng = random.Random(semilla)
    tallos, petalos, corazones = bmesh.new(), bmesh.new(), bmesh.new()
    for i in range(5):
        ang = rng.uniform(0, math.tau)
        x, y = math.cos(ang) * rng.uniform(0.02, 0.14), math.sin(ang) * rng.uniform(0.02, 0.14)
        h = rng.uniform(0.22, 0.38)
        bmesh.ops.create_cone(
            tallos, cap_ends=False, segments=4, radius1=0.012, radius2=0.008, depth=h,
            matrix=_mat(Vector((x, y, h / 2))),
        )
        hoja(tallos, Vector((x, y, h * 0.3)), ang, 1.0, 0.09, 0.025)
        # Corola: disco de 6 pétalos (abanico) y botón central
        bmesh.ops.create_circle(petalos, cap_ends=True, segments=6, radius=0.055, matrix=_mat(Vector((x, y, h))))
        bmesh.ops.create_icosphere(corazones, subdivisions=1, radius=0.022, matrix=_mat(Vector((x, y, h + 0.01))))
    piezas = [
        objeto(f"{nombre}_tallos", tallos, MAT_TALLO),
        objeto(f"{nombre}_petalos", petalos, MAT_FLOR[color]),
        objeto(f"{nombre}_corazon", corazones, MAT_CORAZON),
    ]
    for p in piezas:
        p.data.update()
    return unir(nombre, piezas)


def _mat(t):
    from mathutils import Matrix

    return Matrix.Translation(t)


def pino(nombre, alto, semilla):
    rng = random.Random(semilla)
    tronco = bmesh.new()
    bmesh.ops.create_cone(
        tronco, cap_ends=True, segments=6, radius1=0.22, radius2=0.14, depth=alto * 0.3,
        matrix=_mat(Vector((0, 0, alto * 0.15))),
    )
    copa = bmesh.new()
    pisos = 3
    for i in range(pisos):
        t = i / pisos
        r = (1.0 - t * 0.55) * alto * 0.24
        h = alto * (0.42 - t * 0.08)
        z = alto * (0.2 + t * 0.27)
        bmesh.ops.create_cone(
            copa, cap_ends=True, segments=7, radius1=r, radius2=0.0, depth=h,
            matrix=_mat(Vector((0, 0, z + h / 2))),
        )
    deformar(copa, alto * 0.02, 0.8, semilla)
    for v in copa.verts:
        v.co.x += rng.uniform(-0.04, 0.04)
    piezas = [objeto(f"{nombre}_tronco", tronco, MAT_TRONCO), objeto(f"{nombre}_copa", copa, MAT_PINO)]
    return unir(nombre, piezas)


def tramo_valla(nombre, largo=2.0):
    """Un poste en x=0 y dos travesaños hacia +x: los tramos se encadenan."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=_escala(Vector((0, 0, 0.5))), calc_uvs=False)
    for v in bm.verts:
        v.co.x *= 0.16
        v.co.y *= 0.16
        v.co.z *= 1.0
    for z in (0.4, 0.75):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        for v in tmp.verts:
            v.co.x = v.co.x * largo + largo / 2
            v.co.y *= 0.08
            v.co.z = v.co.z * 0.1 + z
        me = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    bm.normal_update()
    return objeto(nombre, bm, MAT_MADERA)


def _escala(t):
    from mathutils import Matrix

    return Matrix.Translation(t)


def colinas(nombre, lado=260.0, n=104, borde=34.0):
    """Terreno del horizonte: llano dentro del mapa y colinas suaves fuera.

    La distancia es cuadrada (max(|x|,|y|)) porque el mapa es cuadrado. Lleva
    UV en metros/4 para repetir la textura del césped y color por vértice
    para oscurecer las laderas lejanas.
    """
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=n, y_segments=n, size=lado / 2)
    col = bm.loops.layers.color.new("Col")
    uv = bm.loops.layers.uv.new("UVMap")
    for v in bm.verts:
        d = max(abs(v.co.x), abs(v.co.y))
        t = max(0.0, min(1.0, (d - borde) / 50.0))
        t = t * t * (3 - 2 * t)
        ondas = noise.noise(Vector((v.co.x * 0.035, v.co.y * 0.035, 0.5))) * 0.5 + 0.5
        detalle = noise.noise(Vector((v.co.x * 0.11, v.co.y * 0.11, 2.5))) * 0.5 + 0.5
        v.co.z = t * (4.0 + ondas * 16.0 + detalle * 3.0) - 0.06
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (co.x / 4.0, co.y / 4.0)
            altura = max(0.0, min(1.0, co.z / 22.0))
            sombra = 0.92 - altura * 0.18 + noise.noise(co * 0.07) * 0.06
            loop[col] = (sombra * 0.95, sombra, sombra * 0.9, 1.0)
    bm.normal_update()
    obj = objeto(nombre, bm, material("M_Colinas", (1, 1, 1)), plano=False)
    return obj


# ---------- escena ----------


def main():
    rocas = [
        roca("Roca_01", (0.55, 0.45, 0.4), 0.6, 1),
        roca("Roca_02", (0.9, 0.7, 0.55), 0.5, 2),
        roca("Roca_03", (0.35, 0.3, 0.22), 0.6, 3),
    ]
    arbustos = [
        arbusto("Arbusto_01", [(0, 0, 0.45, 0.55), (0.4, 0.15, 0.35, 0.4), (-0.35, -0.1, 0.32, 0.42), (0.05, -0.3, 0.3, 0.35)], 11),
        arbusto("Arbusto_02", [(0, 0, 0.35, 0.42), (0.3, 0.2, 0.28, 0.32), (-0.25, 0.2, 0.25, 0.3)], 12),
    ]
    matas = [mata_hierba("Hierba_01", 9, 0.38, 21), mata_hierba("Hierba_02", 7, 0.28, 22)]
    flor = [flores(f"Flores_{c}", c, 30 + i) for i, c in enumerate(MAT_FLOR)]
    pinos = [pino("Pino_01", 6.0, 41), pino("Pino_02", 4.5, 42)]
    valla = tramo_valla("Valla_Tramo")
    horizonte = colinas("Colinas")

    # Separación visual en el .blend fuente (el juego no usa estas posiciones)
    todos = rocas + arbustos + matas + flor + pinos + [valla]
    for i, o in enumerate(todos):
        o.location = (i * 2.5 - 15, -40, 0)
    horizonte.location = (0, 0, 0)

    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "escenario.blend"))

    # Para exportar, cada prop vuelve al origen (el juego coloca las copias)
    for o in todos:
        o.location = (0, 0, 0)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(ASSETS / "escenario.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
    )
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy(ASSETS / "escenario.glb", PUBLIC / "escenario.glb")
    for o in todos + [horizonte]:
        tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
        print(f"{o.name}: {tris} triángulos")
    print("ok", ASSETS / "escenario.glb")


main()
