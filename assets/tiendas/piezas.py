"""Piezas comunes de las tiendas del mercado para los scripts de Blender.

Lo importan assets/tiendas/generar.py (exteriores) y
assets/tienda_interior/generar.py (interiores): la malla con color por cara, los
materiales y el género de cada tienda (semillas, animales y flores), para que
dentro y fuera se vea lo mismo.
"""

import math
import random

import bpy
import bmesh
from mathutils import Matrix, Vector

RNG = random.Random(0)


def semilla(n):
    """Reinicia el azar: cada modelo sale igual en cada ejecución."""
    global RNG
    RNG = random.Random(n)


# Índices de material
OPACO, CRISTAL, LUZ, TEXTURA = range(4)

# Paleta común en sRGB; se guarda en lineal en el atributo de color.
MADERA = (0.62, 0.43, 0.26)
OSCURA = (0.40, 0.26, 0.15)
CLARA = (0.78, 0.62, 0.42)
VIGA = (0.36, 0.23, 0.14)
PIEDRA = (0.58, 0.56, 0.52)
TEJA = (0.68, 0.29, 0.20)
CUMBRERA = (0.46, 0.19, 0.14)
BLANCO = (0.95, 0.93, 0.88)
METAL = (0.62, 0.64, 0.66)
HIERRO = (0.20, 0.20, 0.22)
VIDRIO = (0.45, 0.62, 0.72)
LLAMA = (1.0, 0.80, 0.45)
PAJA = (0.88, 0.74, 0.36)
CUERDA = (0.55, 0.40, 0.22)
SACO = (0.82, 0.72, 0.52)
GRANO = (0.80, 0.62, 0.28)
TALLO = (0.30, 0.55, 0.25)
BARRO = (0.74, 0.38, 0.24)
TIERRA = (0.30, 0.20, 0.12)
ZANAHORIA = (0.93, 0.48, 0.16)
TOMATE = (0.86, 0.20, 0.16)
CALABAZA = (0.90, 0.55, 0.15)
FLORES = ((0.92, 0.30, 0.42), (0.98, 0.84, 0.30), (0.70, 0.48, 0.90), (0.98, 0.62, 0.72), (0.98, 0.98, 0.95))
SOBRES = ((0.90, 0.48, 0.20), (0.85, 0.25, 0.22), (0.92, 0.66, 0.18), (0.45, 0.65, 0.30))

# Colores propios de cada tienda: toldo, pintura de puerta y marcos, y revoco
ESTILO = {
    "semillas": {"toldo": ((0.80, 0.24, 0.20), BLANCO), "pintura": (0.24, 0.45, 0.42), "revoco": (0.93, 0.87, 0.74)},
    "animales": {"toldo": ((0.36, 0.58, 0.30), BLANCO), "pintura": (0.55, 0.22, 0.16), "revoco": (0.90, 0.80, 0.62)},
    "flores": {"toldo": ((0.92, 0.50, 0.64), BLANCO), "pintura": (0.48, 0.36, 0.62), "revoco": (0.95, 0.86, 0.84)},
}


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

    def _pintar(self, caras, color, mat=OPACO, escala_uv=1.0):
        c = (*lineal(color), 1.0)
        for f in caras:
            f.material_index = mat
            f.normal_update()
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
        self._pintar([self.bm.faces.new([vs[i] for i in q]) for q in idx], color, mat, escala_uv)

    def torno(self, centro, perfil, color, lados=12, mat=OPACO, tapa=None):
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
        lado = []
        for a, b in zip(anillos, anillos[1:]):
            lado += [self.bm.faces.new((a[i], a[(i + 1) % lados], b[(i + 1) % lados], b[i])) for i in range(lados)]
        tapas = [self.bm.faces.new(list(reversed(anillos[0]))), self.bm.faces.new(anillos[-1])]
        self._pintar(lado, color, mat)
        self._pintar(tapas, tapa or color, mat)

    def prisma(self, puntos, desplazamiento, color, mat=OPACO, escala_uv=1.0):
        d = Vector(desplazamiento)
        a = [self.bm.verts.new(Vector(p)) for p in puntos]
        b = [self.bm.verts.new(Vector(p) + d) for p in puntos]
        n = len(puntos)
        caras = [self.bm.faces.new(a), self.bm.faces.new(list(reversed(b)))]
        caras += [self.bm.faces.new((a[i], b[i], b[(i + 1) % n], a[(i + 1) % n])) for i in range(n)]
        self._pintar(caras, color, mat, escala_uv)

    def flor(self, centro, color, tam=0.08):
        """Cabeza de flor: cubo girado 45° con botón central."""
        rot = Matrix.Rotation(math.pi / 4, 3, "Z") @ Matrix.Rotation(math.pi / 4, 3, "X")
        self.caja(centro, (tam, tam, tam), color, rot)
        self.caja(Vector(centro) + Vector((0, 0, tam * 0.45)), (tam * 0.4,) * 3, (0.98, 0.85, 0.3))

    def objeto(self, nombre, materiales):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        malla = bpy.data.meshes.new(nombre)
        self.bm.to_mesh(malla)
        self.bm.free()
        for mat in materiales:
            malla.materials.append(mat)
        obj = bpy.data.objects.new(nombre, malla)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def material(nombre, rugosidad=0.85, emision=None, fuerza=2.0):
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


