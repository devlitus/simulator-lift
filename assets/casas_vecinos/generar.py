"""Cinco casas de vecinos para el barrio: ejecutar con Blender 5.

blender --background --factory-startup --python assets/casas_vecinos/generar.py

Casas distintas en silueta, muros y tejado para que el barrio no parezca
clonado: cabaña de troncos con porche, casa encalada con contraventanas,
casa alta de entramado con el hastial a la calle, casita de piedra con
tejado de paja y casa de tablas azules con porche y tejado a cuatro aguas.
Modelado procedural (sin IA) con colores planos en el atributo `Col` y las
piezas comunes de las tiendas (assets/tiendas/piezas.py). Los muros son
macizos: puertas y ventanas van superpuestas, como apliques.

Guarda assets/casas_vecinos.blend, exporta casa_vecino_<tipo>.glb (fuente en
assets/ y copia en public/models/), metricas.json y preview.png. Las huellas
de colisión de src/world/neighborhoodLayout.ts salen de estas medidas: **si
cambias ANCHO/FONDO o el porche, actualiza también ese archivo**. Blender
termina con código 0 aunque el script falle: revisa la salida en busca de
`Traceback`.
"""

import json
import math
import shutil
import site
import sys
from pathlib import Path

sys.path.append(site.getusersitepackages())
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tiendas"))

import bmesh
import bpy
from mathutils import Matrix, Vector

import piezas as p
from piezas import CRISTAL, LUZ, Malla

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "casas_vecinos"
PUBLIC = ASSETS.parent / "public" / "models"

# Ejes Blender: fachada en -Y (+Z en Babylon), pivote en el centro de la
# planta del cuerpo de la casa, base en z=0. Medidas en metros.
TIPOS = ("cabana", "encalada", "entramado", "piedra", "porche")


class Fachada:
    """Marco local de un muro: u a lo largo, o hacia fuera, z arriba."""

    def __init__(self, m, origen, u, fuera):
        self.m = m
        self.o = Vector(origen)
        self.rot = Matrix((u, fuera, (0, 0, 1))).transposed()

    def caja(self, cu, co, cz, su, so, sz, color, mat=p.OPACO, rot=None):
        r = self.rot @ rot if rot else self.rot
        self.m.caja(self.o + self.rot @ Vector((cu, co, cz)), (su, so, sz), color, r, mat)


def fachadas(m, ancho, fondo):
    """Los cuatro muros: frente, derecha, fondo e izquierda (vistos desde fuera)."""
    return {
        "frente": (Fachada(m, (0, -fondo / 2, 0), (1, 0, 0), (0, -1, 0)), ancho),
        "der": (Fachada(m, (ancho / 2, 0, 0), (0, 1, 0), (1, 0, 0)), fondo),
        "fondo": (Fachada(m, (0, fondo / 2, 0), (-1, 0, 0), (0, 1, 0)), ancho),
        "izq": (Fachada(m, (-ancho / 2, 0, 0), (0, -1, 0), (-1, 0, 0)), fondo),
    }


def solido(m, puntos, caras, color, mat=p.OPACO):
    vs = [m.bm.verts.new(Vector(q)) for q in puntos]
    m._pintar([m.bm.faces.new([vs[i] for i in c]) for c in caras], color, mat)


# ---------- Muros ----------


def zocalo(m, ancho, fondo, alto=0.25):
    m.caja((0, 0, alto / 2), (ancho + 0.12, fondo + 0.12, alto), p.variar(p.PIEDRA, 0.05))


def piedras(f, largo, z0, z1, base=p.PIEDRA):
    """Sillares irregulares por hiladas sobre el muro."""
    z, fila = z0, 0
    while z < z1 - 0.05:
        h = min(p.RNG.uniform(0.22, 0.32), z1 - z)
        pos = -largo / 2 - (0.18 if fila % 2 else 0)
        while pos < largo / 2:
            tramo = p.RNG.uniform(0.3, 0.55)
            a, b = max(pos, -largo / 2), min(pos + tramo, largo / 2)
            if b - a > 0.08:
                f.caja((a + b) / 2, p.RNG.uniform(0.01, 0.035), z + h / 2, b - a - 0.035, 0.05, h - 0.035, p.variar(base, 0.12))
            pos += tramo
        z += h
        fila += 1


