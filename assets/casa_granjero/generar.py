"""Casa del granjero reproducible: ejecutar con Blender 5.

blender --background --factory-startup --python assets/casa_granjero/generar.py

Cabaña de troncos sobre zócalo de piedra, tejado a dos aguas de tejas,
chimenea de piedra, porche, puerta con farol y ventanas con contraventanas.
Modelado procedural (sin IA) con colores planos por pieza en el atributo de
color `Col`. Guarda assets/casa_granjero.blend, exporta el GLB (fuente y
publicado) y renderiza preview.png. Ver README.md.
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
OUT = ASSETS / "casa_granjero"
PUBLIC = ASSETS.parent / "public" / "models" / "casa_granjero.glb"
RNG = random.Random(1112026)

# Medidas (m). Frente en -Y de Blender (+Z en Babylon), base en z=0.
ANCHO = 5.0  # eje x, fachada principal
FONDO = 4.0  # eje y
ZOCALO = 0.45  # altura del zócalo de piedra (= suelo de la casa)
R_TRONCO = 0.11
ALTO_MURO = ZOCALO + 10 * 2 * R_TRONCO  # 2,65
SUBIDA = 1.5  # del alero del muro a la cumbrera
VUELO_Y = 0.45  # alero delantero y trasero
VUELO_X = 0.35  # alero lateral
PENDIENTE = math.atan2(SUBIDA, FONDO / 2)

# Índices de material
OPACO, CRISTAL, FAROL = 0, 1, 2

# Paleta en sRGB; se guarda en lineal en el atributo de color.
MADERA = (0.62, 0.42, 0.24)
TESTA = (0.80, 0.64, 0.43)  # corte de los troncos
INTERIOR = (0.24, 0.16, 0.10)
PIEDRA = (0.56, 0.54, 0.51)
TEJA = (0.68, 0.29, 0.20)
CUMBRERA = (0.46, 0.19, 0.14)
TABLA = (0.72, 0.54, 0.33)
LISTON = (0.50, 0.34, 0.20)
PINTURA = (0.26, 0.47, 0.44)  # puerta y contraventanas
MARCO = (0.90, 0.85, 0.72)
JARDINERA = (0.50, 0.33, 0.20)
FLORES = ((0.86, 0.22, 0.22), (0.96, 0.80, 0.22), (0.93, 0.52, 0.66))
HOJA = (0.30, 0.55, 0.25)
METAL = (0.20, 0.20, 0.22)
TARIMA = (0.58, 0.43, 0.28)
VIDRIO = (0.45, 0.62, 0.72)
LUZ = (1.0, 0.80, 0.45)


def lineal(c):
    return tuple(x**2.2 for x in c)


def variar(c, amt=0.08):
    f = 1 + RNG.uniform(-amt, amt)
    return tuple(min(1.0, x * f) for x in c)


class Malla:
    """Acumula piezas en un único bmesh con color por cara y material."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new("Col")

    def _pintar(self, caras, color, mat):
        c = (*lineal(color), 1.0)
        for f in caras:
            f.material_index = mat
            for loop in f.loops:
                loop[self.col] = c

    def caja(self, centro, medidas, color, rot=None, mat=OPACO):
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
        self._pintar(caras, color, mat)

    def cilindro(self, p0, p1, radio, color, color_tapa=None, lados=8, mat=OPACO):
        p0, p1 = Vector(p0), Vector(p1)
        eje = (p1 - p0).normalized()
        u = eje.orthogonal().normalized()
        v = eje.cross(u)
        anillos = []
        for p in (p0, p1):
            anillos.append(
                [
                    self.bm.verts.new(
                        p
                        + radio * math.cos(2 * math.pi * i / lados + math.pi / lados) * u
                        + radio * math.sin(2 * math.pi * i / lados + math.pi / lados) * v
                    )
                    for i in range(lados)
                ]
            )
        a, b = anillos
        lado = [
            self.bm.faces.new((a[i], a[(i + 1) % lados], b[(i + 1) % lados], b[i]))
            for i in range(lados)
        ]
        tapas = [self.bm.faces.new(list(reversed(a))), self.bm.faces.new(b)]
        self._pintar(lado, color, mat)
        self._pintar(tapas, color_tapa or color, mat)

    def prisma(self, puntos, desplazamiento, color, mat=OPACO):
        d = Vector(desplazamiento)
        a = [self.bm.verts.new(Vector(p)) for p in puntos]
        b = [self.bm.verts.new(Vector(p) + d) for p in puntos]
        n = len(puntos)
        caras = [self.bm.faces.new(a), self.bm.faces.new(list(reversed(b)))]
        caras += [self.bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n])) for i in range(n)]
        self._pintar(caras, color, mat)


