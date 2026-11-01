"""Entrada de la granja reproducible: ejecutar con Blender 5.

blender --background --factory-startup --python assets/entrada_granja/generar.py

Arco de madera sobre dos postes con base de piedra, tejadillo a dos aguas, letrero
en la cumbrera, faroles, jardineras y dos hojas de cancela abiertas hacia dentro. Guarda
assets/entrada_granja.blend, exporta el GLB (fuente y publicado) y renderiza
preview.png. Ver README.md.
"""

import json
import math
import random
import shutil
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())

import bmesh
import bpy
from mathutils import Matrix, Vector

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "entrada_granja"
PUBLIC = ASSETS.parent / "public" / "models" / "entrada_granja.glb"
RNG = random.Random(1112029)

# Medidas (m). Suelo en z=0, el arco a lo largo de X y el exterior en -Y; las hojas
# se abren hacia +Y. Las colisiones de src/world/farmLayout.ts usan estas medidas.
POSTE_X = 1.75  # centro de cada poste
ALTO_POSTE = 3.3
ALTO_VIGA = 3.2
HOJA_X = 1.55  # plano de cada hoja abierta
HOJA_LARGO = 1.45
HOJA_ALTO = 1.25
LETRERO_Z = 4.35
JARDINERA_X = 2.3
JARDINERA_Y = -0.25

# Índices de material
OPACO, MADERA, PIEDRA, TEJAS, FAROL = range(5)

# Paleta en sRGB; se guarda en lineal en el atributo de color.
BLANCO = (1.0, 1.0, 1.0)
VIGA = (0.40, 0.26, 0.15)
TABLA = (0.72, 0.52, 0.32)
PINTURA = (0.55, 0.20, 0.15)  # el rojo del almacén
METAL = (0.20, 0.20, 0.22)
LLAMA = (1.0, 0.72, 0.35)
TIERRA = (0.30, 0.20, 0.12)
HOJA = (0.30, 0.55, 0.25)
FLORES = ((0.90, 0.35, 0.40), (0.95, 0.85, 0.35), (0.75, 0.50, 0.90), (0.95, 0.92, 0.85))


def lineal(c):
    return tuple(x**2.2 for x in c)


def variar(c, amt=0.08):
    f = 1 + RNG.uniform(-amt, amt)
    return tuple(min(1.0, x * f) for x in c)


