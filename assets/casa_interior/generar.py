"""Interior de la casa del granjero reproducible: ejecutar con Blender 5.

blender --background --factory-startup --python assets/casa_interior/generar.py

Casa de 16 x 10 m en forma de diorama, sin techo, con el muro sur y los tabiques
bajos para que la cámara isométrica vea dentro, en el estilo de referencia.png:
salón comedor con hogar, televisor y sofá, cocina abierta, baño y dormitorio.
Muebles de colores planos en el atributo `Col`; tarima, piedra, azulejo y colcha
llevan las texturas de ComfyUI. Guarda assets/casa_interior.blend, exporta el
GLB (fuente y publicado) y renderiza preview.png. Ver README.md.
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
OUT = ASSETS / "casa_interior"
PUBLIC = ASSETS.parent / "public" / "models" / "casa_interior.glb"
RNG = random.Random(1112027)

# Medidas (m). Suelo en z=0 y puerta en -Y de Blender (+Z en Babylon). El juego
# refleja x: las colisiones de src/world/homeInterior.ts usan estas medidas.
ANCHO = 16.0
FONDO = 10.0
ALTO = 2.7
MURO_BAJO = 0.28  # altura del muro sur
TABIQUE = 1.05  # altura de los tabiques entre estancias
PUERTA_X = 3.0  # la puerta da al salón
HUECO = 0.65
X, Y = ANCHO / 2, FONDO / 2

# Índices de material
OPACO, CRISTAL, FUEGO, SUELO, PIEDRA, COLCHA, AZULEJO, TELE = range(8)

# Paleta en sRGB; se guarda en lineal en el atributo de color.
YESO = (0.90, 0.81, 0.65)
VIGA = (0.46, 0.30, 0.18)
MADERA = (0.60, 0.39, 0.22)
MADERA_CLARA = (0.72, 0.52, 0.32)
BARRO = (0.72, 0.36, 0.20)
CERAMICA = (0.74, 0.74, 0.58)
PLATO = (0.90, 0.87, 0.76)
SABANA = (0.95, 0.92, 0.83)
METAL = (0.20, 0.20, 0.22)
PINTURA = (0.26, 0.47, 0.44)  # la misma puerta que la fachada
ESPARTO = (0.82, 0.68, 0.40)
ESPARTO_OSCURO = (0.66, 0.50, 0.28)
HOJA = (0.30, 0.55, 0.25)
AJO = (0.93, 0.90, 0.80)
HOLLIN = (0.08, 0.07, 0.06)
VIDRIO = (0.60, 0.78, 0.90)
LLAMA = (1.0, 0.62, 0.20)
BLANCO = (1.0, 1.0, 1.0)
LOZA = (0.93, 0.93, 0.90)
CORTINA = (0.55, 0.72, 0.74)
ESPEJO = (0.74, 0.84, 0.88)
TELA = (0.40, 0.48, 0.34)  # sofá
MANTA = (0.70, 0.30, 0.22)
PANTALLA = (0.30, 0.48, 0.66)
PIEDRA_CLARA = (0.78, 0.76, 0.70)  # encimera
NEVERA = (0.86, 0.87, 0.85)
ALFOMBRA_AZUL = (0.32, 0.44, 0.56)
TABLA_COCINA = (0.82, 0.62, 0.38)


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

    def torno(self, centro, perfil, color, lados=12, mat=OPACO):
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
        self._pintar(caras, color, mat)


def ventana(m, x, y, ancho=1.3, z0=1.25, alto=1.05):
    """Ventana de cuatro hojas en el muro del fondo."""
    zc = z0 + alto / 2
    m.caja((x, y, zc), (ancho, 0.04, alto), VIDRIO, mat=CRISTAL)
    t = 0.09
    for du in (-1, 1):
        m.caja((x + du * (ancho + t) / 2, y - 0.05, zc), (t, 0.1, alto + 2 * t), variar(MADERA))
    for dz in (-1, 1):
        m.caja((x, y - 0.05, zc + dz * (alto + t) / 2), (ancho, 0.1, t), variar(MADERA))
    m.caja((x, y - 0.04, zc), (0.05, 0.05, alto), MADERA)
    m.caja((x, y - 0.04, zc), (ancho, 0.05, 0.05), MADERA)


def tabique(m, x0, y0, x1, y1):
    """Tabique bajo entre estancias, para que la cámara vea lo que hay detrás."""
    g = 0.16
    largo = abs(x1 - x0) + abs(y1 - y0)
    c = ((x0 + x1) / 2, (y0 + y1) / 2)
    horizontal = y0 == y1
    med = (largo, g, TABIQUE) if horizontal else (g, largo, TABIQUE)
    m.caja((*c, TABIQUE / 2), med, YESO)
    tapa = (largo + 0.04, g + 0.08, 0.08) if horizontal else (g + 0.08, largo + 0.04, 0.08)
    m.caja((*c, TABIQUE + 0.04), tapa, variar(VIGA))
    zocalo = (largo, g + 0.04, 0.14) if horizontal else (g + 0.04, largo, 0.14)
    m.caja((*c, 0.07), zocalo, variar(VIGA))


def muros(m):
    # Suelo: la base asoma por fuera como en el diorama de la referencia
    m.caja((0, 0, -0.17), (ANCHO + 0.9, FONDO + 0.9, 0.3), VIGA)
    m.caja((0, 0, 0.0), (ANCHO, FONDO, 0.02), BLANCO, mat=SUELO, escala_uv=1.8)
    # El baño es de azulejo, algo por encima de la tarima
    m.caja((-5.5, -2.5, 0.01), (5.0, 5.0, 0.012), BLANCO, mat=AZULEJO, escala_uv=1.2)

    g = 0.2  # grosor del muro
    m.caja((0, Y + g / 2, ALTO / 2), (ANCHO + 2 * g, g, ALTO), YESO)
    for lado in (-1, 1):
        m.caja((lado * (X + g / 2), 0, ALTO / 2), (g, FONDO, ALTO), YESO)

    # Muro sur bajo, a ambos lados de la puerta
    a, b = PUERTA_X - HUECO, PUERTA_X + HUECO
    for x0, x1 in ((-X - g, a), (b, X + g)):
        m.caja(((x0 + x1) / 2, -Y - g / 2, MURO_BAJO / 2), (x1 - x0, g, MURO_BAJO), VIGA)

    # Entramado: rodapié, viga superior y postes
    for x0, y0, x1, y1 in ((-X, Y, X, Y), (-X, -Y, -X, Y), (X, -Y, X, Y)):
        c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0))
        largo = abs(x1 - x0) + abs(y1 - y0) + 0.3
        med = (largo, 0.16, 0.2) if y0 == y1 else (0.16, largo, 0.2)
        desp = Vector((0, -0.04, 0)) if y0 == y1 else Vector((-0.04 * (1 if x0 > 0 else -1), 0, 0))
        m.caja(c + desp + Vector((0, 0, 0.1)), med, variar(VIGA))
        m.caja(c + desp + Vector((0, 0, ALTO - 0.1)), med, variar(VIGA))
    for x in (-X + 0.08, -3.0, 0.75, 3.25, 5.0, X - 0.08):
        m.caja((x, Y - 0.05, ALTO / 2), (0.18, 0.14, ALTO), variar(VIGA))
    for lado in (-1, 1):
        x = lado * (X - 0.05)
        for y in (-Y + 0.08, 0.0, Y - 0.08):
            m.caja((x, y, ALTO / 2), (0.14, 0.18, ALTO), variar(VIGA))

    # Distribución: dormitorio y baño a un lado, salón y cocina abiertos al otro.
    # Los huecos del tabique central son las puertas del baño y del dormitorio.
    tabique(m, -3, -5, -3, -1.5)
    tabique(m, -3, -0.3, -3, 2.0)
    tabique(m, -3, 3.2, -3, 5)
    tabique(m, -8, 0, -3, 0)

    ventana(m, -5.2, Y - 0.03, z0=1.35, alto=0.95)
    ventana(m, 2.0, Y - 0.03)
    ventana(m, -1.3, Y - 0.03, ancho=1.1)


def cama(m):
    """Cama de matrimonio con el cabecero contra el muro del fondo."""
    cx, ancho, largo = -5.2, 1.7, 2.15
    y1 = Y - 0.1
    cy = y1 - largo / 2
    m.caja((cx, cy, 0.3), (ancho, largo, 0.16), variar(MADERA))
    for sx in (-1, 1):
        m.caja((cx + sx * (ancho / 2 - 0.05), y1 - 0.05, 0.55), (0.11, 0.11, 1.1), variar(VIGA))
        m.caja((cx + sx * (ancho / 2 - 0.05), y1 - largo + 0.05, 0.36), (0.11, 0.11, 0.72), variar(VIGA))
    m.caja((cx, y1 - 0.05, 0.72), (ancho - 0.1, 0.06, 0.6), variar(MADERA))
    m.caja((cx, y1 - largo + 0.05, 0.46), (ancho - 0.1, 0.06, 0.34), variar(MADERA))
    m.caja((cx, cy, 0.46), (ancho - 0.14, largo - 0.16, 0.16), SABANA)
    m.caja((cx, cy - 0.28, 0.54), (ancho - 0.06, largo - 0.72, 0.1), BLANCO, mat=COLCHA, escala_uv=1.2)
    m.caja((cx, y1 - 0.92, 0.595), (ancho - 0.06, 0.24, 0.03), SABANA)
    for dx in (-0.38, 0.38):
        m.caja((cx + dx, y1 - 0.38, 0.6), (0.68, 0.42, 0.16), SABANA)
    # Mesitas, una con vela, y alfombra a los pies
    for x, vela in ((-6.45, True), (-3.95, False)):
        y = Y - 0.4
        m.caja((x, y, 0.28), (0.5, 0.46, 0.56), variar(MADERA))
        m.caja((x, y, 0.58), (0.58, 0.54, 0.05), variar(MADERA_CLARA))
        m.caja((x, y - 0.235, 0.3), (0.34, 0.02, 0.2), variar(VIGA))
        if vela:
            m.torno((x, y, 0.6), ((0.1, 0), (0.1, 0.02), (0.03, 0.03)), BARRO)
            m.torno((x, y, 0.63), ((0.03, 0), (0.03, 0.12)), SABANA, lados=8)
            m.torno((x, y, 0.75), ((0.02, 0), (0.028, 0.03), (0.003, 0.09)), LLAMA, lados=8, mat=FUEGO)
    m.caja((-5.2, 1.5, 0.01), (2.6, 1.7, 0.015), ALFOMBRA_AZUL)
    m.caja((-5.2, 1.5, 0.014), (2.2, 1.3, 0.015), variar(ESPARTO, 0.04))


def armario(m):
    """Armario ropero contra el muro oeste, con las puertas hacia la habitación."""
    x, y = -7.6, 1.5
    an, fo, alto = 0.75, 2.1, 2.25
    m.caja((x, y, alto / 2), (an, fo, alto), variar(MADERA))
    m.caja((x, y, alto + 0.04), (an + 0.1, fo + 0.1, 0.08), variar(VIGA))
    m.caja((x, y, 0.05), (an + 0.04, fo + 0.04, 0.1), variar(VIGA))
    cara = x + an / 2 + 0.012
    for dy in (-0.525, 0.525):
        m.caja((cara, y + dy, alto / 2), (0.025, 0.96, alto - 0.3), variar(MADERA_CLARA))
        m.caja((cara + 0.02, y + dy, alto / 2), (0.02, 0.72, alto - 0.75), variar(MADERA))
        m.caja((cara + 0.03, y + (0.42 if dy < 0 else -0.42), 1.1), (0.03, 0.03, 0.2), METAL)


def bano(m):
    # Bañera contra el tabique
    x, y = -6.9, -0.55
    m.caja((x, y, 0.28), (2.0, 0.84, 0.56), LOZA)
    m.caja((x, y, 0.55), (1.8, 0.64, 0.03), (0.45, 0.68, 0.82))
    m.caja((x - 0.8, y, 0.65), (0.05, 0.05, 0.2), METAL)
    # Ducha en el rincón: plato, barra con alcachofa y cortina. Se puede pisar.
    sx, sy = -7.35, -4.35
    m.caja((sx, sy, 0.02), (1.2, 1.2, 0.04), LOZA)
    m.caja((sx, sy, 0.04), (1.0, 1.0, 0.02), (0.72, 0.78, 0.82))
    m.caja((sx - 0.55, sy + 0.45, 1.1), (0.04, 0.04, 2.1), METAL)
    m.caja((sx - 0.38, sy + 0.45, 2.12), (0.36, 0.04, 0.04), METAL)
    m.torno((sx - 0.22, sy + 0.45, 2.02), ((0.1, 0), (0.04, 0.08)), METAL, lados=10)
    # La cortina va recogida contra el muro sur: deja libre la entrada
    m.caja((sx, sy - 0.58, 2.05), (1.25, 0.03, 0.03), METAL)
    for i in range(3):
        m.caja((sx + 0.42 + i * 0.09, sy - 0.58, 1.1), (0.08, 0.05, 1.85), variar(CORTINA, 0.06))
    # Inodoro contra el muro oeste
    x, y = -7.6, -2.5
    m.caja((x - 0.2, y, 0.62), (0.2, 0.46, 0.5), LOZA)
    m.torno((x + 0.12, y, 0), ((0.13, 0), (0.17, 0.2), (0.21, 0.4), (0.22, 0.42)), LOZA, lados=14)
    m.torno((x + 0.12, y, 0.42), ((0.23, 0), (0.23, 0.03)), SABANA, lados=14)
    # Lavabo con mueble y espejo sobre el tabique
    x, y = -3.45, -3.3
    m.caja((x, y, 0.4), (0.55, 1.0, 0.8), variar(MADERA))
    m.caja((x, y, 0.82), (0.62, 1.06, 0.05), LOZA)
    m.torno((x, y, 0.85), ((0.14, 0), (0.22, 0.07)), LOZA, lados=14)
    m.caja((x + 0.2, y, 0.95), (0.03, 0.03, 0.18), METAL)
    m.caja((-3.1, y, 1.55), (0.06, 0.8, 0.9), variar(VIGA))
    m.caja((-3.14, y, 1.55), (0.03, 0.66, 0.76), ESPEJO)
    # Toallero y alfombrilla
    m.caja((-5.2, -0.13, 0.9), (0.9, 0.03, 0.03), METAL)
    m.caja((-5.2, -0.15, 0.68), (0.6, 0.03, 0.45), (0.86, 0.46, 0.38))
    m.caja((-6.0, -1.6, 0.02), (1.2, 0.7, 0.02), ALFOMBRA_AZUL)


def tele(m):
    """Televisor sobre un mueble bajo, mirando al sofá."""
    x, y = -2.62, -2.9
    m.caja((x, y, 0.27), (0.48, 1.6, 0.54), variar(MADERA))
    m.caja((x, y, 0.56), (0.54, 1.66, 0.04), variar(VIGA))
    for dy in (-0.4, 0.4):
        m.caja((x + 0.245, y + dy, 0.27), (0.01, 0.7, 0.4), variar(MADERA_CLARA))
    m.caja((x, y, 0.61), (0.22, 0.46, 0.06), METAL)
    m.caja((x, y, 0.72), (0.05, 0.1, 0.18), METAL)
    m.caja((x, y, 1.1), (0.07, 1.42, 0.82), METAL)
    m.caja((x + 0.04, y, 1.1), (0.01, 1.32, 0.72), PANTALLA, mat=TELE)


def sofa(m):
    """Sofá de tres plazas mirando al televisor, con paso por delante y por detrás."""
    x, y = 1.0, -2.9
    an, fo = 0.95, 2.25
    m.caja((x, y, 0.2), (an, fo, 0.28), TELA)
    m.caja((x + an / 2 - 0.1, y, 0.5), (0.2, fo, 0.75), TELA)
    for dy in (-1, 1):
        m.caja((x, y + dy * (fo / 2 - 0.1), 0.42), (an, 0.2, 0.42), TELA)
    for i in range(3):
        dy = -0.64 + i * 0.64
        m.caja((x - 0.1, y + dy, 0.4), (0.68, 0.61, 0.14), variar(TELA, 0.08))
        m.caja((x + 0.25, y + dy, 0.66), (0.16, 0.58, 0.42), variar(TELA, 0.1))
    m.caja((x + 0.2, y - 0.75, 0.68), (0.14, 0.42, 0.34), MANTA)
    # Mesa de centro y alfombra de esparto, por anillos
    for i, r in enumerate((1.6, 1.38, 1.15, 0.9, 0.62, 0.32)):
        m.torno((-0.8, y, 0), ((r, 0), (r, 0.012 + i * 0.002)), ESPARTO_OSCURO if i % 2 else ESPARTO, lados=32)
    m.caja((-1.0, y, 0.4), (0.6, 1.1, 0.05), variar(MADERA_CLARA))
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caja((-1.0 + sx * 0.24, y + sy * 0.48, 0.19), (0.05, 0.05, 0.38), variar(VIGA))
    m.torno((-1.0, y + 0.25, 0.425), ((0.07, 0), (0.12, 0.05)), BARRO)
    # Butaca junto al hogar
    x, y = 5.7, -3.4
    m.caja((x, y, 0.2), (0.85, 0.85, 0.28), MANTA)
    m.caja((x - 0.34, y, 0.55), (0.17, 0.85, 0.7), MANTA)
    for dy in (-1, 1):
        m.caja((x, y + dy * 0.36, 0.45), (0.85, 0.14, 0.34), MANTA)
    m.caja((x + 0.05, y, 0.38), (0.6, 0.56, 0.1), variar(MANTA, 0.12))


def hogar(m):
    """Chimenea de piedra contra el muro este, con repisa y fuego."""
    x0 = X - 0.03
    y, ancho, fondo = -2.2, 2.1, 0.8
    xc = x0 - fondo / 2
    s = 1.5  # metros de muro por repetición de la textura
    m.caja((xc, y, 0.06), (fondo + 0.1, ancho + 0.1, 0.12), BLANCO, mat=PIEDRA, escala_uv=s)
    for dy in (-1, 1):
        m.caja((xc, y + dy * 0.8, 0.55), (fondo, 0.5, 1.0), BLANCO, mat=PIEDRA, escala_uv=s)
    m.caja((xc, y, 1.0), (fondo, 1.1, 0.2), BLANCO, mat=PIEDRA, escala_uv=s)
    m.caja((xc + 0.17, y, 0.5), (fondo - 0.3, 1.1, 0.8), HOLLIN)
    m.caja((xc, y, 1.14), (fondo + 0.14, ancho + 0.16, 0.1), variar(VIGA))
    m.caja((x0 - 0.25, y, 1.92), (0.5, 1.3, 1.56), BLANCO, mat=PIEDRA, escala_uv=s)
    bx = xc - 0.08
    for dy, rot in ((-0.16, 0.35), (0.16, -0.35)):
        m.caja((bx, y + dy, 0.2), (0.14, 0.6, 0.12), variar(VIGA), Matrix.Rotation(rot, 3, "Z"))
    m.caja((bx, y, 0.16), (0.34, 0.6, 0.04), LLAMA, mat=FUEGO)
    for dy, h in ((-0.2, 0.32), (0.0, 0.5), (0.2, 0.28)):
        m.torno((bx, y + dy, 0.2), ((0.11, 0), (0.1, h * 0.4), (0.005, h)), LLAMA, lados=7, mat=FUEGO)
    # Sobre la repisa y leña al lado
    m.torno((xc, y - 0.6, 1.19), ((0.06, 0), (0.11, 0.12), (0.05, 0.22)), BARRO)
    m.torno((xc, y + 0.6, 1.19), ((0.05, 0), (0.09, 0.1), (0.04, 0.18)), CERAMICA)
    m.caja((xc + 0.1, y - 1.5, 0.15), (0.5, 0.5, 0.3), variar(ESPARTO_OSCURO))
    for dx in (-0.14, 0.0, 0.14):
        m.caja((xc + 0.1 + dx, y - 1.5, 0.36), (0.11, 0.46, 0.11), variar(VIGA, 0.15))


def silla(m, x, y, giro):
    """Silla con el respaldo hacia `giro` (0: hacia -Y)."""
    rot = Matrix.Rotation(giro, 3, "Z")
    o = Vector((x, y, 0))
    a = 0.42
    m.caja(o + Vector((0, 0, 0.45)), (a, a, 0.05), variar(MADERA), rot)
    for sx in (-1, 1):
        for sy in (-1, 1):
            alto = 0.95 if sy < 0 else 0.45
            p = rot @ Vector((sx * (a / 2 - 0.03), sy * (a / 2 - 0.03), alto / 2))
            m.caja(o + p, (0.05, 0.05, alto), variar(VIGA), rot)
    for z in (0.7, 0.88):
        m.caja(o + rot @ Vector((0, -a / 2 + 0.03, z)), (a - 0.06, 0.03, 0.08), variar(MADERA), rot)


def comedor(m):
    x, y = 5.6, -0.4
    an, fo = 1.9, 1.0
    for i in range(5):
        m.caja((x, y - fo / 2 + (i + 0.5) * fo / 5, 0.76), (an, fo / 5 - 0.01, 0.06), variar(MADERA_CLARA, 0.1))
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caja((x + sx * (an / 2 - 0.08), y + sy * (fo / 2 - 0.08), 0.365), (0.09, 0.09, 0.73), variar(VIGA))
    m.torno((x, y, 0.79), ((0.07, 0), (0.17, 0.09), (0.18, 0.1)), BARRO)
    for dx, dy in ((-0.04, 0), (0.05, 0.05), (0.02, -0.05)):
        m.caja((x + dx, y + dy, 0.9), (0.08, 0.08, 0.08), variar(HOJA, 0.2))
    for sx in (-0.45, 0.45):
        for lado in (-1, 1):
            m.torno((x + sx, y + lado * 0.28, 0.79), ((0.09, 0), (0.12, 0.02)), PLATO)
            silla(m, x + sx, y + lado * 0.74, 0 if lado < 0 else math.pi)


def cocina(m):
    """Cocina abierta: encimera en el fondo, fogones, fregadero, nevera e isla."""
    y = Y - 0.38
    x0, x1 = 0.55, 7.85
    xc, largo = (x0 + x1) / 2, x1 - x0
    m.caja((xc, y, 0.43), (largo, 0.62, 0.86), variar(MADERA))
    m.caja((xc, y, 0.88), (largo + 0.04, 0.68, 0.05), PIEDRA_CLARA)
    m.caja((xc, Y - 0.015, 1.2), (largo, 0.025, 0.6), BLANCO, mat=AZULEJO, escala_uv=0.8)
    # Frentes de los muebles
    x = x0 + 0.35
    while x < x1 - 0.2:
        m.caja((x, y - 0.32, 0.46), (0.62, 0.02, 0.68), variar(PINTURA, 0.06))
        m.caja((x + 0.22, y - 0.34, 0.68), (0.03, 0.02, 0.14), METAL)
        x += 0.68
    # Fregadero bajo la ventana
    m.caja((2.0, y - 0.02, 0.905), (0.8, 0.46, 0.012), METAL)
    m.caja((2.0, y - 0.02, 0.91), (0.68, 0.36, 0.01), (0.35, 0.37, 0.4))
    m.caja((2.0, y + 0.23, 1.02), (0.04, 0.04, 0.24), METAL)
    m.caja((2.0, y + 0.13, 1.13), (0.04, 0.22, 0.03), METAL)
    # Fogones con horno y campana
    m.caja((4.2, y, 0.45), (0.78, 0.66, 0.9), METAL)
    m.caja((4.2, y - 0.34, 0.42), (0.6, 0.02, 0.42), (0.12, 0.12, 0.14))
    m.caja((4.2, y, 0.91), (0.72, 0.58, 0.012), (0.08, 0.08, 0.09))
    for dx in (-0.18, 0.18):
        for dy in (-0.14, 0.14):
            m.torno((4.2 + dx, y + dy, 0.915), ((0.09, 0), (0.09, 0.012)), METAL, lados=12)
    m.torno((4.38, y - 0.14, 0.93), ((0.12, 0), (0.14, 0.14), (0.14, 0.17)), BARRO)
    m.torno((4.02, y + 0.14, 0.93), ((0.1, 0), (0.1, 0.1)), METAL, lados=12)
    m.caja((4.2, Y - 0.25, 1.95), (0.85, 0.5, 0.18), METAL)
    m.caja((4.2, Y - 0.12, 2.35), (0.3, 0.24, 0.62), METAL)
    # Estantes con cerámica
    for z in (1.6, 2.1):
        m.caja((6.3, Y - 0.16, z), (1.8, 0.28, 0.05), variar(MADERA_CLARA))
    jarra = ((0.09, 0), (0.15, 0.1), (0.14, 0.22), (0.07, 0.28), (0.09, 0.33))
    m.torno((5.75, Y - 0.16, 1.625), jarra, BARRO)
    m.torno((6.2, Y - 0.16, 1.625), tuple((r * 0.75, z * 0.8) for r, z in jarra), CERAMICA)
    m.torno((6.75, Y - 0.16, 1.625), tuple((r * 0.8, z * 0.7) for r, z in jarra), BARRO)
    for dx in (-0.6, -0.2, 0.2, 0.6):
        m.torno((6.3 + dx, Y - 0.16, 2.125), ((0.07, 0), (0.14, 0.04), (0.15, 0.06)), PLATO)
    # Ajos y hierbas en los postes
    for i in range(5):
        dx, z = (0.05 if i % 2 else -0.05), 2.1 - i * 0.1
        m.torno((3.25 + dx, Y - 0.17, z), ((0.015, 0), (0.06, 0.03), (0.06, 0.06), (0.012, 0.11)), AJO, lados=8)
    for i in range(7):
        dx, dz = RNG.uniform(-0.09, 0.09), -i * 0.07
        m.caja((0.75 + dx, Y - 0.17, 2.16 + dz), (0.09, 0.05, 0.12), variar(HOJA, 0.2), Matrix.Rotation(dx * 3, 3, "Y"))
    # Nevera
    x, y2 = 0.0, Y - 0.4
    m.caja((x, y2, 0.95), (0.8, 0.72, 1.9), NEVERA)
    m.caja((x, y2 - 0.365, 1.35), (0.74, 0.012, 0.95), variar(NEVERA, 0.03))
    m.caja((x, y2 - 0.365, 0.42), (0.74, 0.012, 0.74), variar(NEVERA, 0.03))
    for z in (1.0, 0.85):
        m.caja((x + 0.3, y2 - 0.385, z), (0.03, 0.03, 0.22), METAL)
    # Isla con taburetes hacia el salón, tabla de cortar y verdura
    x, y = 3.6, 2.75
    m.caja((x, y, 0.45), (2.5, 0.8, 0.9), variar(MADERA))
    m.caja((x, y, 0.93), (2.66, 0.96, 0.06), variar(MADERA_CLARA))
    m.caja((x + 0.5, y, 0.97), (0.5, 0.32, 0.03), variar(TABLA_COCINA))
    for dx in (0.38, 0.5, 0.62):
        m.caja((x + dx, y, 1.0), (0.09, 0.09, 0.05), (0.90, 0.48, 0.16))
    m.torno((x - 0.65, y, 0.96), ((0.09, 0), (0.2, 0.1)), BARRO)
    for dx, dy in ((-0.68, 0), (-0.58, 0.05), (-0.62, -0.06)):
        m.torno((x + dx, y + dy, 1.04), ((0.02, 0), (0.06, 0.04), (0.02, 0.09)), (0.82, 0.2, 0.16), lados=8)
    for dx in (-0.8, 0, 0.8):
        m.torno((x + dx, y - 0.75, 0), ((0.14, 0), (0.05, 0.05), (0.04, 0.58), (0.17, 0.6), (0.17, 0.66)), variar(VIGA), lados=10)


def puerta(m):
    """Marco en el muro sur con la hoja abierta hacia fuera y felpudo."""
    y = -Y - 0.1
    x = PUERTA_X
    for du in (-1, 1):
        m.caja((x + du * 0.65, y, 1.1), (0.14, 0.24, 2.2), variar(VIGA))
    m.caja((x, y, 2.26), (1.44, 0.24, 0.14), variar(VIGA))
    m.caja((x, y, 0.02), (1.16, 0.24, 0.04), variar(MADERA_CLARA))
    rot = Matrix.Rotation(math.radians(-100), 3, "Z")
    o = Vector((x - 0.58, y - 0.1, 0))
    for i in range(5):
        c = o + rot @ Vector(((i + 0.5) * 1.16 / 5, 0, 1.08))
        m.caja(c, (1.16 / 5 - 0.012, 0.05, 2.1), variar(PINTURA, 0.05), rot)
    m.caja((x, -Y + 0.34, 0.012), (1.0, 0.6, 0.02), (0.62, 0.30, 0.22))
    m.caja((x, -Y + 0.34, 0.016), (0.84, 0.46, 0.02), ESPARTO_OSCURO)


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
    muros(m)
    cama(m)
    armario(m)
    bano(m)
    tele(m)
    sofa(m)
    hogar(m)
    comedor(m)
    cocina(m)
    puerta(m)

    bmesh.ops.recalc_face_normals(m.bm, faces=m.bm.faces)
    malla = bpy.data.meshes.new("SM_CasaInterior")
    m.bm.to_mesh(malla)
    m.bm.free()
    for mat in (
        material("M_Interior", 0.8),
        material("M_Cristal", 0.15),
        material("M_Fuego", 0.5, LLAMA),
        material_textura("M_Suelo", "suelo.png"),
        material_textura("M_Piedra", "piedra.png"),
        material_textura("M_Colcha", "colcha.png"),
        material_textura("M_Azulejo", "azulejo.png"),
        material("M_Tele", 0.3, PANTALLA, 1.0),
    ):
        malla.materials.append(mat)
    obj = bpy.data.objects.new("SM_CasaInterior", malla)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def exportar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / "casa_interior.glb"
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
    sol_obj.rotation_euler = (math.radians(40), math.radians(-15), math.radians(-20))
    escena.collection.objects.link(sol_obj)

    # Misma orientación que la cámara del juego: 45° desde la puerta
    cam = bpy.data.cameras.new("Camara")
    cam.lens = 35
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (0, -14, 14)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0.3, 0.6))
    cam_obj.rotation_euler = (objetivo - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    mundo = bpy.data.worlds.new("Fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.9, 0.85, 0.75, 1)
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
    preview()
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "casa_interior.blend"))