class Fachada:
    """Marco local de un muro: u a lo largo del muro, o hacia fuera, z arriba."""

    def __init__(self, malla, origen, u, fuera):
        self.m = malla
        self.o = Vector(origen)
        self.rot = Matrix((u, fuera, (0, 0, 1))).transposed()

    def punto(self, cu, co, cz):
        return self.o + self.rot @ Vector((cu, co, cz))

    def caja(self, cu, co, cz, su, so, sz, color, mat=OPACO):
        self.m.caja(self.punto(cu, co, cz), (su, so, sz), color, self.rot, mat)


def muro_troncos(m, eje, fijo, largo, alturas, huecos):
    """Troncos horizontales de un muro, cortados alrededor de puertas y ventanas.

    eje "x": muro delantero/trasero (y = fijo); eje "y": muro lateral (x = fijo).
    huecos: (desde, hasta, z0, z1) a lo largo del muro.
    """
    for zc in alturas:
        tramos = [(-largo / 2, largo / 2)]
        for h0, h1, z0, z1 in huecos:
            if z0 - 0.05 < zc < z1 + 0.05:
                nuevos = []
                for a, b in tramos:
                    if b <= h0 or a >= h1:
                        nuevos.append((a, b))
                        continue
                    if a < h0:
                        nuevos.append((a, h0))
                    if b > h1:
                        nuevos.append((h1, b))
                tramos = nuevos
        for a, b in tramos:
            if b - a < 0.05:
                continue
            if eje == "x":
                p0, p1 = (a, fijo, zc), (b, fijo, zc)
            else:
                p0, p1 = (fijo, a, zc), (fijo, b, zc)
            m.cilindro(p0, p1, R_TRONCO * RNG.uniform(0.95, 1.05), variar(MADERA), variar(TESTA))


def ventana(f, cu, z0, ancho, alto, flores=True):
    """Ventana con marco, cruceta, contraventanas y jardinera en una fachada."""
    zc = z0 + alto / 2
    f.caja(cu, -0.06, zc, ancho, 0.04, alto, VIDRIO, CRISTAL)
    g = 0.08  # grosor del marco
    for du in (-1, 1):
        f.caja(cu + du * (ancho / 2 + g / 2), 0.05, zc, g, 0.16, alto + 2 * g, MARCO)
    for dz in (-1, 1):
        f.caja(cu, 0.05, zc + dz * (alto / 2 + g / 2), ancho, 0.16, g, MARCO)
    f.caja(cu, 0.0, zc, 0.05, 0.06, alto, MARCO)  # cruceta
    f.caja(cu, 0.0, zc, ancho, 0.06, 0.05, MARCO)
    f.caja(cu, 0.1, z0 - g - 0.03, ancho + 0.3, 0.26, 0.06, MARCO)  # alféizar
    for du in (-1, 1):
        cs = cu + du * (ancho / 2 + g + 0.15)
        f.caja(cs, 0.14, zc, 0.28, 0.05, alto + 0.1, variar(PINTURA, 0.04))
        for dz in (-0.3, 0.0, 0.3):  # lamas
            f.caja(cs, 0.17, zc + dz * alto, 0.22, 0.02, 0.05, variar(PINTURA, 0.1))
    if not flores:
        return
    zj = z0 - g - 0.18
    f.caja(cu, 0.22, zj, ancho + 0.2, 0.24, 0.2, JARDINERA)
    pasos = 6
    for i in range(pasos):
        du = -ancho / 2 + (i + 0.5) * ancho / pasos
        f.caja(cu + du, 0.22, zj + 0.13, 0.13, 0.14, 0.1, variar(HOJA, 0.15))
        f.caja(
            cu + du + RNG.uniform(-0.03, 0.03),
            0.22 + RNG.uniform(-0.04, 0.04),
            zj + 0.22,
            0.1,
            0.1,
            0.08,
            FLORES[i % len(FLORES)],
        )


