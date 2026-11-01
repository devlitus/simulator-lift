"""Interiores de las tres tiendas del mercado: ejecutar con Blender 5.

blender --background --factory-startup --python assets/tienda_interior/generar.py

Tienda de 10 x 7 m en forma de diorama, como el interior de la casa: sin techo
y con el muro de la puerta bajo para que la cámara vea dentro. Mostrador con la
trastienda cerrada detrás (ahí está el tendero), estanterías en el fondo, mesas
con género, rincones con barriles y sacos y ventanas en los laterales. Las tres
comparten planta y colisiones; cambian los colores y el género (piezas.py).
La tarima usa la textura de ComfyUI del interior de la casa. Guarda
assets/tienda_interior.blend, exporta tienda_interior_<tipo>.glb (fuente y
publicado) y renderiza un preview de cada uno. Ver README.md.
"""

import json
import math
import shutil
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tiendas"))

import bpy
from mathutils import Vector

import piezas as p
from piezas import CRISTAL, LUZ, TEXTURA, Malla

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "tienda_interior"
PUBLIC = ASSETS.parent / "public" / "models"

# Medidas (m). Suelo en z=0 y puerta en -Y de Blender (+Z en Babylon). El juego
# refleja x y z: src/world/marketLayout.ts usa estas mismas medidas.
ANCHO = 10.0
FONDO = 7.0
ALTO = 2.7
MURO_BAJO = 0.28
HUECO = 0.65  # media puerta
X, Y = ANCHO / 2, FONDO / 2
YESO = (0.92, 0.85, 0.72)
MOSTRADOR = {"x": 3.0, "y0": 0.85, "y1": 1.55, "alto": 1.0}
ESTANTE = {"y0": 3.0, "x": 4.6, "alto": 2.2}
MESAS = ((-2.8, -1.2), (2.8, -1.2))  # centro; 1,4 x 0,8 m


def muros(m, estilo):
    m.caja((0, 0, -0.17), (ANCHO + 0.9, FONDO + 0.9, 0.3), p.VIGA)
    m.caja((0, 0, 0.0), (ANCHO, FONDO, 0.02), p.BLANCO, mat=TEXTURA, escala_uv=1.8)
    g = 0.2
    m.caja((0, Y + g / 2, ALTO / 2), (ANCHO + 2 * g, g, ALTO), YESO)
    for s in (-1, 1):
        m.caja((s * (X + g / 2), 0, ALTO / 2), (g, FONDO, ALTO), YESO)
    for x0, x1 in ((-X - g, -HUECO), (HUECO, X + g)):
        m.caja(((x0 + x1) / 2, -Y - g / 2, MURO_BAJO / 2), (x1 - x0, g, MURO_BAJO), p.VIGA)
    # Entramado: rodapié, carrera y postes, como el exterior
    for c, med in (((0, Y - 0.04), (ANCHO + 0.3, 0.16)), ((-X + 0.04, 0), (0.16, FONDO + 0.3)), ((X - 0.04, 0), (0.16, FONDO + 0.3))):
        for z in (0.1, ALTO - 0.1):
            m.caja((*c, z), (*med, 0.2), p.variar(p.VIGA))
    for x in (-X + 0.08, -1.6, 1.6, X - 0.08):
        m.caja((x, Y - 0.05, ALTO / 2), (0.18, 0.14, ALTO), p.variar(p.VIGA))
    for s in (-1, 1):
        for y in (-Y + 0.08, Y - 0.08):
            m.caja((s * (X - 0.05), y, ALTO / 2), (0.14, 0.18, ALTO), p.variar(p.VIGA))
    # Ventanas en los laterales, sobre el género
    for s in (-1, 1):
        x = s * (X - 0.03)
        m.caja((x, 0.0, 1.85), (0.04, 1.2, 0.9), p.VIDRIO, mat=CRISTAL)
        for dy in (-0.64, 0.64):
            m.caja((x - s * 0.04, dy, 1.85), (0.1, 0.09, 1.08), estilo["pintura"])
        for dz in (-0.49, 0.49):
            m.caja((x - s * 0.04, 0, 1.85 + dz), (0.1, 1.2, 0.09), estilo["pintura"])
        m.caja((x - s * 0.04, 0, 1.85), (0.05, 0.05, 0.9), estilo["pintura"])
    # Marco de la puerta y felpudo
    for du in (-1, 1):
        m.caja((du * (HUECO + 0.07), -Y - 0.1, 1.1), (0.14, 0.24, 2.2), p.variar(p.VIGA))
    m.caja((0, -Y - 0.1, 2.26), (2 * HUECO + 0.28, 0.24, 0.14), p.variar(p.VIGA))
    m.caja((0, -Y + 0.34, 0.012), (1.1, 0.6, 0.02), estilo["toldo"][0])
    m.caja((0, -Y + 0.34, 0.016), (0.94, 0.46, 0.02), (0.82, 0.68, 0.40))


