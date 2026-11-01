"""Exteriores de las tres tiendas del mercado: ejecutar con Blender 5.

blender --background --factory-startup --python assets/tiendas/generar.py

Tienda de entramado con el hastial a la calle: zócalo de piedra, revoco con
vigas vistas, tejado de tejas, puerta con farol, dos escaparates con toldo a
rayas y el género de cada tienda expuesto delante. Un letrero en blanco en el
hastial que el juego rotula. Las tres comparten estructura y cambian el color
del toldo, la pintura, el revoco y el género (piezas.py). Modelado procedural
(sin IA) con colores planos en el atributo `Col`. Guarda
assets/tiendas.blend, exporta tienda_<tipo>.glb (fuente y publicado) y
renderiza un preview de cada una. Ver README.md.
"""

import json
import math
import shutil
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())
sys.path.insert(0, str(Path(__file__).resolve().parent))

import bmesh
import bpy
from mathutils import Matrix, Vector

import piezas as p
from piezas import CRISTAL, LUZ, Malla

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "tiendas"
PUBLIC = ASSETS.parent / "public" / "models"

# Medidas (m). Puerta en -Y de Blender (+Z en Babylon), base en z=0. Las
# colisiones, la puerta y el letrero de src/world/marketLayout.ts las usan.
ANCHO = 6.0  # eje x, fachada
FONDO = 4.6  # eje y
ZOCALO = 0.3
ALTO = 3.0  # del suelo al alero
SUBIDA = 1.8  # del alero a la cumbrera
VUELO = 0.4
PENDIENTE = math.atan2(SUBIDA, ANCHO / 2)
GRUESO = 0.2  # muro
PUERTA = (-0.55, 0.55, ZOCALO, 2.3)
ESCAPARATES = ((-2.45, -1.05, 0.95, 2.15), (1.05, 2.45, 0.95, 2.15))
LETRERO = {"z": ALTO + 0.62, "ancho": 2.0, "alto": 0.6, "y": -FONDO / 2 - 0.14, "grueso": 0.06}
Y_FRENTE = -FONDO / 2


class Fachada:
    """Marco local de un muro: u a lo largo, o hacia fuera, z arriba."""

    def __init__(self, m, origen, u, fuera):
        self.m = m
        self.o = Vector(origen)
        self.rot = Matrix((u, fuera, (0, 0, 1))).transposed()

    def caja(self, cu, co, cz, su, so, sz, color, mat=p.OPACO):
        self.m.caja(self.o + self.rot @ Vector((cu, co, cz)), (su, so, sz), color, self.rot, mat)


def muro(f, largo, huecos, revoco):
    """Paños de revoco alrededor de los huecos y vigas del entramado encima."""
    xs = sorted({-largo / 2, largo / 2, *[h[0] for h in huecos], *[h[1] for h in huecos]})
    for a, b in zip(xs, xs[1:]):
        cortes = [(ZOCALO, ALTO)]
        for h0, h1, z0, z1 in huecos:
            if h0 <= a and b <= h1:
                cortes = [(c0, c1) for c0, c1 in cortes for c0, c1 in ((c0, min(c1, z0)), (max(c0, z1), c1)) if c1 - c0 > 0.01]
        for z0, z1 in cortes:
            f.caja((a + b) / 2, -GRUESO / 2, (z0 + z1) / 2, b - a, GRUESO, z1 - z0, revoco)
    viga = lambda cu, cz, su, sz: f.caja(cu, 0.02, cz, su, 0.06, sz, p.variar(p.VIGA, 0.06))
    viga(0, ZOCALO + 0.07, largo, 0.14)  # durmiente
    viga(0, ALTO - 0.08, largo + 0.1, 0.16)  # carrera
    for x in (-largo / 2 + 0.07, largo / 2 - 0.07):
        viga(x, (ZOCALO + ALTO) / 2, 0.14, ALTO - ZOCALO)
    for h0, h1, z0, z1 in huecos:
        for x in (h0 - 0.06, h1 + 0.06):
            viga(x, (ZOCALO + ALTO) / 2, 0.12, ALTO - ZOCALO)
        viga((h0 + h1) / 2, z1 + 0.07, h1 - h0 + 0.24, 0.14)
        if z0 > ZOCALO + 0.1:
            viga((h0 + h1) / 2, z0 - 0.06, h1 - h0 + 0.24, 0.12)