def zocalo(m):
    """Bloque interior y sillares irregulares en dos hiladas alrededor."""
    m.caja((0, 0, ZOCALO / 2), (ANCHO + 0.1, FONDO + 0.1, ZOCALO), INTERIOR)
    caras = (
        ((0, -FONDO / 2 - 0.05, 0), (1, 0, 0), (0, -1, 0), ANCHO + 0.1),
        ((0, FONDO / 2 + 0.05, 0), (-1, 0, 0), (0, 1, 0), ANCHO + 0.1),
        ((ANCHO / 2 + 0.05, 0, 0), (0, 1, 0), (1, 0, 0), FONDO + 0.1),
        ((-ANCHO / 2 - 0.05, 0, 0), (0, -1, 0), (-1, 0, 0), FONDO + 0.1),
    )
    alto = ZOCALO / 2
    for origen, u, fuera, largo in caras:
        f = Fachada(m, origen, u, fuera)
        for fila in range(2):
            pos = -largo / 2 - (0.18 if fila else 0)
            while pos < largo / 2:
                tramo = RNG.uniform(0.32, 0.58)
                a, b = max(pos, -largo / 2), min(pos + tramo, largo / 2)
                if b - a > 0.06:
                    f.caja(
                        (a + b) / 2,
                        RNG.uniform(0.0, 0.03),
                        alto * fila + alto / 2,
                        b - a - 0.03,
                        0.08,
                        alto - 0.03,
                        variar(PIEDRA, 0.12),
                    )
                pos += tramo


def tejado(m):
    largo = ANCHO + 2 * VUELO_X
    run = FONDO / 2 + VUELO_Y
    z_alero = ALTO_MURO - VUELO_Y * math.tan(PENDIENTE)
    faldon = run / math.cos(PENDIENTE)
    grosor = 0.1
    for lado in (-1, 1):  # -1 delante, +1 detrás
        ang = -lado * PENDIENTE
        rot = Matrix.Rotation(ang, 3, "X")
        sube = rot @ Vector((0, -lado, 0))  # del alero a la cumbrera
        n = rot @ Vector((0, 0, 1))
        alero = Vector((0, lado * run, z_alero))
        # Tablero con el canto visto bajo las tejas
        m.caja(alero + sube * faldon / 2 + n * grosor / 2, (largo, faldon, grosor), LISTON, rot)
        # Tejas: hileras solapadas, desplazadas media teja cada fila
        paso, alto_teja, ancho_teja = 0.27, 0.36, 0.38
        inclinacion = Matrix.Rotation(ang + lado * 0.12, 3, "X")
        fila = 0
        s = 0.0
        while s < faldon - 0.05:
            x = -largo / 2 - (ancho_teja / 2 if fila % 2 else 0)
            while x < largo / 2:
                a, b = max(x, -largo / 2), min(x + ancho_teja, largo / 2)
                if b - a > 0.08:
                    c = alero + sube * min(s + alto_teja / 2, faldon - alto_teja / 2)
                    c += n * (grosor + 0.04) + Vector(((a + b) / 2, 0, 0))
                    m.caja(c, (b - a - 0.015, alto_teja, 0.05), variar(TEJA, 0.1), inclinacion)
                x += ancho_teja
            s += paso
            fila += 1
    # Cumbrera: piezas en rombo a lo largo del caballete
    cumbre = Vector((0, 0, ALTO_MURO + SUBIDA + grosor + 0.06))
    rot45 = Matrix.Rotation(math.pi / 4, 3, "X")
    x = -largo / 2
    while x < largo / 2 - 0.01:
        b = min(x + 0.42, largo / 2)
        m.caja(cumbre + Vector(((x + b) / 2, 0, 0)), (b - x - 0.02, 0.26, 0.26), variar(CUMBRERA), rot45)
        x = b


def hastiales(m):
    """Triángulos de tablas bajo el tejado en los muros laterales."""
    for lado in (-1, 1):
        x_fuera = lado * (ANCHO / 2 + 0.02)
        tri = [(x_fuera - lado * 0.14, -FONDO / 2, ALTO_MURO), (x_fuera - lado * 0.14, FONDO / 2, ALTO_MURO),
               (x_fuera - lado * 0.14, 0, ALTO_MURO + SUBIDA)]
        m.prisma(tri, (lado * 0.14, 0, 0), TABLA)
        y = -FONDO / 2 + 0.2
        while y < FONDO / 2 - 0.1:
            tope = ALTO_MURO + SUBIDA * (1 - abs(y) / (FONDO / 2)) - 0.06
            if tope - ALTO_MURO > 0.08:
                alto = tope - ALTO_MURO
                m.caja((x_fuera + lado * 0.02, y, ALTO_MURO + alto / 2), (0.04, 0.06, alto), LISTON)
            y += 0.4
    # Ventanuco del desván en el hastial oeste (el este lo tapa la chimenea)
    f = Fachada(m, (-ANCHO / 2 - 0.06, 0, 0), (0, -1, 0), (-1, 0, 0))
    f.caja(0, 0, ALTO_MURO + 0.62, 0.42, 0.06, 0.42, MARCO)
    f.caja(0, 0.02, ALTO_MURO + 0.62, 0.3, 0.06, 0.3, VIDRIO, CRISTAL)