def mostrador(m, tipo, estilo):
    """Mostrador de lado a lado de la trastienda, con tabiques bajos hasta el fondo."""
    M = MOSTRADOR
    yc, fondo = (M["y0"] + M["y1"]) / 2, M["y1"] - M["y0"]
    n = 20
    for i in range(n):
        x = -M["x"] + (i + 0.5) * 2 * M["x"] / n
        m.caja((x, M["y0"] + 0.03, M["alto"] / 2), (2 * M["x"] / n - 0.012, 0.05, M["alto"] - 0.08), p.variar(p.MADERA, 0.1))
    m.caja((0, yc, M["alto"] / 2), (2 * M["x"], fondo - 0.1, M["alto"] - 0.06), p.OSCURA)
    m.caja((0, yc - 0.03, M["alto"] - 0.03), (2 * M["x"] + 0.1, fondo + 0.08, 0.07), p.variar(p.CLARA))
    m.caja((0, M["y0"] + 0.02, 0.06), (2 * M["x"] + 0.04, 0.08, 0.12), p.OSCURA)
    # Tabiques que cierran la trastienda hasta las estanterías
    for s in (-1, 1):
        y0, y1 = M["y1"], ESTANTE["y0"]
        m.caja((s * M["x"], (y0 + y1) / 2, 0.55), (0.12, y1 - y0, 1.1), p.variar(p.MADERA))
        m.caja((s * M["x"], (y0 + y1) / 2, 1.13), (0.18, y1 - y0 + 0.06, 0.06), p.variar(p.CLARA))
    # Encima: balanza, caja registradora y algo del género
    z = M["alto"]
    m.caja((-1.9, yc, z + 0.12), (0.5, 0.36, 0.24), p.OSCURA)  # caja
    m.caja((-1.9, yc - 0.05, z + 0.27), (0.42, 0.2, 0.1), p.variar(p.METAL))
    m.caja((-1.9, yc + 0.12, z + 0.33), (0.4, 0.06, 0.14), p.CLARA)
    m.torno((1.9, yc, z), ((0.12, 0), (0.12, 0.04), (0.03, 0.04), (0.03, 0.3), (0.2, 0.3), (0.2, 0.33)), p.METAL)  # balanza
    m.caja((1.15, yc, z + 0.02), (0.44, 0.32, 0.03), (0.70, 0.30, 0.22))  # tapete
    if tipo == "flores":
        p.pastel(m, (0.6, yc, z))
        p.cubo(m, (-0.9, yc, z), 0.12, 0.24)
        p.ramo(m, (-0.9, yc, z + 0.2), 12, 0.3)
    elif tipo == "semillas":
        p.sobres(m, (0.7, yc, z), 2, 4)
        p.cajon(m, (-0.9, yc, z), "tomate", 0.5, 0.36)
    else:
        p.saco(m, (0.7, yc, z), 0.8, 0.2)
        m.caja((-0.9, yc, z + 0.07), (0.5, 0.34, 0.14), p.variar(p.MADERA))  # huevos
        for i in range(4):
            for j in range(3):
                m.torno((-1.08 + i * 0.12, yc - 0.1 + j * 0.1, z + 0.1), ((0.03, 0), (0.04, 0.04), (0.03, 0.09)), (0.96, 0.9, 0.8), lados=7)
    # Lámparas colgadas sobre el mostrador
    for x in (-1.5, 1.5):
        m.caja((x, yc, 2.45), (0.02, 0.02, 0.5), p.HIERRO)
        m.torno((x, yc, 1.92), ((0.06, 0), (0.18, 0.12), (0.18, 0.2), (0.04, 0.26)), p.HIERRO)
        m.caja((x, yc, 1.95), (0.14, 0.14, 0.1), p.LLAMA, mat=LUZ)