def tablas(f, largo, z0, z1, color, ancho=0.24):
    n = max(2, round(largo / ancho))
    w = largo / n
    for i in range(n):
        f.caja(-largo / 2 + (i + 0.5) * w, 0.015, (z0 + z1) / 2, w - 0.025, 0.03, z1 - z0, p.variar(color, 0.06))


def troncos(f, largo, z0, z1, color, desfase):
    """Troncos tumbados que asoman en las esquinas (alternos con el muro contiguo)."""
    h = 0.22
    z = z0 + (h / 2 if desfase else 0)
    while z + h / 2 <= z1 + 0.01:
        f.caja(0, 0.06, z + h / 2, largo + 0.36, 0.14, h - 0.02, p.variar(color, 0.08))
        z += h


def vigas(f, largo, z0, z1, color=p.VIGA):
    viga = lambda cu, cz, su, sz: f.caja(cu, 0.02, cz, su, 0.05, sz, p.variar(color, 0.06))
    viga(0, z0 + 0.06, largo, 0.12)
    viga(0, z1 - 0.07, largo + 0.06, 0.14)
    for x in (-largo / 2 + 0.06, largo / 2 - 0.06):
        viga(x, (z0 + z1) / 2, 0.12, z1 - z0)


def esquinas(m, ancho, fondo, z0, z1, color):
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caja((sx * ancho / 2, sy * fondo / 2, (z0 + z1) / 2), (0.14, 0.14, z1 - z0), color)


# ---------- Huecos (apliques sobre el muro) ----------


def ventana(f, cu, cz, w, h, marco, contra=None, jardinera=False, cruz=True):
    f.caja(cu, 0.02, cz, w, 0.04, h, p.VIDRIO, CRISTAL)
    for du in (-1, 1):
        f.caja(cu + du * (w / 2 + 0.03), 0.05, cz, 0.07, 0.07, h + 0.12, marco)
    for dz in (-1, 1):
        f.caja(cu, 0.05, cz + dz * (h / 2 + 0.03), w + 0.12, 0.07, 0.07, marco)
    if cruz:
        f.caja(cu, 0.06, cz, 0.04, 0.03, h, marco)
        f.caja(cu, 0.06, cz, w, 0.03, 0.04, marco)
    f.caja(cu, 0.1, cz - h / 2 - 0.07, w + 0.24, 0.16, 0.05, marco)  # alféizar
    if contra:
        for du in (-1, 1):
            hoja = w / 2 + 0.02
            x = cu + du * (w / 2 + 0.09 + hoja / 2)
            f.caja(x, 0.04, cz, hoja, 0.04, h + 0.06, contra)
            for dz in (-0.25, 0.25):
                f.caja(x, 0.065, cz + dz * h, hoja - 0.06, 0.012, 0.03, p.variar(contra, 0.15))
    if jardinera:
        z = cz - h / 2 - 0.2
        f.caja(cu, 0.17, z, w + 0.1, 0.2, 0.18, p.MADERA)
        f.caja(cu, 0.17, z + 0.1, w, 0.16, 0.02, p.TIERRA)
        for i in range(6):
            x = cu - w / 2 + 0.07 + i * (w - 0.14) / 5
            f.caja(x, 0.17 + p.RNG.uniform(-0.04, 0.04), z + 0.16, 0.09, 0.09, 0.1, p.TALLO)
            f.m.flor(f.o + f.rot @ Vector((x, 0.17, z + 0.24)), p.FLORES[p.RNG.randrange(len(p.FLORES))], 0.09)