def chimenea(m):
    """Chimenea de piedra adosada al muro este, por hiladas."""
    x0 = ANCHO / 2 + 0.06
    tramos = ((0.0, 2.2, 0.95, 0.62), (2.2, 2.6, 0.8, 0.52), (2.6, 4.75, 0.62, 0.5))
    for z0, z1, ancho, fondo in tramos:
        z = z0
        fila = 0
        while z < z1 - 0.01:
            h = min(0.24, z1 - z)
            # Núcleo de la hilada y sillares de las tres caras vistas
            m.caja((x0 + fondo / 2, 0, z + h / 2), (fondo - 0.04, ancho - 0.04, h), variar(PIEDRA, 0.15))
            ys = -ancho / 2 + (0.15 if fila % 2 else 0)
            while ys < ancho / 2:
                b = min(ys + RNG.uniform(0.22, 0.34), ancho / 2)
                a = max(ys, -ancho / 2)
                m.caja((x0 + fondo, (a + b) / 2, z + h / 2), (0.05, b - a - 0.025, h - 0.025), variar(PIEDRA, 0.14))
                ys = b
            for lado in (-1, 1):
                m.caja((x0 + fondo / 2, lado * ancho / 2, z + h / 2), (fondo - 0.06, 0.05, h - 0.025),
                       variar(PIEDRA, 0.14))
            z += h
            fila += 1
    m.caja((x0 + 0.25, 0, 4.8), (0.72, 0.74, 0.1), (0.36, 0.34, 0.33))  # remate
    m.caja((x0 + 0.25, 0, 4.86), (0.36, 0.38, 0.04), (0.08, 0.07, 0.07))  # boca


def puerta(f):
    """Puerta de tablas pintadas con marco, travesaños y tirador."""
    ancho, z0, z1 = 1.0, ZOCALO, 2.35
    alto = z1 - z0
    for i in range(5):
        cu = -ancho / 2 + (i + 0.5) * ancho / 5
        f.caja(cu, -0.05, z0 + alto / 2, ancho / 5 - 0.012, 0.05, alto, variar(PINTURA, 0.05))
    for zz in (z0 + 0.35, z1 - 0.35):
        f.caja(0, -0.01, zz, ancho - 0.1, 0.03, 0.1, variar(PINTURA, 0.15))
    f.caja(0.36, 0.02, z0 + 0.95, 0.06, 0.06, 0.16, METAL)
    g = 0.1
    for du in (-1, 1):
        f.caja(du * (ancho / 2 + g / 2), 0.02, z0 + alto / 2, g, 0.18, alto + g, MARCO)
    f.caja(0, 0.02, z1 + g / 2, ancho + 2 * g, 0.18, g, MARCO)
    # Farol a la derecha de la puerta
    f.caja(0.85, 0.12, 2.05, 0.04, 0.24, 0.04, METAL)
    f.caja(0.85, 0.24, 1.88, 0.18, 0.18, 0.04, METAL)
    f.caja(0.85, 0.24, 1.76, 0.12, 0.12, 0.2, LUZ, FAROL)
    for du in (-1, 1):
        for do in (-1, 1):
            f.caja(0.85 + du * 0.075, 0.24 + do * 0.075, 1.76, 0.025, 0.025, 0.22, METAL)
    f.caja(0.85, 0.24, 1.64, 0.18, 0.18, 0.04, METAL)


def porche(m):
    """Tarima delante de la puerta, escalón y felpudo."""
    y0, y1 = -FONDO / 2 - 0.12, -FONDO / 2 - 1.0
    m.caja((0, (y0 + y1) / 2, ZOCALO / 2 - 0.04), (2.3, y0 - y1, ZOCALO - 0.08), INTERIOR)
    n = 13
    for i in range(n):
        x = -1.2 + (i + 0.5) * 2.4 / n
        m.caja((x, (y0 + y1) / 2, ZOCALO - 0.04), (2.4 / n - 0.015, y0 - y1 + 0.06, 0.08), variar(TARIMA, 0.1))
    for x in (-1.15, 1.15):
        m.caja((x, y1 + 0.06, ZOCALO / 2), (0.12, 0.12, ZOCALO), LISTON)
    m.caja((0, y1 - 0.18, 0.11), (1.3, 0.36, 0.22), variar(PIEDRA))
    m.caja((0, y0 - 0.35, ZOCALO + 0.005), (0.8, 0.5, 0.02), (0.62, 0.30, 0.22))


