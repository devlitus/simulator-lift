"""Interior del almacén reproducible: ejecutar con Blender 5.

blender --background --factory-startup --python assets/almacen_interior/generar.py

Almacén de 16 x 12 m en forma de diorama, sin techo y con el muro sur bajo para
que la cámara isométrica vea dentro. Dos mallas, porque el juego vuelve translúcida
la segunda cuando el granjero pasa por debajo: SM_AlmacenBase (planta baja, muros y
escalera) y SM_AlmacenAltillo (losa a 2,6 m sobre la mitad del fondo y lo que hay
encima). Guarda assets/almacen_interior.blend, exporta el GLB (fuente y publicado)
y renderiza preview.png. Ver README.md.
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
OUT = ASSETS / "almacen_interior"
PUBLIC = ASSETS.parent / "public" / "models" / "almacen_interior.glb"
RNG = random.Random(1112028)

# Medidas (m). Suelo en z=0 y frente en -Y de Blender (+Z en Babylon). El juego
# refleja x: las colisiones de src/world/warehouse.ts usan estas medidas.
ANCHO = 16.0
FONDO = 12.0
ALTO = 6.0
MURO_BAJO = 0.28  # altura del muro sur
LOSA_Z = 2.6  # suelo del altillo
LOSA_GROSOR = 0.3
PUERTA_Y = -3.0  # en el muro este (+X), el que da a la parcela en el pueblo
X, Y = ANCHO / 2, FONDO / 2

# Estanterías: mismas posiciones en los dos niveles
ESTANTE_BX = (-4.8, 0.0, 4.8)
ESTANTE_ANCHO = 3.4
ESTANTE_FONDO = 0.7
ESTANTE_Y = 5.55
ESTANTE_ALTO = 2.2
BALDAS = (0.15, 0.7, 1.25)  # la franja superior queda para el rótulo

ESCALERA_X = 3.0

# Índices de material
OPACO, CRISTAL, SUELO, TABLAS, TARIMA, ARPILLERA = range(6)

# Paleta en sRGB; se guarda en lineal en el atributo de color.
VIGA = (0.40, 0.26, 0.15)
MADERA = (0.60, 0.39, 0.22)
MADERA_CLARA = (0.74, 0.54, 0.33)
METAL = (0.42, 0.44, 0.46)
METAL_CLARO = (0.70, 0.72, 0.72)
PINTURA = (0.55, 0.20, 0.15)  # la puerta roja de la fachada
VIDRIO = (0.60, 0.78, 0.90)
BLANCO = (1.0, 1.0, 1.0)
PAJA = (0.84, 0.70, 0.36)
PAJA_OSCURA = (0.66, 0.52, 0.24)
CUERDA = (0.48, 0.36, 0.20)
HOJA = (0.30, 0.55, 0.25)
ZANAHORIA = (0.90, 0.48, 0.14)
TOMATE = (0.82, 0.20, 0.16)
CALABAZA = (0.90, 0.55, 0.12)
HUEVO = (0.95, 0.90, 0.78)
LANA = (0.93, 0.91, 0.85)
LANA_TENIDA = (0.70, 0.62, 0.74)
MIMBRE = (0.70, 0.52, 0.28)
# Cada animal, un color: marca el suelo de su box y la banda de sus sacos
COLOR_GALLINA = (0.86, 0.66, 0.18)
COLOR_OVEJA = (0.38, 0.58, 0.72)
COLOR_VACA = (0.42, 0.62, 0.30)


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


def ventana(m, x, z0=3.3, ancho=1.05, alto=1.7):
    """Ventana de cuatro hojas en el muro del fondo, por encima del altillo."""
    y = Y - 0.03
    zc = z0 + alto / 2
    m.caja((x, y, zc), (ancho, 0.04, alto), VIDRIO, mat=CRISTAL)
    t = 0.09
    for du in (-1, 1):
        m.caja((x + du * (ancho + t) / 2, y - 0.05, zc), (t, 0.1, alto + 2 * t), variar(VIGA))
    for dz in (-1, 1):
        m.caja((x, y - 0.05, zc + dz * (alto + t) / 2), (ancho, 0.1, t), variar(VIGA))
    m.caja((x, y - 0.04, zc), (0.05, 0.05, alto), VIGA)
    m.caja((x, y - 0.04, zc), (ancho, 0.05, 0.05), VIGA)


def muros(m):
    # Suelo: la base asoma por fuera como en el diorama de la casa
    m.caja((0, 0, -0.17), (ANCHO + 0.9, FONDO + 0.9, 0.3), VIGA)
    m.caja((0, 0, 0.0), (ANCHO, FONDO, 0.02), BLANCO, mat=SUELO, escala_uv=3.0)

    g = 0.2  # grosor del muro
    s = 2.4  # metros de muro por repetición de la textura
    m.caja((0, Y + g / 2, ALTO / 2), (ANCHO + 2 * g, g, ALTO), BLANCO, mat=TABLAS, escala_uv=s)
    for lado in (-1, 1):
        m.caja((lado * (X + g / 2), 0, ALTO / 2), (g, FONDO, ALTO), BLANCO, mat=TABLAS, escala_uv=s)
    m.caja((0, -Y - g / 2, MURO_BAJO / 2), (ANCHO + 2 * g, g, MURO_BAJO), VIGA)

    # Entramado: viga superior, rodapié y postes
    for lado in (-1, 1):
        x = lado * (X - 0.05)
        m.caja((x, 0, 0.1), (0.14, FONDO, 0.2), variar(VIGA))
        m.caja((x, 0, ALTO - 0.1), (0.14, FONDO, 0.2), variar(VIGA))
        for y in (-Y + 0.08, Y - 0.08):
            m.caja((x, y, ALTO / 2), (0.14, 0.18, ALTO), variar(VIGA))
        m.caja((x, 0, LOSA_Z / 2), (0.14, 0.18, LOSA_Z), variar(VIGA))
    m.caja((0, Y - 0.05, 0.1), (ANCHO, 0.14, 0.2), variar(VIGA))
    m.caja((0, Y - 0.05, ALTO - 0.1), (ANCHO, 0.14, 0.2), variar(VIGA))
    for x in (-X + 0.08, -2.4 - 0.75, 2.4 + 0.75, X - 0.08):
        m.caja((x, Y - 0.05, ALTO / 2), (0.16, 0.14, ALTO), variar(VIGA))

    for x in (-2.4, 2.4):
        ventana(m, x)


def puerta(m):
    """Puerta principal en el muro este, cerrada, con su felpudo: la única salida."""
    x = X - 0.03
    y = PUERTA_Y
    for dy in (-1, 1):
        m.caja((x, y + dy * 0.72, 1.2), (0.1, 0.16, 2.4), variar(VIGA))
    m.caja((x, y, 2.45), (0.1, 1.6, 0.16), variar(VIGA))
    # Doble hoja con cruz, como la fachada
    for dy in (-1, 1):
        cy = y + dy * 0.32
        for i in range(4):
            m.caja((x - 0.03, cy - 0.24 + i * 0.16, 1.18), (0.05, 0.15, 2.34), variar(PINTURA, 0.06))
        m.caja((x - 0.07, cy, 2.25), (0.03, 0.6, 0.1), variar(BLANCO, 0.04))
        m.caja((x - 0.07, cy, 0.12), (0.03, 0.6, 0.1), variar(BLANCO, 0.04))
    m.caja((x - 0.1, y - 0.06, 1.1), (0.04, 0.03, 0.2), METAL)
    m.caja((x - 0.1, y + 0.06, 1.1), (0.04, 0.03, 0.2), METAL)
    m.caja((X - 0.5, y, 0.012), (0.75, 1.1, 0.02), (0.62, 0.30, 0.22))
    m.caja((X - 0.5, y, 0.016), (0.6, 0.94, 0.02), PAJA_OSCURA)


def pilares(m):
    """Pies derechos del altillo, en su borde: dejan paso por debajo."""
    for x in (-4.0, 0.5, 5.5):
        y = 0.1
        m.caja((x, y, (LOSA_Z - LOSA_GROSOR) / 2), (0.28, 0.28, LOSA_Z - LOSA_GROSOR), variar(VIGA))
        m.caja((x, y, 0.06), (0.4, 0.4, 0.12), variar(VIGA, 0.04))


def escalera(m):
    """Escalera de mano apoyada en el borde del altillo; asoma por encima de él."""
    z_arriba = LOSA_Z + 0.85
    y0, y1 = -1.0, 0.25
    largo = math.hypot(y1 - y0, z_arriba)
    giro = Matrix.Rotation(math.atan2(y1 - y0, z_arriba), 3, "X").inverted()
    for dx in (-0.3, 0.3):
        c = Vector((ESCALERA_X + dx, (y0 + y1) / 2, z_arriba / 2))
        m.caja(c, (0.08, 0.08, largo), variar(MADERA), giro)
    z = 0.28
    while z < z_arriba - 0.1:
        y = y0 + (y1 - y0) * z / z_arriba
        m.caja((ESCALERA_X, y, z), (0.6, 0.06, 0.05), variar(MADERA_CLARA))
        z += 0.3


def saco(m, x, y, z, ancho, alto, color, giro=0.0):
    """Saco de arpillera atado por arriba, con una banda del color de su animal."""
    rot = Matrix.Rotation(giro, 3, "Z")
    o = Vector((x, y, z))
    fondo = ancho * 0.72
    m.caja(o + Vector((0, 0, alto * 0.4)), (ancho, fondo, alto * 0.8), BLANCO, rot, ARPILLERA, 0.5)
    m.caja(o + Vector((0, 0, alto * 0.85)), (ancho * 0.7, fondo * 0.7, alto * 0.14), BLANCO, rot, ARPILLERA, 0.5)
    m.caja(o + Vector((0, 0, alto * 0.95)), (ancho * 0.3, fondo * 0.3, alto * 0.1), CUERDA, rot)
    m.caja(o + Vector((0, 0, alto * 0.42)), (ancho + 0.012, fondo + 0.012, alto * 0.2), color, rot)


def fardo(m, x, y, z, an=1.0, fo=0.55, al=0.5):
    """Fardo de paja con sus dos cuerdas."""
    m.caja((x, y, z + al / 2), (an, fo, al), variar(PAJA, 0.06))
    for dx in (-0.25, 0.25):
        m.caja((x + dx * an, y, z + al / 2), (0.03, fo + 0.01, al + 0.01), CUERDA)


def zona_pienso(m):
    """Tres boxes contra el muro oeste, uno por animal, separados por tablas bajas."""
    x0, x1 = -X, -5.0
    xc = (x0 + x1) / 2
    for y in (-4.0, -2.0, 0.0):
        m.caja((xc, y, 0.45), (x1 - x0, 0.1, 0.9), variar(MADERA))
        m.caja((xc, y, 0.92), (x1 - x0, 0.16, 0.06), variar(VIGA))
        m.caja((x1, y, 0.8), (0.14, 0.16, 1.6), variar(VIGA))  # poste con el rótulo

    for yc, color in ((-5.0, COLOR_GALLINA), (-3.0, COLOR_OVEJA), (-1.0, COLOR_VACA)):
        m.caja((xc, yc, 0.014), (x1 - x0 - 0.1, 1.86, 0.012), variar(color, 0.05))
        m.caja((xc, yc, 0.018), (x1 - x0 - 0.5, 1.5, 0.012), variar(PAJA_OSCURA, 0.05))

    # Gallina: sacos pequeños de grano y un montón de maíz
    for dy, dz in ((-0.45, 0), (0.45, 0), (0.0, 0)):
        saco(m, -7.5, -5.0 + dy, dz, 0.5, 0.72, COLOR_GALLINA, RNG.uniform(-0.15, 0.15))
    saco(m, -7.5, -5.2, 0.6, 0.5, 0.55, COLOR_GALLINA, 0.2)
    m.torno((-6.72, -5.0, 0.02), ((0.3, 0), (0.22, 0.09), (0.05, 0.17)), (0.92, 0.72, 0.2), lados=10)

    # Oveja: sacos medianos y fardos pequeños
    for dy in (-0.42, 0.42):
        saco(m, -7.55, -3.0 + dy, 0, 0.62, 0.92, COLOR_OVEJA, RNG.uniform(-0.1, 0.1))
    fardo(m, -7.0, -3.0, 0, 0.5, 1.2, 0.4)
    saco(m, -7.55, -3.0, 0.8, 0.6, 0.55, COLOR_OVEJA, -0.15)

    # Vaca: el saco grande y fardos de paja apilados
    saco(m, -7.5, -1.48, 0, 0.72, 1.1, COLOR_VACA, 0.08)
    for z, dy in ((0, 0.0), (0, 0.55)):
        fardo(m, -7.3, -1.0 + dy, z, 1.2, 0.5, 0.5)
    fardo(m, -7.3, -0.7, 0.5, 1.2, 0.5, 0.5)


def cajas(m):
    """Cajas y un barril en el rincón sureste."""
    x, y = 6.8, -5.2
    for dx, dy, lado in ((-0.55, 0.05, 0.9), (0.45, -0.1, 0.8)):
        m.caja((x + dx, y + dy, lado / 2), (lado, lado, lado), variar(MADERA))
        m.caja((x + dx, y + dy - lado / 2, lado / 2), (lado + 0.02, 0.02, 0.1), variar(VIGA))
    m.caja((x - 0.5, y, 1.15), (0.6, 0.6, 0.5), variar(MADERA_CLARA))
    m.torno((x + 0.5, y + 0.1, 0.8), ((0.26, 0), (0.3, 0.2), (0.26, 0.42)), variar(VIGA), lados=12)


def caja_baja(m, x, y, z, ancho, color=MADERA_CLARA):
    """Caja abierta para la balda; devuelve la altura donde apoya lo que lleva."""
    fondo = ESTANTE_FONDO - 0.14
    m.caja((x, y, z + 0.09), (ancho, fondo, 0.18), variar(color))
    return z + 0.18


def bolas(m, x, y, z, ancho, r, color, perfil=None, n=None):
    """Reparte frutos o bultos por una balda, en dos filas al tresbolillo."""
    perfil = perfil or ((r * 0.5, 0), (r, r * 0.6), (r, r * 1.2), (r * 0.5, r * 1.8))
    n = n or max(2, int(ancho / (r * 2.3)))
    for fila, dy in enumerate((0.14, -0.14)):
        for i in range(n):
            px = x - ancho / 2 + (i + 0.5 + fila * 0.25) * ancho / n
            m.torno((min(px, x + ancho / 2 - r), y + dy, z), perfil, variar(color, 0.1), lados=8)


def fila_zanahorias(m, x, y, z, ancho):
    z = caja_baja(m, x, y, z, ancho)
    for i in range(int(ancho / 0.14)):
        for dy in (-0.14, 0.0, 0.14):
            px = x - ancho / 2 + (i + 0.5) * 0.14
            py = y + dy + RNG.uniform(-0.02, 0.02)
            m.torno((px, py, z - 0.04), ((0.02, 0), (0.055, 0.1)), variar(ZANAHORIA, 0.1), lados=6)
            m.caja((px, py, z + 0.1), (0.05, 0.03, 0.09), variar(HOJA, 0.15))


def fila_tomates(m, x, y, z, ancho):
    z = caja_baja(m, x, y, z, ancho)
    bolas(m, x, y, z - 0.03, ancho - 0.1, 0.075, TOMATE)


def fila_calabazas(m, x, y, z, ancho):
    r = 0.17
    perfil = ((r * 0.5, 0), (r, r * 0.45), (r, r * 0.95), (r * 0.4, r * 1.35))
    for i in range(int(ancho / 0.5)):
        px = x - ancho / 2 + (i + 0.5) * 0.5
        m.torno((px, y, z), perfil, variar(CALABAZA, 0.1), lados=10)
        m.caja((px, y, z + r * 1.45), (0.035, 0.035, 0.07), HOJA)


def fila_huevos(m, x, y, z, ancho):
    """Cestas de mimbre con huevos."""
    for i in range(3):
        px = x + (i - 1) * ancho / 3
        m.torno((px, y, z), ((0.14, 0), (0.21, 0.13), (0.21, 0.15)), variar(MIMBRE), lados=10)
        for dx, dy in ((-0.09, 0), (0.09, 0), (0, 0.09), (0, -0.09), (0, 0)):
            m.torno((px + dx, y + dy, z + 0.1), ((0.02, 0), (0.05, 0.04), (0.04, 0.09), (0.01, 0.12)), HUEVO, lados=7)


def fila_lana(m, x, y, z, ancho):
    """Madejas de lana, alguna teñida."""
    bolas(m, x, y, z, ancho - 0.1, 0.13, LANA, n=max(2, int(ancho / 0.36)))
    m.torno((x - 0.5, y, z + 0.2), ((0.05, 0), (0.12, 0.08), (0.12, 0.16), (0.05, 0.24)), LANA_TENIDA, lados=8)


def fila_leche(m, x, y, z, ancho):
    """Lecheras de metal."""
    perfil = ((0.11, 0), (0.12, 0.2), (0.07, 0.3), (0.06, 0.36), (0.08, 0.38), (0.08, 0.41))
    for i in range(int(ancho / 0.4)):
        px = x - ancho / 2 + (i + 0.5) * 0.4
        m.torno((px, y, z), perfil, variar(METAL_CLARO, 0.05), lados=10)


def estanteria(m, bx, z0, fila):
    """Estantería contra el muro del fondo, con todas las baldas de un mismo recurso."""
    y = ESTANTE_Y
    an, fo, al = ESTANTE_ANCHO, ESTANTE_FONDO, ESTANTE_ALTO
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caja((bx + sx * (an / 2 - 0.05), y + sy * (fo / 2 - 0.04), z0 + al / 2), (0.09, 0.08, al), variar(VIGA))
    m.caja((bx, y + fo / 2 - 0.02, z0 + al / 2), (an - 0.1, 0.03, al - 0.1), variar(MADERA, 0.05))
    for z in (*BALDAS, ESTANTE_ALTO - 0.05):
        m.caja((bx, y, z0 + z), (an, fo, 0.05), variar(MADERA_CLARA))
    for z in BALDAS:
        fila(m, bx, y, z0 + z + 0.025, an - 0.3)
    # Tablero del rótulo: el juego le pone encima el nombre del recurso
    m.caja((bx, y - fo / 2 - 0.02, z0 + 1.98), (1.5, 0.03, 0.36), variar(VIGA, 0.04))


def planta_baja(m):
    muros(m)
    puerta(m)
    pilares(m)
    escalera(m)
    zona_pienso(m)
    cajas(m)
    for bx, fila in zip(ESTANTE_BX, (fila_zanahorias, fila_tomates, fila_calabazas)):
        estanteria(m, bx, 0, fila)


def altillo(m):
    """Losa sobre la mitad del fondo, con su barandilla y las estanterías de arriba."""
    y0, y1 = 0.0, Y
    yc, fo = (y0 + y1) / 2, y1 - y0
    z = LOSA_Z
    m.caja((0, yc, z - 0.01), (ANCHO, fo, 0.02), BLANCO, mat=TARIMA, escala_uv=2.2)
    m.caja((0, yc, z - LOSA_GROSOR / 2 - 0.01), (ANCHO, fo, LOSA_GROSOR - 0.02), variar(MADERA))
    # Viguetas por debajo, y la viga maestra del borde
    m.caja((0, y0 + 0.1, z - LOSA_GROSOR - 0.09), (ANCHO, 0.24, 0.18), variar(VIGA))
    for x in (-6.0, -3.0, 0.0, 3.0, 6.0):
        m.caja((x, yc, z - LOSA_GROSOR - 0.06), (0.14, fo, 0.12), variar(VIGA))

    # Barandilla del borde, abierta solo donde asoma la escalera
    def tramo(x0, x1):
        xc = (x0 + x1) / 2
        m.caja((xc, 0.05, z + 1.0), (x1 - x0, 0.08, 0.08), variar(VIGA))
        m.caja((xc, 0.05, z + 0.52), (x1 - x0, 0.05, 0.06), variar(MADERA))
        n = max(1, round((x1 - x0) / 1.6))
        for i in range(n + 1):
            m.caja((x0 + (x1 - x0) * i / n, 0.05, z + 0.5), (0.1, 0.1, 1.0), variar(VIGA))

    a, b = ESCALERA_X - 0.45, ESCALERA_X + 0.45
    tramo(-X, a)
    tramo(b, X)
    m.caja((ESCALERA_X, 0.05, z + 0.85), (b - a, 0.03, 0.03), CUERDA)  # cadena de la escalera

    fardo(m, -7.0, 0.72, z, 1.5, 0.6, 0.5)
    fardo(m, -7.0, 1.32, z, 1.5, 0.6, 0.5)
    fardo(m, -7.0, 1.0, z + 0.5, 1.5, 0.6, 0.5)

    for bx, fila in zip(ESTANTE_BX, (fila_huevos, fila_lana, fila_leche)):
        estanteria(m, bx, z, fila)


def material(nombre, rugosidad):
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    attr = ns.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rugosidad
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
    mats = (
        material("M_Almacen", 0.8),
        material("M_Cristal", 0.15),
        material_textura("M_Suelo", "suelo.png"),
        material_textura("M_Tablas", "tablas.png"),
        material_textura("M_Tarima", "tarima.png"),
        material_textura("M_Arpillera", "arpillera.png"),
    )
    objetos = []
    for nombre, pieza in (("SM_AlmacenBase", planta_baja), ("SM_AlmacenAltillo", altillo)):
        m = Malla()
        pieza(m)
        bmesh.ops.recalc_face_normals(m.bm, faces=m.bm.faces)
        malla = bpy.data.meshes.new(nombre)
        m.bm.to_mesh(malla)
        m.bm.free()
        for mat in mats:
            malla.materials.append(mat)
        obj = bpy.data.objects.new(nombre, malla)
        bpy.context.scene.collection.objects.link(obj)
        objetos.append(obj)
    return objetos


def exportar(objetos):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objetos:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objetos[0]
    destino = ASSETS / "almacen_interior.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(destino),
        export_format="GLB",
        use_selection=True,
        export_image_format="JPEG",
    )
    PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC)

    metricas = {
        "triangulos": sum(len(p.vertices) - 2 for o in objetos for p in o.data.polygons),
        "vertices": sum(len(o.data.vertices) for o in objetos),
        "dimensiones_m": [round(d, 3) for d in objetos[0].dimensions],
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

    # Misma orientación que la cámara del juego: 45° desde el frente
    cam = bpy.data.cameras.new("Camara")
    cam.lens = 35
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (0, -15, 15)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0.3, 1.0))
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
    objetos = construir()
    exportar(objetos)
    preview()
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "almacen_interior.blend"))