def puerta(f, cu, w, h, color, marco, z0=0.25, farol=True):
    n = 3
    for i in range(n):
        f.caja(cu - w / 2 + (i + 0.5) * w / n, 0.025, z0 + h / 2, w / n - 0.015, 0.05, h, p.variar(color, 0.05))
    f.caja(cu, 0.055, z0 + h * 0.72, w * 0.55, 0.02, h * 0.22, p.VIDRIO, CRISTAL)
    f.caja(cu + w * 0.32, 0.07, z0 + h * 0.45, 0.05, 0.05, 0.14, p.HIERRO)  # tirador
    for du in (-1, 1):
        f.caja(cu + du * (w / 2 + 0.05), 0.05, z0 + h / 2, 0.1, 0.08, h + 0.05, marco)
    f.caja(cu, 0.05, z0 + h + 0.06, w + 0.3, 0.08, 0.12, marco)
    f.caja(cu, 0.22, 0.07, w + 0.5, 0.45, 0.14, p.variar(p.PIEDRA))  # escalón
    if farol:
        x = cu + w / 2 + 0.35
        f.caja(x, 0.08, z0 + h + 0.05, 0.04, 0.16, 0.04, p.HIERRO)
        f.caja(x, 0.17, z0 + h - 0.05, 0.15, 0.15, 0.04, p.HIERRO)
        f.caja(x, 0.17, z0 + h - 0.16, 0.1, 0.1, 0.18, p.LLAMA, LUZ)
        f.caja(x, 0.17, z0 + h - 0.27, 0.15, 0.15, 0.04, p.HIERRO)


def chimenea(m, x, y, z0, z1, color=p.PIEDRA):
    m.caja((x, y, (z0 + z1) / 2), (0.5, 0.5, z1 - z0), p.variar(color, 0.06))
    for dz in (0.35, 0.8):
        if z0 + dz < z1 - 0.2:
            m.caja((x, y, z0 + dz), (0.54, 0.54, 0.05), p.variar(color, 0.15))
    m.caja((x, y, z1 + 0.04), (0.62, 0.62, 0.08), p.variar(color, 0.1))
    m.caja((x, y, z1 + 0.09), (0.3, 0.3, 0.04), (0.15, 0.13, 0.12))


# ---------- Tejados ----------


def filas(m, alero, u, v, n, faldon, largo, color, paso=0.26, hoja=0.34, grosor=0.1, var=0.1):
    """Hileras de teja/pizarra/paja sobre un faldón; largo(t) da su ancho a la altura t."""
    d = 0.12  # cada hilera levanta el borde de abajo
    rot = Matrix((u, v * math.cos(d) - n * math.sin(d), n * math.cos(d) + v * math.sin(d))).transposed()
    s = 0.0
    while s < faldon - 0.05:
        t = min(s + hoja / 2, faldon - hoja / 2)
        ancho = largo(t / faldon)
        if ancho > 0.1:
            c = alero + v * t + n * (grosor + 0.035)
            m.caja(c, (ancho, hoja, 0.05), p.variar(color, var), rot)
        s += paso


def dos_aguas(m, ancho, fondo, alto, subida, vuelo, color, cumbrera, eje="x", muro=None, var=0.1):
    """Tejado a dos aguas. eje 'x': caballete paralelo a la fachada; 'y': hastial a la calle."""
    luz, largo = (fondo, ancho) if eje == "x" else (ancho, fondo)
    pend = math.atan2(subida, luz / 2)
    run = luz / 2 + vuelo
    faldon = run / math.cos(pend)
    z_alero = alto - vuelo * math.tan(pend)
    largo += 2 * vuelo
    grosor = 0.1
    for s in (-1, 1):
        if eje == "x":
            u, v, n = Vector((1, 0, 0)), Vector((0, -s * math.cos(pend), math.sin(pend))), Vector((0, s * math.sin(pend), math.cos(pend)))
            alero = Vector((0, s * run, z_alero))
        else:
            u, v, n = Vector((0, 1, 0)), Vector((-s * math.cos(pend), 0, math.sin(pend))), Vector((s * math.sin(pend), 0, math.cos(pend)))
            alero = Vector((s * run, 0, z_alero))
        base = Matrix((u, v, n)).transposed()
        m.caja(alero + v * faldon / 2 + n * grosor / 2, (largo, faldon, grosor), p.VIGA, base)
        filas(m, alero, u, v, n, faldon, lambda t: largo, color, var=var)
    # Caballete
    cumbre = Vector((0, 0, alto + subida + grosor + 0.06))
    caja = (largo, 0.24, 0.24) if eje == "x" else (0.24, largo, 0.24)
    m.caja(cumbre, caja, cumbrera, Matrix.Rotation(math.pi / 4, 3, "X" if eje == "x" else "Y"))
    # Hastiales macizos en los extremos del caballete
    if muro:
        for lado in (-1, 1):
            if eje == "x":
                x = lado * ancho / 2
                tri = [(x, -fondo / 2, alto), (x, fondo / 2, alto), (x, 0, alto + subida)]
                m.prisma(tri, (-lado * 0.2, 0, 0), muro)
            else:
                y = lado * fondo / 2
                tri = [(-ancho / 2, y, alto), (ancho / 2, y, alto), (0, y, alto + subida)]
                m.prisma(tri, (0, -lado * 0.2, 0), muro)
    return pend