def lenero(m):
    """Leña apilada contra el muro oeste."""
    x = -ANCHO / 2 - 0.42
    for fila, n in enumerate((7, 6, 5, 4)):
        for i in range(n):
            y = -0.2 + (i - (n - 1) / 2) * 0.2
            z = 0.1 + fila * 0.17
            m.cilindro((x - 0.24, y, z), (x + 0.24, y, z), 0.09, variar(MADERA, 0.12), variar(TESTA), lados=7)


def barril(m):
    c = Vector((2.0, -FONDO / 2 - 0.75, 0))
    m.cilindro(c, c + Vector((0, 0, 0.75)), 0.3, variar(MADERA), LISTON, lados=12)
    for z in (0.15, 0.6):
        m.cilindro(c + Vector((0, 0, z - 0.03)), c + Vector((0, 0, z + 0.03)), 0.315, METAL, lados=12)


def material(nombre, rugosidad, emision=None):
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
        bsdf.inputs["Emission Strength"].default_value = 2.0
    return mat


def construir():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = Malla()

    zocalo(m)
    # Relleno interior: tapa las juntas entre troncos y el fondo de los huecos
    m.caja((0, 0, (ZOCALO + ALTO_MURO) / 2), (ANCHO - 0.16, FONDO - 0.16, ALTO_MURO - ZOCALO), INTERIOR)

    filas_xy = [ZOCALO + R_TRONCO + i * 2 * R_TRONCO for i in range(10)]
    filas_lat = [ZOCALO + 2 * R_TRONCO + i * 2 * R_TRONCO for i in range(10)]
    hueco_puerta = (-0.55, 0.55, ZOCALO, 2.35)
    huecos_frente = [hueco_puerta, (-2.15, -1.35, 1.1, 2.0), (1.35, 2.15, 1.1, 2.0)]
    muro_troncos(m, "x", -FONDO / 2, ANCHO + 0.3, filas_xy, huecos_frente)
    muro_troncos(m, "x", FONDO / 2, ANCHO + 0.3, filas_xy, [(-0.45, 0.45, 1.1, 2.0)])
    muro_troncos(m, "y", -ANCHO / 2, FONDO + 0.3, filas_lat, [(-0.4, 0.4, 1.1, 1.95)])
    muro_troncos(m, "y", ANCHO / 2, FONDO + 0.3, filas_lat, [])

    frente = Fachada(m, (0, -FONDO / 2, 0), (1, 0, 0), (0, -1, 0))
    puerta(frente)
    ventana(frente, -1.75, 1.1, 0.8, 0.9)
    ventana(frente, 1.75, 1.1, 0.8, 0.9)
    ventana(Fachada(m, (0, FONDO / 2, 0), (-1, 0, 0), (0, 1, 0)), 0, 1.1, 0.9, 0.9, flores=False)
    ventana(Fachada(m, (-ANCHO / 2, 0, 0), (0, -1, 0), (-1, 0, 0)), 0, 1.1, 0.8, 0.85, flores=False)

    tejado(m)
    hastiales(m)
    chimenea(m)
    porche(m)
    lenero(m)
    barril(m)

    bmesh.ops.recalc_face_normals(m.bm, faces=m.bm.faces)
    malla = bpy.data.meshes.new("SM_CasaGranjero")
    m.bm.to_mesh(malla)
    m.bm.free()
    for mat in (material("M_Casa", 0.85), material("M_Cristal", 0.15), material("M_Farol", 0.4, LUZ)):
        malla.materials.append(mat)
    obj = bpy.data.objects.new("SM_CasaGranjero", malla)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def exportar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / "casa_granjero.glb"
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", use_selection=True)
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC)

    dims = obj.dimensions
    metricas = {
        "triangulos": sum(len(p.vertices) - 2 for p in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "dimensiones_m": [round(d, 3) for d in dims],
    }
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    print("METRICAS", metricas)


def preview(obj):
    escena = bpy.context.scene
    suelo = bpy.data.meshes.new("Suelo")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
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
    cam_obj.location = (-9.5, -12.5, 8.5)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0, 2.0))
    cam_obj.rotation_euler = (objetivo - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    mundo = bpy.data.worlds.new("Cielo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.55, 0.75, 0.95, 1)
    mundo.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    escena.world = mundo

    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 1000
    escena.render.resolution_y = 800
    escena.render.filepath = str(OUT / "preview.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    casa = construir()
    exportar(casa)
    preview(casa)
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "casa_granjero.blend"))