def estanterias(m, tipo):
    """Estantería corrida en el muro del fondo, con tres baldas llenas."""
    E = ESTANTE
    y0, y1 = E["y0"], Y - 0.06
    yc = (y0 + y1) / 2
    for x in (-E["x"], -E["x"] / 3, E["x"] / 3, E["x"]):
        m.caja((x, yc, E["alto"] / 2), (0.08, y1 - y0, E["alto"]), p.variar(p.MADERA))
    for z in (0.05, 0.62, 1.22, 1.82, E["alto"]):
        m.caja((0, yc, z), (2 * E["x"], y1 - y0, 0.05), p.variar(p.CLARA))
    m.caja((0, y1 - 0.02, E["alto"] / 2), (2 * E["x"], 0.03, E["alto"]), p.variar(p.MADERA, 0.05))
    tramo = 2 * E["x"] / 3
    for k in range(3):
        cx = -E["x"] + (k + 0.5) * tramo
        for z in (0.08, 0.65, 1.25):
            p.genero(m, tipo, (cx, yc - 0.02, z), tramo - 0.2)
    # Remate: una pieza grande de cada tienda sobre la estantería
    if tipo == "semillas":
        for x in (-3.0, 0.0, 3.0):
            p.cajon(m, (x, yc, E["alto"] + 0.02), "calabaza", 0.6, 0.4)
    elif tipo == "animales":
        for x in (-3.0, 0.0, 3.0):
            p.bala(m, (x, yc, E["alto"] + 0.22), 0.0)
    else:
        for x in (-3.4, -1.2, 1.2, 3.4):
            p.maceta(m, (x, yc, E["alto"] + 0.02), 0.22, 0.13)


def mesas(m, tipo):
    for cx, cy in MESAS:
        m.caja((cx, cy, 0.72), (1.4, 0.8, 0.06), p.variar(p.CLARA))
        for dx in (-0.62, 0.62):
            for dy in (-0.32, 0.32):
                m.caja((cx + dx, cy + dy, 0.36), (0.07, 0.07, 0.72), p.OSCURA)
        for dy in (-0.18, 0.18):
            p.genero(m, tipo, (cx, cy + dy, 0.75), 1.25)


def rincones(m, tipo):
    """Junto a los laterales y en los huecos tras los tabiques: barriles y género."""
    for s in (-1, 1):
        x = s * (X - 0.5)
        # Barril en el hueco entre el tabique de la trastienda y el lateral
        m.torno((s * 3.6, 2.3, 0), ((0.36, 0), (0.42, 0.45), (0.36, 0.9)), p.variar(p.MADERA), lados=14, tapa=p.CLARA)
        for z in (0.15, 0.75):
            m.torno((s * 3.6, 2.3, z - 0.03), ((0.395, 0), (0.41, 0.06)), p.HIERRO, lados=14)
        for i, y in enumerate((-2.2, -1.2, -0.2, 0.8, 1.8)):
            if tipo == "semillas":
                if i % 2:
                    p.cajon(m, (x, y, 0), ("zanahoria", "tomate", "calabaza")[i % 3], 0.6, 0.5)
                else:
                    p.saco(m, (x, y, 0), 1.2, 0.2 * s)
            elif tipo == "animales":
                if i % 2:
                    p.bala(m, (x, y, 0.2), math.pi / 2)
                else:
                    p.saco(m, (x, y, 0), 1.2, 0.2 * s)
                if i == 2:
                    p.lechera(m, (x, y + 0.45, 0))
            else:
                p.cubo(m, (x, y, 0), 0.2, 0.42)
                p.ramo(m, (x, y, 0.32), 14, 0.42)


def construir(tipo):
    p.semilla({"semillas": 3201, "animales": 3202, "flores": 3203}[tipo])
    estilo = p.ESTILO[tipo]
    m = Malla()
    muros(m, estilo)
    mostrador(m, tipo, estilo)
    estanterias(m, tipo)
    mesas(m, tipo)
    rincones(m, tipo)
    tarima = p.material_textura("M_Suelo", ASSETS / "casa_interior" / "suelo.png")
    return m.objeto(f"SM_TiendaInterior_{tipo}", [*p.materiales_basicos(), tarima])


def exportar(tipo, obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / f"tienda_interior_{tipo}.glb"
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", use_selection=True, export_image_format="JPEG")
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC / destino.name)
    return {
        "triangulos": sum(len(q.vertices) - 2 for q in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "dimensiones_m": [round(d, 3) for d in obj.dimensions],
    }


def estudio():
    escena = bpy.context.scene
    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.0
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(40), math.radians(-15), math.radians(-20))
    escena.collection.objects.link(sol_obj)
    cam = bpy.data.cameras.new("Camara")
    cam.lens = 35
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (0, -10.5, 10.5)  # como la cámara del juego: 45° desde la puerta
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    cam_obj.rotation_euler = (Vector((0, 0.3, 0.6)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    mundo = bpy.data.worlds.new("Fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.9, 0.85, 0.75, 1)
    mundo.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    escena.world = mundo
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 1000
    escena.render.resolution_y = 800


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
        obj.location.x = (i - 1) * 13  # en el .blend, uno junto a otro
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "tienda_interior.blend"))