def cuatro_aguas(m, ancho, fondo, alto, subida, vuelo, color, cumbrera, grosor=0.12, hoja=0.34, paso=0.26, var=0.1):
    """Tejado a cuatro aguas (ancho > fondo): macizo con alero y hileras en cada faldón."""
    pend = math.atan2(subida, fondo / 2)
    X, Y = ancho / 2 + vuelo, fondo / 2 + vuelo
    z_e = alto - vuelo * math.tan(pend)
    rx = (ancho - fondo) / 2
    zr = alto + subida
    puntos = [
        (-X, -Y, z_e - grosor), (X, -Y, z_e - grosor), (X, Y, z_e - grosor), (-X, Y, z_e - grosor),
        (-X, -Y, z_e), (X, -Y, z_e), (X, Y, z_e), (-X, Y, z_e),
        (-rx, 0, zr), (rx, 0, zr),
    ]
    caras = [
        (3, 2, 1, 0),
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        (4, 5, 9, 8), (5, 6, 9), (6, 7, 8, 9), (7, 4, 8),
    ]
    solido(m, puntos, caras, p.variar(color, 0.04))
    # Hileras: faldones largos (trapecios) y cortos (triángulos)
    for s in (-1, 1):
        u = Vector((1, 0, 0))
        v = Vector((0, -s * math.cos(pend), math.sin(pend)))
        n = Vector((0, s * math.sin(pend), math.cos(pend)))
        faldon = Y / math.cos(pend)
        filas(m, Vector((0, s * Y, z_e)), u, v, n, faldon, lambda t: 2 * (X - t * (X - rx)) - 0.1, color, paso, hoja, 0.0, var)
        u2 = Vector((0, 1, 0))
        v2 = Vector((-s * math.cos(pend), 0, math.sin(pend)))
        n2 = Vector((s * math.sin(pend), 0, math.cos(pend)))
        faldon2 = (X - rx) / math.cos(pend)
        filas(m, Vector((s * X, 0, z_e)), u2, v2, n2, faldon2, lambda t: 2 * Y * (1 - t) - 0.1, color, paso, hoja, 0.0, var)
    m.caja((0, 0, zr + 0.05), (2 * rx + 0.2, 0.22, 0.22), cumbrera, Matrix.Rotation(math.pi / 4, 3, "X"))
    return pend


# ---------- Las cinco casas ----------