def material_textura(nombre, ruta, lado=512):
    """Material con una textura de ComfyUI ya generada, reducida para aligerar el GLB."""
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    tex = ns.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(ruta))
    img.scale(lado, lado)
    img.pack()
    tex.image = img
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def materiales_basicos():
    """Opaco, cristal y luz: los índices OPACO, CRISTAL y LUZ."""
    return [material("M_Tienda"), material("M_Cristal", 0.15), material("M_Farol", 0.4, LLAMA)]


# ---------- Género ----------


def bala(m, centro, rot_z=0.0):
    rot = Matrix.Rotation(rot_z, 3, "Z")
    c = Vector(centro)
    m.caja(c, (0.75, 0.45, 0.4), variar(PAJA, 0.06), rot)
    for dx in (-0.2, 0.2):  # cordeles
        m.caja(c + rot @ Vector((dx, 0, 0)), (0.03, 0.47, 0.42), CUERDA, rot)
    for _ in range(6):  # pajas sueltas
        p = c + rot @ Vector((RNG.uniform(-0.33, 0.33), -0.23, RNG.uniform(-0.15, 0.15)))
        m.caja(p, (0.12, 0.01, 0.012), variar(PAJA, 0.2), rot @ Matrix.Rotation(RNG.uniform(-0.6, 0.6), 3, "Y"))


def saco(m, base, escala=1.0, rot_z=0.0, boca=GRANO):
    rot = Matrix.Rotation(rot_z, 3, "Z")
    b = Vector(base)
    w, d, h = 0.36 * escala, 0.26 * escala, 0.42 * escala
    m.caja(b + Vector((0, 0, h / 2)), (w, d, h), variar(SACO, 0.05), rot)
    m.caja(b + Vector((0, 0, h * 0.25)), (w + 0.02, d + 0.02, h * 0.45), variar(SACO, 0.05), rot)
    m.caja(b + Vector((0, 0, h + 0.02)), (w * 0.85, d * 0.85, 0.05), boca, rot)
    m.caja(b + rot @ Vector((0, -d / 2 - 0.005, h * 0.55)), (w * 0.5, 0.01, h * 0.25), OSCURA, rot)


def lechera(m, base):
    b = Vector(base)
    m.torno(b, ((0.2, 0), (0.2, 0.4), (0.14, 0.55), (0.09, 0.6), (0.09, 0.68), (0.12, 0.7)), METAL)


def cubo(m, base, r=0.13, alto=0.25, borde=METAL):
    m.torno(base, ((r * 0.8, 0), (r, alto)), borde, tapa=(0.25, 0.4, 0.5))


def ramo(m, base, n, altura=0.32, radio=0.14):
    """Manojo de tallos con flores en una cúpula."""
    b = Vector(base)
    for _ in range(n):
        a = RNG.uniform(0, 2 * math.pi)
        r = RNG.uniform(0.02, radio)
        top = b + Vector((r * math.cos(a), r * math.sin(a), altura * RNG.uniform(0.85, 1.1)))
        m.caja((b + top) / 2, (0.015, 0.015, (top - b).length), TALLO)
        m.flor(top, FLORES[RNG.randrange(len(FLORES))], RNG.uniform(0.08, 0.1))


def maceta(m, base, alto=0.24, r=0.13):
    m.torno(base, ((r * 0.78, 0), (r, alto)), variar(BARRO), tapa=TIERRA)
    b = Vector(base)
    for i in range(5):
        a = 2 * math.pi * i / 5 + RNG.uniform(-0.3, 0.3)
        p = b + Vector((r * 0.5 * math.cos(a), r * 0.5 * math.sin(a), alto + 0.1))
        m.caja(p, (0.09, 0.05, 0.12), variar(TALLO, 0.15), Matrix.Rotation(a, 3, "Z"))
    m.flor(b + Vector((0, 0, alto + 0.2)), FLORES[RNG.randrange(len(FLORES))], 0.09)