def aspas(f, x0, x1, revoco):
    """Cruz de San Andrés en un paño ciego del muro lateral."""
    largo = math.hypot(x1 - x0, ALTO - ZOCALO - 0.3)
    ang = math.atan2(ALTO - ZOCALO - 0.3, x1 - x0)
    for s in (-1, 1):
        rot = f.rot @ Matrix.Rotation(-s * ang, 3, "Y")
        c = f.o + f.rot @ Vector(((x0 + x1) / 2, 0.02, (ZOCALO + ALTO) / 2))
        f.m.caja(c, (largo, 0.06, 0.12), p.variar(p.VIGA, 0.06), rot)


def ventana(f, h, marco, cruceta=True):
    h0, h1, z0, z1 = h
    cu, cz, w, alto = (h0 + h1) / 2, (z0 + z1) / 2, h1 - h0, z1 - z0
    f.caja(cu, -GRUESO + 0.05, cz, w, 0.04, alto, p.VIDRIO, CRISTAL)
    for du in (-1, 1):
        f.caja(cu + du * (w / 2 - 0.03), -0.05, cz, 0.06, 0.12, alto, marco)
    for dz in (-1, 1):
        f.caja(cu, -0.05, cz + dz * (alto / 2 - 0.03), w, 0.12, 0.06, marco)
    if cruceta:
        n = max(2, round(w / 0.5))
        for i in range(1, n):
            f.caja(h0 + i * w / n, -0.1, cz, 0.04, 0.04, alto, marco)
        f.caja(cu, -0.1, cz + alto * 0.2, w, 0.04, 0.04, marco)
    f.caja(cu, 0.06, z0 - 0.05, w + 0.2, 0.2, 0.06, marco)  # alféizar


def toldo(m, h0, h1, colores):
    """Toldo a rayas sobre un escaparate, de la pared hacia la calle."""
    y0, z0 = Y_FRENTE - 0.02, 2.55
    y1, z1 = Y_FRENTE - 0.95, 2.2
    largo = math.hypot(y1 - y0, z1 - z0)
    rot = Matrix.Rotation(math.atan2(z0 - z1, y0 - y1), 3, "X")
    n = 6
    w = (h1 - h0 + 0.3) / n
    for i in range(n):
        x = h0 - 0.15 + (i + 0.5) * w
        col = colores[i % 2]
        m.caja((x, (y0 + y1) / 2, (z0 + z1) / 2), (w, largo, 0.035), col, rot)
        m.caja((x, y1 - 0.01, z1 - 0.12), (w - 0.015, 0.03, 0.2), col)
        m.caja((x, y1 - 0.01, z1 - 0.25), (w * 0.5, 0.03, 0.07), col)
    for x in (h0 - 0.12, h1 + 0.12):  # tirantes de hierro
        m.caja((x, (y0 + y1) / 2, (z0 + z1) / 2 + 0.03), (0.03, largo, 0.03), p.HIERRO, rot)