def cabana(m):
    """Cabaña de troncos con porche cubierto y banco."""
    A, F, H = 4.4, 3.6, 2.5
    madera = (0.55, 0.36, 0.22)
    zocalo(m, A, F)
    m.caja((0, 0, H / 2 + 0.1), (A - 0.1, F - 0.1, H - 0.2), (0.3, 0.2, 0.12))
    for i, (nombre, (f, largo)) in enumerate(fachadas(m, A, F).items()):
        troncos(f, largo, 0.25, H, madera, desfase=i % 2)
    fr = fachadas(m, A, F)["frente"][0]
    puerta(fr, -0.6, 0.9, 1.95, (0.32, 0.45, 0.30), p.OSCURA, farol=False)
    ventana(fr, 1.0, 1.45, 0.9, 0.75, p.OSCURA, contra=(0.32, 0.45, 0.30))
    for lado in ("der", "izq", "fondo"):
        ventana(fachadas(m, A, F)[lado][0], 0, 1.45, 0.7, 0.65, p.OSCURA)
    dos_aguas(m, A, F, H, 1.35, 0.35, (0.36, 0.40, 0.28), (0.25, 0.28, 0.2), "x", muro=madera, var=0.14)
    # Porche: tarima, postes y tejadillo
    y0 = -F / 2
    m.caja((0, y0 - 0.6, 0.12), (A, 1.2, 0.1), p.variar(p.CLARA))
    for x in (-A / 2 + 0.15, A / 2 - 0.15):
        m.caja((x, y0 - 1.1, 1.15), (0.14, 0.14, 2.05), p.OSCURA)
    rot = Matrix.Rotation(-0.25, 3, "X")
    m.caja((0, y0 - 0.62, 2.12), (A + 0.3, 1.45, 0.08), (0.36, 0.40, 0.28), rot)
    m.caja((-1.4, y0 - 0.35, 0.45), (1.0, 0.32, 0.06), p.MADERA)  # banco
    for dx in (-0.42, 0.42):
        m.caja((-1.4 + dx, y0 - 0.35, 0.28), (0.06, 0.3, 0.3), p.OSCURA)
    chimenea(m, A / 2 - 0.5, 0.5, 2.6, 4.3)
    # Leña junto al costado
    rot = Matrix.Rotation(math.pi / 4, 3, "X")
    for i in range(3):
        for j in range(4 - i):
            m.caja((A / 2 + 0.35, -0.9 + j * 0.2 + i * 0.1, 0.09 + i * 0.16), (0.55, 0.14, 0.14), p.variar(p.CLARA, 0.15), rot)


def encalada(m):
    """Casa encalada de una planta, contraventanas azules y jardineras."""
    A, F, H = 4.6, 3.8, 2.7
    cal = (0.96, 0.94, 0.88)
    azul = (0.25, 0.42, 0.68)
    m.caja((0, 0, H / 2), (A, F, H), cal)
    m.caja((0, 0, 0.2), (A + 0.06, F + 0.06, 0.4), (0.55, 0.62, 0.72))  # zócalo pintado
    fr = fachadas(m, A, F)["frente"][0]
    puerta(fr, 0, 0.95, 2.0, azul, cal, z0=0.05)
    for x in (-1.45, 1.45):
        ventana(fr, x, 1.5, 0.75, 0.85, cal, contra=azul, jardinera=True)
    for lado in ("der", "izq"):
        f, largo = fachadas(m, A, F)[lado]
        ventana(f, 0, 1.5, 0.7, 0.8, cal, contra=azul)
    ventana(fachadas(m, A, F)["fondo"][0], 0.8, 1.5, 0.7, 0.8, cal, contra=azul)
    dos_aguas(m, A, F, H, 1.2, 0.3, p.TEJA, p.CUMBRERA, "x", muro=cal)
    chimenea(m, -A / 2 + 0.6, 0.6, 2.4, 4.3, cal)
    # Parra sobre la puerta
    for i in range(9):
        a = i / 8 * math.pi
        m.caja((0.75 * math.cos(a), -F / 2 - 0.08, 2.35 + 0.35 * math.sin(a)), (0.2, 0.12, 0.16), p.variar(p.TALLO, 0.2))