class Malla:
    """Acumula piezas en un único bmesh con color, material y UV planas por cara."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")
        self.uv = self.bm.loops.layers.uv.new("UV")

    def _pintar(self, caras, color, mat, escala_uv=1.0):
        c = (*lineal(color), 1.0)
        for f in caras:
            f.material_index = mat
            f.normal_update()
            # Proyección según el eje dominante de la normal
            n = f.normal
            eje = max(range(3), key=lambda i: abs(n[i]))
            a, b = [(1, 2), (0, 2), (0, 1)][eje]
            for loop in f.loops:
                loop[self.col] = c
                p = loop.vert.co
                loop[self.uv].uv = (p[a] / escala_uv, p[b] / escala_uv)

    def caja(self, centro, medidas, color, rot=None, mat=OPACO, escala_uv=1.0):
        rot = rot or Matrix.Identity(3)
        o = Vector(centro)
        hx, hy, hz = (m / 2 for m in medidas)
        vs = [
            self.bm.verts.new(o + rot @ Vector((sx * hx, sy * hy, sz * hz)))
            for sx in (-1, 1)
            for sy in (-1, 1)
            for sz in (-1, 1)
        ]
        idx = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
        caras = [self.bm.faces.new([vs[i] for i in q]) for q in idx]
        self._pintar(caras, color, mat, escala_uv)

    def torno(self, centro, perfil, color, lados=12, mat=OPACO, escala_uv=1.0):
        """Sólido de revolución vertical; perfil: (radio, altura) de abajo arriba."""
        o = Vector(centro)
        anillos = [
            [
                self.bm.verts.new(
                    o + Vector((r * math.cos(2 * math.pi * i / lados), r * math.sin(2 * math.pi * i / lados), z))
                )
                for i in range(lados)
            ]
            for r, z in perfil
        ]
        caras = [self.bm.faces.new(list(reversed(anillos[0]))), self.bm.faces.new(anillos[-1])]
        for a, b in zip(anillos, anillos[1:]):
            caras += [
                self.bm.faces.new((a[i], a[(i + 1) % lados], b[(i + 1) % lados], b[i])) for i in range(lados)
            ]
        self._pintar(caras, color, mat, escala_uv)


def poste(m, x):
    """Tronco sobre base de piedra, con un farol colgado por el lado de fuera."""
    m.caja((x, 0, 0.3), (0.62, 0.62, 0.6), BLANCO, mat=PIEDRA, escala_uv=0.9)
    m.caja((x, 0, 0.64), (0.7, 0.7, 0.08), BLANCO, mat=PIEDRA, escala_uv=0.9)
    m.torno((x, 0, 0.66), ((0.2, 0), (0.18, 1.0), (0.17, ALTO_POSTE - 0.66)), BLANCO, lados=10, mat=MADERA)
    # Tornapuntas hacia la viga
    lado = -1 if x > 0 else 1
    giro = Matrix.Rotation(lado * math.radians(45), 3, "Y")
    m.caja((x + lado * 0.32, 0, ALTO_VIGA - 0.42), (0.1, 0.12, 0.9), variar(VIGA), giro)
    # Farol: brazo y caja de luz
    y = -0.24
    m.caja((x, y - 0.1, 2.25), (0.05, 0.28, 0.05), METAL)
    m.caja((x, y - 0.22, 2.17), (0.02, 0.02, 0.12), METAL)
    m.caja((x, y - 0.22, 2.0), (0.17, 0.17, 0.03), METAL)
    m.caja((x, y - 0.22, 1.9), (0.13, 0.13, 0.18), LLAMA, mat=FAROL)
    m.caja((x, y - 0.22, 1.79), (0.17, 0.17, 0.03), METAL)


def viga_y_tejado(m):
    largo = 2 * POSTE_X + 0.9
    m.caja((0, 0, ALTO_VIGA), (largo, 0.3, 0.3), BLANCO, mat=MADERA, escala_uv=1.2)
    for x in (-1.15, -0.4, 0.4, 1.15):
        m.caja((x, 0, ALTO_VIGA + 0.3), (0.1, 0.1, 0.32), variar(VIGA))
    # Dos aguas: faldones de tejas sobre correas, con la cumbrera a lo largo de X
    pendiente = math.radians(32)
    faldon = 1.0
    zc = ALTO_VIGA + 0.62
    for lado in (-1, 1):
        giro = Matrix.Rotation(lado * -pendiente, 3, "X")
        c = Vector((0, lado * faldon / 2 * math.cos(pendiente), zc - faldon / 2 * math.sin(pendiente)))
        m.caja(c, (largo + 0.4, faldon, 0.09), BLANCO, giro, TEJAS, 1.1)
        # Alero
        borde = Vector((0, lado * faldon * math.cos(pendiente), zc - faldon * math.sin(pendiente)))
        m.caja(borde + Vector((0, 0, -0.06)), (largo + 0.4, 0.08, 0.1), variar(VIGA))
    m.caja((0, 0, zc + 0.04), (largo + 0.5, 0.16, 0.1), variar(PINTURA, 0.05))
    # Hastiales con tablas
    for x in (-(largo / 2 + 0.05), largo / 2 + 0.05):
        m.caja((x, 0, ALTO_VIGA + 0.27), (0.05, 0.6, 0.26), variar(TABLA))


def letrero(m):
    """Letrero sobre la cumbrera, en el plano del arco y de cara al exterior (-Y), hacia
    la calle: el juego le pinta el nombre encima.
    """
    z = LETRERO_Z
    for x in (-0.5, 0.5):
        m.caja((x, 0, z - 0.36), (0.06, 0.06, 0.34), variar(VIGA))
    m.caja((0, 0, z), (1.5, 0.07, 0.62), variar(VIGA, 0.03))
    m.caja((0, 0, z), (1.38, 0.1, 0.5), variar(TABLA, 0.03))


def hoja(m, x):
    """Hoja de cancela abierta hacia dentro, con cruz de tablas."""
    y0, largo = 0.15, HOJA_LARGO
    yc = y0 + largo / 2
    n = 6
    for i in range(n):
        m.caja((x, y0 + (i + 0.5) * largo / n, HOJA_ALTO / 2 + 0.1), (0.05, largo / n - 0.03, HOJA_ALTO), variar(PINTURA, 0.07))
    for z in (0.28, HOJA_ALTO - 0.05):
        m.caja((x, yc, z), (0.07, largo, 0.1), BLANCO, mat=MADERA, escala_uv=0.7)
    diagonal = math.hypot(largo, HOJA_ALTO - 0.33)
    giro = Matrix.Rotation(math.atan2(HOJA_ALTO - 0.33, largo), 3, "X")
    m.caja((x, yc, (0.28 + HOJA_ALTO - 0.05) / 2), (0.07, diagonal, 0.08), BLANCO, giro, MADERA, 0.7)
    for z in (0.35, HOJA_ALTO - 0.1):
        m.caja((x, y0 - 0.02, z), (0.09, 0.14, 0.04), METAL)


def jardinera(m, x):
    y = JARDINERA_Y
    m.caja((x, y, 0.15), (0.72, 0.26, 0.3), BLANCO, mat=MADERA, escala_uv=0.7)
    m.caja((x, y, 0.31), (0.66, 0.2, 0.03), TIERRA)
    for i in range(7):
        dx = -0.28 + i * 0.094
        m.caja((x + dx, y + RNG.uniform(-0.05, 0.05), 0.4), (0.07, 0.06, 0.16), variar(HOJA, 0.2))
        m.torno(
            (x + dx, y + RNG.uniform(-0.05, 0.05), 0.46),
            ((0.02, 0), (0.06, 0.04), (0.02, 0.08)),
            FLORES[i % len(FLORES)],
            lados=6,
        )


def material(nombre, rugosidad, emision=None, fuerza=3.0):
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    attr = ns.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rugosidad
    if emision:
        bsdf.inputs["Emission Color"].default_value = (*lineal(emision), 1)
        bsdf.inputs["Emission Strength"].default_value = fuerza
    return mat


def material_textura(nombre, archivo):
    """Material con textura de ComfyUI reducida a 512 px para aligerar el GLB."""
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    tex = ns.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(OUT / archivo))
    img.scale(512, 512)
    img.pack()
    tex.image = img
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def construir():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = Malla()
    for lado in (-1, 1):
        poste(m, lado * POSTE_X)
        hoja(m, lado * HOJA_X)
        jardinera(m, lado * JARDINERA_X)
    viga_y_tejado(m)
    letrero(m)

    bmesh.ops.recalc_face_normals(m.bm, faces=m.bm.faces)
    malla = bpy.data.meshes.new("SM_EntradaGranja")
    m.bm.to_mesh(malla)
    m.bm.free()
    for mat in (
        material("M_Entrada", 0.8),
        material_textura("M_Madera", "madera.png"),
        material_textura("M_Piedra", "piedra.png"),
        material_textura("M_Tejas", "tejas.png"),
        material("M_Farol", 0.4, LLAMA, 1.0),
    ):
        malla.materials.append(mat)
    obj = bpy.data.objects.new("SM_EntradaGranja", malla)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def exportar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / "entrada_granja.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(destino),
        export_format="GLB",
        use_selection=True,
        export_image_format="JPEG",
    )
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC)

    metricas = {
        "triangulos": sum(len(p.vertices) - 2 for p in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "dimensiones_m": [round(d, 3) for d in obj.dimensions],
    }
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    print("METRICAS", metricas)


def preview():
    escena = bpy.context.scene
    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.0
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-30))
    escena.collection.objects.link(sol_obj)

    cam = bpy.data.cameras.new("Camara")
    cam.lens = 45
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (6, -8, 5)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0.3, 1.8))
    cam_obj.rotation_euler = (objetivo - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    mundo = bpy.data.worlds.new("Fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.75, 0.85, 0.72, 1)
    mundo.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    escena.world = mundo

    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 900
    escena.render.resolution_y = 800
    escena.render.filepath = str(OUT / "preview.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    entrada = construir()
    exportar(entrada)
    preview()
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "entrada_granja.blend"))