def puerta(f, pintura, marco):
    h0, h1, z0, z1 = PUERTA
    w, alto = h1 - h0, z1 - z0
    for i in range(4):
        cu = h0 + (i + 0.5) * w / 4
        f.caja(cu, -GRUESO + 0.06, z0 + alto * 0.3, w / 4 - 0.01, 0.05, alto * 0.6, p.variar(pintura, 0.05))
    f.caja(0, -GRUESO + 0.06, z0 + alto * 0.8, w, 0.05, alto * 0.4, pintura)
    f.caja(0, -GRUESO + 0.04, z0 + alto * 0.78, w - 0.3, 0.04, alto * 0.28, p.VIDRIO, CRISTAL)
    f.caja(0.35, -GRUESO + 0.12, z0 + 0.95, 0.05, 0.06, 0.16, p.HIERRO)
    for du in (-1, 1):
        f.caja(du * (w / 2 + 0.05), -0.05, (z0 + z1) / 2, 0.1, 0.14, alto, marco)
    f.caja(0, -0.05, z1 + 0.05, w + 0.2, 0.14, 0.1, marco)
    # Faroles a ambos lados
    for du in (-1, 1):
        x = du * 0.82
        f.caja(x, 0.1, 2.15, 0.04, 0.2, 0.04, p.HIERRO)
        f.caja(x, 0.2, 2.0, 0.16, 0.16, 0.04, p.HIERRO)
        f.caja(x, 0.2, 1.89, 0.11, 0.11, 0.18, p.LLAMA, LUZ)
        f.caja(x, 0.2, 1.78, 0.16, 0.16, 0.04, p.HIERRO)


def tejado(m):
    """Dos faldones hacia los lados, con la cumbrera de la calle al fondo."""
    run = ANCHO / 2 + VUELO
    faldon = run / math.cos(PENDIENTE)
    largo = FONDO + 2 * VUELO
    z_alero = ALTO - VUELO * math.tan(PENDIENTE)
    grosor = 0.1
    for s in (-1, 1):
        u = Vector((0, 1, 0))
        v = Vector((-s * math.cos(PENDIENTE), 0, math.sin(PENDIENTE)))  # sube a la cumbrera
        n = Vector((s * math.sin(PENDIENTE), 0, math.cos(PENDIENTE)))
        base = Matrix((u, v, n)).transposed()
        alero = Vector((s * run, 0, z_alero))
        m.caja(alero + v * faldon / 2 + n * grosor / 2, (largo, faldon, grosor), p.VIGA, base)
        d = 0.12  # las tejas levantan el borde inferior
        teja = Matrix((u, v * math.cos(d) - n * math.sin(d), n * math.cos(d) + v * math.sin(d))).transposed()
        paso, alto_t, ancho_t = 0.27, 0.36, 0.38
        fila, s_ = 0, 0.0
        while s_ < faldon - 0.05:
            y = -largo / 2 - (ancho_t / 2 if fila % 2 else 0)
            while y < largo / 2:
                a, b = max(y, -largo / 2), min(y + ancho_t, largo / 2)
                if b - a > 0.08:
                    c = alero + v * min(s_ + alto_t / 2, faldon - alto_t / 2) + n * (grosor + 0.04)
                    c += Vector((0, (a + b) / 2, 0))
                    m.caja(c, (b - a - 0.015, alto_t, 0.05), p.variar(p.TEJA, 0.1), teja)
                y += ancho_t
            s_ += paso
            fila += 1
    cumbre = Vector((0, 0, ALTO + SUBIDA + grosor + 0.06))
    rot45 = Matrix.Rotation(math.pi / 4, 3, "Y")
    y = -largo / 2
    while y < largo / 2 - 0.01:
        b = min(y + 0.42, largo / 2)
        m.caja(cumbre + Vector((0, (y + b) / 2, 0)), (0.26, b - y - 0.02, 0.26), p.variar(p.CUMBRERA), rot45)
        y = b