def entramado(m):
    """Casa alta de dos plantas con el hastial a la calle y tejado de pizarra."""
    A, F, H1, H = 3.8, 3.8, 2.4, 4.4
    revoco = (0.95, 0.88, 0.72)
    m.caja((0, 0, H / 2), (A, F, H), revoco)
    zocalo(m, A, F, 0.35)
    for f, largo in fachadas(m, A, F).values():
        vigas(f, largo, 0.35, H1)
        vigas(f, largo, H1, H)
        for s in (-1, 1):  # cruz de San Andrés en la planta alta
            largo_d = math.hypot(largo / 2 - 0.25, H - H1 - 0.3)
            ang = math.atan2(H - H1 - 0.3, largo / 2 - 0.25)
            f.caja(s * largo / 4, 0.02, (H1 + H) / 2, largo_d, 0.05, 0.1, p.variar(p.VIGA, 0.06), rot=Matrix.Rotation(-s * ang, 3, "Y"))
    fr = fachadas(m, A, F)["frente"][0]
    rojo = (0.62, 0.2, 0.16)
    puerta(fr, 0.8, 0.9, 1.9, rojo, p.VIGA, z0=0.35)
    ventana(fr, -0.85, 1.45, 0.8, 0.8, p.BLANCO, jardinera=True)
    ventana(fr, 0, H1 + 1.0, 1.1, 0.75, p.BLANCO, jardinera=True)
    for lado in ("der", "izq", "fondo"):
        f = fachadas(m, A, F)[lado][0]
        ventana(f, 0, 1.45, 0.7, 0.75, p.BLANCO)
        ventana(f, 0, H1 + 1.0, 0.7, 0.7, p.BLANCO)
    pizarra = (0.33, 0.36, 0.42)
    dos_aguas(m, A, F, H, 2.1, 0.35, pizarra, (0.22, 0.24, 0.28), "y", muro=revoco, var=0.08)
    # Ventanuco del hastial
    fr2 = Fachada(m, (0, -F / 2, 0), (1, 0, 0), (0, -1, 0))
    ventana(fr2, 0, H + 0.75, 0.5, 0.5, p.BLANCO)
    chimenea(m, 0.9, 1.0, 4.0, 6.6, (0.62, 0.36, 0.28))


def piedra(m):
    """Casita de piedra con tejado de paja a cuatro aguas y puerta verde."""
    A, F, H = 4.6, 3.8, 2.6
    m.caja((0, 0, H / 2), (A - 0.06, F - 0.06, H), (0.48, 0.46, 0.42))
    for f, largo in fachadas(m, A, F).values():
        piedras(f, largo, 0.0, H, (0.6, 0.57, 0.52))
    fr = fachadas(m, A, F)["frente"][0]
    verde = (0.30, 0.48, 0.32)
    puerta(fr, -0.5, 0.9, 1.85, verde, p.OSCURA, z0=0.05)
    m.caja((-0.5, -F / 2 - 0.05, 2.08), (1.3, 0.14, 0.18), p.OSCURA)  # dintel
    ventana(fr, 1.2, 1.35, 0.8, 0.7, p.OSCURA, contra=verde, jardinera=True)
    for lado in ("der", "izq", "fondo"):
        ventana(fachadas(m, A, F)[lado][0], 0, 1.35, 0.6, 0.6, p.OSCURA)
    paja = (0.86, 0.72, 0.42)
    cuatro_aguas(m, A, F, H, 1.55, 0.35, paja, (0.66, 0.52, 0.28), grosor=0.22, hoja=0.42, paso=0.3, var=0.07)
    chimenea(m, A / 2 - 0.9, 0.5, 2.5, 4.6)
    # Barril de agua de lluvia y una mata de flores junto a la puerta
    p.cubo(m, (-A / 2 - 0.35, -F / 2 + 0.6, 0), 0.25, 0.6, p.HIERRO)
    for i in range(7):
        a = i / 7 * 2 * math.pi
        m.flor((-1.45 + 0.22 * math.cos(a), -F / 2 - 0.35 + 0.18 * math.sin(a), 0.3), p.FLORES[i % len(p.FLORES)], 0.1)
    m.caja((-1.45, -F / 2 - 0.35, 0.12), (0.55, 0.45, 0.24), p.TALLO)