def pastel(m, base):
    b = Vector(base)
    m.torno(b, ((0.05, 0), (0.05, 0.1), (0.22, 0.1), (0.22, 0.13)), BLANCO, lados=14)
    m.torno(b + Vector((0, 0, 0.13)), ((0.17, 0), (0.17, 0.16), (0.15, 0.19)), (0.96, 0.86, 0.66), lados=14, tapa=(0.98, 0.7, 0.8))
    for i in range(6):
        a = 2 * math.pi * i / 6
        m.caja(b + Vector((0.11 * math.cos(a), 0.11 * math.sin(a), 0.34)), (0.04,) * 3, (0.85, 0.12, 0.18))


def cajon(m, centro, contenido, ancho=0.5, fondo=0.36):
    """Cajón de madera lleno de verdura: zanahorias, tomates o calabazas."""
    c = Vector(centro)
    m.caja(c + Vector((0, 0, 0.1)), (ancho, fondo, 0.2), variar(MADERA))
    m.caja(c + Vector((0, 0, 0.2)), (ancho - 0.06, fondo - 0.06, 0.02), TIERRA)
    if contenido == "calabaza":
        for dx in (-ancho / 4, ancho / 4):
            m.torno(c + Vector((dx, 0, 0.18)), ((0.06, 0), (0.12, 0.06), (0.12, 0.12), (0.05, 0.17)), variar(CALABAZA))
            m.caja(c + Vector((dx, 0, 0.37)), (0.025, 0.025, 0.06), TALLO)
        return
    for i in range(int(ancho / 0.09)):
        for j in range(int(fondo / 0.09)):
            p = c + Vector((-ancho / 2 + 0.06 + i * 0.09, -fondo / 2 + 0.06 + j * 0.09, 0.24))
            if contenido == "zanahoria":
                rot = Matrix.Rotation(RNG.uniform(-0.5, 0.5), 3, "Z") @ Matrix.Rotation(math.pi / 2.4, 3, "X")
                m.caja(p, (0.04, 0.16, 0.04), variar(ZANAHORIA, 0.08), rot)
            else:
                m.caja(p, (0.075, 0.075, 0.07), variar(TOMATE, 0.08), Matrix.Rotation(RNG.uniform(0, 1), 3, "Z"))


def sobres(m, centro, filas=2, columnas=5, giro=0.0):
    """Expositor inclinado de sobres de semillas."""
    rot = Matrix.Rotation(giro, 3, "Z")
    inclin = rot @ Matrix.Rotation(math.radians(-20), 3, "X")
    c = Vector(centro)
    ancho = columnas * 0.13
    m.caja(c + rot @ Vector((0, 0.02, filas * 0.09)), (ancho + 0.06, 0.04, filas * 0.18 + 0.06), variar(MADERA), inclin)
    for f in range(filas):
        for k in range(columnas):
            p = c + rot @ Vector((-ancho / 2 + 0.065 + k * 0.13, -0.02 - f * 0.05, 0.08 + f * 0.17))
            m.caja(p, (0.1, 0.012, 0.14), SOBRES[(f + k) % len(SOBRES)], inclin)


def genero(m, tipo, centro, ancho):
    """Lo que se expone de cada tienda sobre una superficie de `ancho` m."""
    c = Vector(centro)
    if tipo == "semillas":
        sobres(m, c + Vector((-ancho / 4, 0.05, 0)), 2, max(2, int(ancho / 0.3)))
        cajon(m, c + Vector((ancho / 4, 0, 0)), ("zanahoria", "tomate", "calabaza")[RNG.randrange(3)], ancho / 2 - 0.06)
    elif tipo == "animales":
        n = max(1, int(ancho / 0.4))
        for i in range(n):
            saco(m, c + Vector((-ancho / 2 + (i + 0.5) * ancho / n, 0, 0)), 0.75, RNG.uniform(-0.3, 0.3))
    else:
        n = max(1, int(ancho / 0.36))
        for i in range(n):
            p = c + Vector((-ancho / 2 + (i + 0.5) * ancho / n, 0, 0))
            if i % 2:
                maceta(m, p, 0.18, 0.1)
            else:
                cubo(m, p, 0.11, 0.2)
                ramo(m, p + Vector((0, 0, 0.16)), 8, 0.24, 0.1)