def hastiales(m, revoco):
    for lado in (-1, 1):
        y = lado * FONDO / 2
        tri = [(-ANCHO / 2, y, ALTO), (ANCHO / 2, y, ALTO), (0, y, ALTO + SUBIDA)]
        m.prisma(tri, (0, -lado * GRUESO, 0), revoco)
        # Pares y pendolón del entramado
        yv = y + lado * 0.02
        for s in (-1, 1):
            largo = math.hypot(ANCHO / 2, SUBIDA)
            rot = Matrix.Rotation(s * PENDIENTE, 3, "Y")
            m.caja((s * ANCHO / 4, yv, ALTO + SUBIDA / 2), (largo, 0.06, 0.14), p.variar(p.VIGA, 0.06), rot)
        m.caja((0, yv, ALTO + SUBIDA / 2), (0.12, 0.06, SUBIDA), p.variar(p.VIGA, 0.06))
    # Letrero en blanco en el hastial de la calle: el juego lo rotula
    L = LETRERO
    m.caja((0, L["y"] + 0.03, L["z"]), (L["ancho"] + 0.12, L["grueso"], L["alto"] + 0.12), p.VIGA)
    m.caja((0, L["y"], L["z"]), (L["ancho"], L["grueso"], L["alto"]), p.CLARA)
    for x in (-0.6, 0.6):  # ménsulas
        m.caja((x, Y_FRENTE - 0.08, L["z"] - 0.36), (0.06, 0.16, 0.1), p.HIERRO)


def zocalo(m):
    m.caja((0, 0, ZOCALO / 2), (ANCHO + 0.1, FONDO + 0.1, ZOCALO), (0.3, 0.27, 0.24))
    caras = (
        ((0, -FONDO / 2 - 0.05, 0), (1, 0, 0), (0, -1, 0), ANCHO + 0.1),
        ((0, FONDO / 2 + 0.05, 0), (-1, 0, 0), (0, 1, 0), ANCHO + 0.1),
        ((ANCHO / 2 + 0.05, 0, 0), (0, 1, 0), (1, 0, 0), FONDO + 0.1),
        ((-ANCHO / 2 - 0.05, 0, 0), (0, -1, 0), (-1, 0, 0), FONDO + 0.1),
    )
    for origen, u, fuera, largo in caras:
        f = Fachada(m, origen, u, fuera)
        pos = -largo / 2
        while pos < largo / 2:
            tramo = p.RNG.uniform(0.32, 0.58)
            a, b = max(pos, -largo / 2), min(pos + tramo, largo / 2)
            if b - a > 0.06:
                f.caja((a + b) / 2, p.RNG.uniform(0.0, 0.03), ZOCALO / 2, b - a - 0.03, 0.08, ZOCALO - 0.03, p.variar(p.PIEDRA, 0.12))
            pos += tramo
    # Escalón ante la puerta: bajo, se pisa sin colisión
    m.caja((0, Y_FRENTE - 0.3, 0.07), (1.4, 0.55, 0.14), p.variar(p.PIEDRA))


def expositores(m, tipo):
    """Banco bajo delante de cada escaparate con el género y algo en el suelo."""
    for h0, h1, _, _ in ESCAPARATES:
        cx, w = (h0 + h1) / 2, h1 - h0
        y = Y_FRENTE - 0.42
        m.caja((cx, y, 0.42), (w, 0.48, 0.06), p.variar(p.CLARA))
        for dx in (-w / 2 + 0.06, w / 2 - 0.06):
            for dy in (-0.18, 0.18):
                m.caja((cx + dx, y + dy, 0.2), (0.06, 0.06, 0.4), p.OSCURA)
        p.genero(m, tipo, (cx, y, 0.45), w - 0.1)
    lado = ANCHO / 2 + 0.45  # en el suelo, junto a las esquinas delanteras
    if tipo == "semillas":
        p.saco(m, (-lado, Y_FRENTE + 0.2, 0), 1.1, 0.3, (0.62, 0.48, 0.25))
        p.saco(m, (-lado + 0.05, Y_FRENTE + 0.6, 0), 0.9, -0.2)
        p.cajon(m, (lado, Y_FRENTE + 0.35, 0), "calabaza", 0.6, 0.45)
    elif tipo == "animales":
        p.bala(m, (-lado, Y_FRENTE + 0.4, 0.2), math.pi / 2)
        p.bala(m, (-lado, Y_FRENTE + 0.4, 0.6), math.pi / 2 + 0.1)
        p.lechera(m, (lado, Y_FRENTE + 0.25, 0))
        p.saco(m, (lado, Y_FRENTE + 0.7, 0), 1.1, 0.4)
    else:
        for i, y in enumerate((0.2, 0.75)):
            p.cubo(m, (-lado, Y_FRENTE + y, 0), 0.18, 0.4)
            p.ramo(m, (-lado, Y_FRENTE + y, 0.3), 14, 0.42)
            p.maceta(m, (lado, Y_FRENTE + y, 0), 0.28, 0.15)