def porche(m):
    """Casa de tablas azules con porche a todo lo ancho y tejado a cuatro aguas."""
    A, F, H = 4.6, 3.6, 2.7
    azul = (0.45, 0.62, 0.80)
    m.caja((0, 0, H / 2), (A - 0.06, F - 0.06, H), azul)
    zocalo(m, A, F, 0.3)
    for f, largo in fachadas(m, A, F).values():
        tablas(f, largo, 0.3, H, azul)
    esquinas(m, A + 0.04, F + 0.04, 0.3, H, p.BLANCO)
    fr = fachadas(m, A, F)["frente"][0]
    amarillo = (0.95, 0.78, 0.30)
    puerta(fr, 0, 0.95, 2.0, amarillo, p.BLANCO, z0=0.3, farol=False)
    for x in (-1.5, 1.5):
        ventana(fr, x, 1.55, 0.8, 0.9, p.BLANCO)
    for lado in ("der", "izq", "fondo"):
        f = fachadas(m, A, F)[lado][0]
        ventana(f, 0, 1.55, 0.7, 0.8, p.BLANCO)
    cuatro_aguas(m, A, F, H, 1.25, 0.35, (0.62, 0.26, 0.22), p.CUMBRERA)
    # Porche: tarima elevada, barandilla, columnas y tejadillo
    y0 = -F / 2
    m.caja((0, y0 - 0.65, 0.15), (A + 0.1, 1.3, 0.3), p.variar(p.CLARA))
    m.caja((0, y0 - 1.42, 0.08), (1.2, 0.3, 0.16), p.variar(p.CLARA))  # escalón
    for x in (-A / 2 + 0.1, -0.7, 0.7, A / 2 - 0.1):
        m.caja((x, y0 - 1.2, 1.3), (0.14, 0.14, 2.0), p.BLANCO)
    for x0, x1 in ((-A / 2 + 0.1, -0.7), (0.7, A / 2 - 0.1)):
        m.caja(((x0 + x1) / 2, y0 - 1.2, 0.85), (x1 - x0, 0.08, 0.06), p.BLANCO)
        n = 7
        for i in range(1, n):
            m.caja((x0 + i * (x1 - x0) / n, y0 - 1.2, 0.58), (0.04, 0.04, 0.52), p.BLANCO)
    rot = Matrix.Rotation(-0.22, 3, "X")
    m.caja((0, y0 - 0.68, 2.36), (A + 0.4, 1.6, 0.08), (0.62, 0.26, 0.22), rot)
    m.caja((0, y0 - 1.45, 2.2), (A + 0.4, 0.06, 0.16), p.BLANCO)  # cenefa
    for x in (-1.7, 1.7):  # macetas
        p.maceta(m, (x, y0 - 0.95, 0.3), 0.26, 0.14)
    # Mecedora
    m.caja((1.3, y0 - 0.55, 0.62), (0.5, 0.45, 0.06), p.MADERA)
    m.caja((1.3, y0 - 0.33, 0.9), (0.5, 0.06, 0.55), p.MADERA)


CONSTRUCTORES = {"cabana": cabana, "encalada": encalada, "entramado": entramado, "piedra": piedra, "porche": porche}


def construir(tipo):
    p.semilla(5100 + TIPOS.index(tipo))
    m = Malla()
    CONSTRUCTORES[tipo](m)
    return m.objeto(f"SM_CasaVecino_{tipo}", p.materiales_basicos())


def exportar(tipo, obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    destino = ASSETS / f"casa_vecino_{tipo}.glb"
    bpy.ops.export_scene.gltf(filepath=str(destino), export_format="GLB", use_selection=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(destino, PUBLIC / destino.name)
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    return {
        "triangulos": sum(len(q.vertices) - 2 for q in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "dimensiones_m": [round(d, 3) for d in obj.dimensions],
        "x": [round(min(xs), 2), round(max(xs), 2)],
        "y": [round(min(ys), 2), round(max(ys), 2)],
    }


def estudio():
    escena = bpy.context.scene
    suelo = bpy.data.meshes.new("Suelo")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
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
    cam.lens = 35
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (-4.0, -30.0, 17.0)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    cam_obj.rotation_euler = (Vector((0, 0, 1.6)) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    mundo = bpy.data.worlds.new("Cielo")
    mundo.use_nodes = True
    mundo.node_tree.nodes.get("Background").inputs["Color"].default_value = (0.55, 0.75, 0.95, 1)
    mundo.node_tree.nodes.get("Background").inputs["Strength"].default_value = 0.8
    escena.world = mundo
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 1400
    escena.render.resolution_y = 640
    escena.render.filepath = str(OUT / "preview.png")


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objetos = {t: construir(t) for t in TIPOS}
    metricas = {t: exportar(t, o) for t, o in objetos.items()}
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    print("METRICAS", json.dumps(metricas))
    for i, obj in enumerate(objetos.values()):
        obj.location.x = (i - 2) * 6.5  # en el .blend y el preview, una junto a otra
    estudio()
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "casas_vecinos.blend"))