def construir(tipo):
    p.semilla({"semillas": 3101, "animales": 3102, "flores": 3103}[tipo])
    estilo = p.ESTILO[tipo]
    revoco, pintura = estilo["revoco"], estilo["pintura"]
    m = Malla()
    zocalo(m)
    # Interior oscuro tras los cristales
    m.caja((0, 0, (ZOCALO + ALTO) / 2), (ANCHO - 0.5, FONDO - 0.5, ALTO - ZOCALO), (0.22, 0.16, 0.11))

    frente = Fachada(m, (0, -FONDO / 2, 0), (1, 0, 0), (0, -1, 0))
    muro(frente, ANCHO, [PUERTA, *ESCAPARATES], revoco)
    for h in ESCAPARATES:
        ventana(frente, h, pintura)
        toldo(m, h[0], h[1], estilo["toldo"])
    puerta(frente, pintura, p.BLANCO)

    lateral = (-0.5, 0.5, 1.2, 2.1)
    for s in (-1, 1):
        f = Fachada(m, (s * ANCHO / 2, 0, 0), (0, s, 0), (s, 0, 0))
        muro(f, FONDO, [lateral], revoco)
        ventana(f, lateral, pintura)
        aspas(f, -FONDO / 2 + 0.2, lateral[0] - 0.15, revoco)
        aspas(f, lateral[1] + 0.15, FONDO / 2 - 0.2, revoco)
    detras = Fachada(m, (0, FONDO / 2, 0), (-1, 0, 0), (0, 1, 0))
    muro(detras, ANCHO, [(-0.6, 0.6, 1.2, 2.1)], revoco)
    ventana(detras, (-0.6, 0.6, 1.2, 2.1), pintura)

    hastiales(m, revoco)
    tejado(m)
    expositores(m, tipo)
    return m.objeto(f"SM_Tienda_{tipo}", p.materiales_basicos())


def exportar(tipo, obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / f"tienda_{tipo}.glb"
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", use_selection=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC / destino.name)
    return {
        "triangulos": sum(len(q.vertices) - 2 for q in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "dimensiones_m": [round(d, 3) for d in obj.dimensions],
    }


def estudio():
    escena = bpy.context.scene
    suelo = bpy.data.meshes.new("Suelo")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=10)
    bm.to_mesh(suelo)
    bm.free()
    mat = bpy.data.materials.new("M_Suelo")
    mat.use_nodes = True
    mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.2, 0.42, 0.14, 1)
    suelo.materials.append(mat)
    escena.collection.objects.link(bpy.data.objects.new("Suelo", suelo))
    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.5
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    escena.collection.objects.link(sol_obj)
    cam = bpy.data.cameras.new("Camara")
    cam.lens = 50
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (-8.5, -13.0, 9.0)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    cam_obj.rotation_euler = (Vector((0, 0, 2.2)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    mundo = bpy.data.worlds.new("Cielo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.55, 0.75, 0.95, 1)
    mundo.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    escena.world = mundo
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 900
    escena.render.resolution_y = 760


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tipos = ("semillas", "animales", "flores")
    objetos = {t: construir(t) for t in tipos}
    metricas = {t: exportar(t, o) for t, o in objetos.items()}
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    print("METRICAS", metricas)
    estudio()
    for t, obj in objetos.items():
        for otro in objetos.values():
            otro.hide_render = otro is not obj
        bpy.context.scene.render.filepath = str(OUT / f"preview_{t}.png")
        bpy.ops.render.render(write_still=True)
    for i, obj in enumerate(objetos.values()):
        obj.hide_render = False
        obj.location.x = (i - 1) * 9  # en el .blend, una junto a otra
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "tiendas.blend"))
