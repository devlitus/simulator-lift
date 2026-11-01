"""Los diez transeúntes del pueblo, reproducibles: ejecutar con Blender 5.

blender --background --factory-startup --python assets/transeuntes/generar.py

Personajes chibi al estilo de Tomás (cabeza grande, cuerpo corto), modelados
por script a partir de las referencias de ComfyUI (referencias/*.png): cada
uno con su ropa, peinado, tocado y accesorio. Colores planos en el atributo
`Col` (COLOR_0) con un único material, para que los diez cuesten poco.

Rig sencillo de 7 huesos (root, hips, spine, head, leg.L/R, arm.L/R) con
pesos rígidos: cada pieza sigue a un solo hueso, así nada se deforma ni se
desgarra. Todos los huesos apuntan hacia arriba (roll 0). Animaciones `walk`
(1 s) e `idle` (2 s) como pistas NLA, como el granjero.

Las piezas se modelan con la cara hacia +Y y al montar se giran 180°: el GLB
mira hacia -Y de Blender, que el exportador glTF y el cargador de Babylon
dejan en +Z, el «delante» de rotation.y = atan2(dx, dz) en el juego
(comprobado en el navegador). Pies en z=0, escala métrica (el juego no
reescala). Guarda assets/transeuntes.blend, exporta
assets/models/transeunte_<id>.glb y sus copias en public/models/, y escribe
metricas.json y preview.png. Blender termina con código 0 aunque el script
falle: revisa la salida en busca de `Traceback`.
"""

import json
import math
import shutil
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "transeuntes"
FUENTES = ASSETS / "models"
PUBLIC = ASSETS.parent / "public" / "models"

FPS = 24
WALK = 24  # 1 s por ciclo de dos pasos
IDLE = 48
PIERNA = 0.38  # de la cadera al suelo, sin escalar
ZANCADA_GRADOS = 26


def lineal(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# ---------- Paleta común ----------
OJO = (0.10, 0.07, 0.06)
BRILLO = (1.0, 1.0, 1.0)
MEJILLA = (0.95, 0.58, 0.55)
BLANCO = (0.95, 0.94, 0.9)
NEGRO = (0.12, 0.11, 0.12)
CUERO = (0.45, 0.28, 0.16)
CUERO_OSCURO = (0.3, 0.18, 0.1)
MIMBRE = (0.78, 0.58, 0.32)
LATON = (0.88, 0.7, 0.3)
MADERA = (0.5, 0.33, 0.18)

# Pieles como en data/villagers.ts
PIEL_CLARA = (0.96, 0.82, 0.68)
PIEL_MEDIA = (0.84, 0.64, 0.46)
PIEL_OSCURA = (0.52, 0.36, 0.24)
PIEL_ROSADA = (0.98, 0.76, 0.66)

# altura/anchura escalan la figura (altura base ~1,5 m). top: (tipo, color,
# color secundario); bajo: (tipo, color); peinado y tocado: estilos de abajo.
PERSONAJES = {
    "rosa": dict(
        altura=0.88, anchura=1.1, piel=PIEL_CLARA, pelo=(0.86, 0.86, 0.88), peinado="mono",
        tocado=None, top=("rebeca", (0.55, 0.36, 0.78), (0.78, 0.7, 0.9)), manga="larga",
        bajo=("falda", (0.33, 0.2, 0.4)), zapato=NEGRO, extras=["gafas", "cesta"],
    ),
    "pablo": dict(
        altura=0.8, anchura=0.88, piel=PIEL_MEDIA, pelo=(0.2, 0.12, 0.07), peinado="corto",
        tocado=("gorra", (0.85, 0.22, 0.2)), top=("camiseta", (0.2, 0.5, 0.88), None),
        manga="corta", bajo=("corto", (0.15, 0.2, 0.36)), zapato=BLANCO, extras=[],
    ),
    "ernesto": dict(
        altura=1.03, anchura=1.22, piel=PIEL_ROSADA, pelo=(0.5, 0.48, 0.46), peinado="corto",
        tocado=("paja", (0.85, 0.72, 0.42)), top=("camisa", (0.93, 0.9, 0.8), None),
        manga="remangada", bajo=("pantalon", (0.48, 0.32, 0.2)), zapato=CUERO_OSCURO,
        extras=["barba", "cinturon"],
    ),
    "clara": dict(
        altura=0.97, anchura=0.98, piel=PIEL_OSCURA, pelo=(0.08, 0.06, 0.05), peinado="corto",
        tocado=("panuelo", (0.2, 0.62, 0.58)), top=("camisa", (0.95, 0.75, 0.22), None),
        manga="corta", bajo=("falda", (0.2, 0.28, 0.5)), zapato=CUERO, extras=["delantal"],
    ),
    "mateo": dict(
        altura=1.1, anchura=0.9, piel=PIEL_CLARA, pelo=(0.78, 0.4, 0.18), peinado="revuelto",
        tocado=None, top=("jersey", (0.25, 0.55, 0.3), None), manga="larga",
        bajo=("pantalon", (0.45, 0.3, 0.18)), zapato=CUERO_OSCURO, extras=["bufanda"],
    ),
    "ines": dict(
        altura=0.96, anchura=0.92, piel=PIEL_MEDIA, pelo=(0.36, 0.22, 0.12), peinado="mono",
        tocado=None, top=("camiseta", (0.92, 0.4, 0.33), None), manga="corta",
        bajo=("pantalon", (0.22, 0.22, 0.24)), zapato=BLANCO, extras=["bolso"],
    ),
    "bruno": dict(
        altura=1.0, anchura=1.28, piel=PIEL_OSCURA, pelo=(0.06, 0.05, 0.05), peinado="corto",
        tocado=("gorra", (0.2, 0.55, 0.3)), top=("peto", (0.22, 0.3, 0.5), (0.3, 0.3, 0.32)),
        manga="larga", bajo=("pantalon", (0.22, 0.3, 0.5)), zapato=CUERO,
        extras=["barba"],
    ),
    "lucia": dict(
        altura=0.92, anchura=0.86, piel=PIEL_ROSADA, pelo=(0.96, 0.8, 0.4), peinado="largo",
        tocado=("pamela", (0.95, 0.6, 0.68)), top=("vestido", (0.55, 0.75, 0.95), None),
        manga="corta", bajo=("medias", (0.95, 0.95, 0.95)), zapato=(0.95, 0.5, 0.6), extras=[],
    ),
    "anselmo": dict(
        altura=0.95, anchura=1.1, piel=PIEL_MEDIA, pelo=(0.62, 0.62, 0.62), peinado="corto",
        tocado=("fedora", (0.3, 0.22, 0.17)), top=("chaleco", (0.5, 0.32, 0.2), BLANCO),
        manga="larga", bajo=("pantalon", (0.3, 0.2, 0.14)), zapato=NEGRO,
        extras=["bigote", "baston"],
    ),
    "nuria": dict(
        altura=1.02, anchura=0.95, piel=PIEL_CLARA, pelo=(0.1, 0.08, 0.08), peinado="bob",
        tocado=("cinta", (0.96, 0.85, 0.3)), top=("chaqueta", (0.5, 0.36, 0.8), BLANCO),
        manga="larga", bajo=("pantalon", (0.13, 0.13, 0.15)), zapato=NEGRO,
        extras=["maletin"],
    ),
}

# ---------- Primitivas con color y hueso ----------
partes = []  # (objeto, hueso)
HUESO = "spine"


def _registrar(obj, color, suave=True):
    malla = obj.data
    attr = malla.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
    c = (*lineal(color), 1.0)
    for d in attr.data:
        d.color = c
    for p in malla.polygons:
        p.use_smooth = suave
    partes.append((obj, HUESO))
    return obj


def esfera(centro, escala, color, rot=(0, 0, 0), seg=16, anillos=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=anillos, radius=1, location=centro)
    obj = bpy.context.object
    obj.scale = escala
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    return _registrar(obj, color)


def caja(centro, medidas, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro)
    obj = bpy.context.object
    obj.scale = medidas
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    mod = obj.modifiers.new("Bisel", "BEVEL")
    mod.width = min(medidas) * 0.25
    mod.segments = 1
    return _registrar(obj, color, suave=False)


def tubo(a, b, r1, r2, color, lados=14):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=lados, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return _registrar(obj, color)


def anillo(centro, radio, grosor, color, escala=(1, 1, 1), rot=(0, 0, 0), seg=20):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radio, minor_radius=grosor, major_segments=seg, minor_segments=6, location=centro
    )
    obj = bpy.context.object
    obj.scale = escala
    obj.rotation_euler = Euler([math.radians(a) for a in rot])
    return _registrar(obj, color)


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


def girar(objs, pivote, rot):
    bpy.context.view_layer.update()
    pivote = Vector(pivote)
    m = Matrix.Translation(pivote) @ Euler([math.radians(a) for a in rot]).to_matrix().to_4x4() @ Matrix.Translation(-pivote)
    for o in objs:
        o.matrix_world = m @ o.matrix_world


GIRO = Matrix.Rotation(math.pi, 4, "Z")

# ---------- Medidas base (figura de ~1,5 m, antes de escalar) ----------
CABEZA = Vector((0, 0, 1.08))
R_CABEZA = 0.3
CADERA_Z = PIERNA
HOMBRO = (0.2, 0, 0.72)
MANO = (0.3, 0.03, 0.44)


def cabeza(p):
    global HUESO
    HUESO = "head"
    piel, pelo = p["piel"], p["pelo"]
    esfera(CABEZA, (0.31, 0.29, 0.29), piel, seg=24, anillos=12)
    tubo((0, 0, 0.74), (0, 0, 0.84), 0.085, 0.08, piel, lados=10)  # cuello
    for s in (-1, 1):
        esfera((s * 0.3, -0.01, 1.06), (0.055, 0.035, 0.07), piel)  # orejas
        esfera((s * 0.1, 0.262, 1.1), (0.034, 0.02, 0.046), OJO, rot=(-8, 0, 0))
        esfera((s * 0.1 + 0.012, 0.279, 1.117), (0.011, 0.006, 0.011), BRILLO, seg=8, anillos=4)
        esfera((s * 0.175, 0.225, 1.01), (0.05, 0.02, 0.032), MEJILLA, rot=(0, 0, s * 35))
        caja((s * 0.1, 0.27, 1.175), (0.07, 0.018, 0.018), pelo, rot=(-20, 0, s * -6))  # cejas
    esfera((0, 0.295, 1.04), (0.036, 0.03, 0.03), tuple(c * 0.95 for c in piel))  # nariz
    # Sonrisa: medio anillo bajo la nariz
    boca = anillo((0, 0.283, 0.985), 0.035, 0.008, (0.55, 0.22, 0.2), rot=(90, 0, 0), seg=12)
    recortar(boca, lambda co: co.z < 0.987)

    estilo = p["peinado"]
    tocado_ = p["tocado"][0] if p["tocado"] else None
    con_ala = tocado_ in ("paja", "fedora", "pamela")
    casco = esfera(CABEZA + Vector((0, -0.02, 0.02)), (0.322, 0.305, 0.3), pelo, seg=24, anillos=12)
    if estilo == "bob":
        recortar(casco, lambda co: co.y < 0.1 or co.z > 1.24)
        for s in (-1, 1):
            esfera((s * 0.27, 0.02, 1.0), (0.08, 0.16, 0.17), pelo)  # melena hasta la barbilla
    else:
        recortar(casco, lambda co: co.y < 0.06 or co.z > 1.25)
    if con_ala:  # bajo el ala no debe asomar pelo por encima
        recortar(casco, lambda co: co.z < 1.25)
    if estilo in ("corto", "bob", "largo", "mono") and tocado_ in (None, "panuelo", "cinta"):
        esfera((0, 0.2, 1.28), (0.24, 0.1, 0.07), pelo, rot=(-25, 0, 0))  # flequillo
    if estilo == "mono":
        esfera((0, -0.03, 1.42), (0.13, 0.13, 0.11), pelo)
    if estilo == "revuelto":
        for x, y, z, r in ((0, 0.18, 1.32, 0.1), (-0.14, 0.14, 1.3, 0.09), (0.14, 0.15, 1.31, 0.09),
                           (0.07, 0.0, 1.4, 0.12), (-0.1, -0.05, 1.38, 0.11), (0.2, -0.05, 1.3, 0.09),
                           (-0.21, -0.03, 1.29, 0.09), (0, -0.18, 1.32, 0.11)):
            esfera((x, y, z), (r, r, r * 0.8), pelo, rot=(0, 0, x * 200))
    if estilo == "largo":
        esfera((0, -0.12, 0.95), (0.3, 0.14, 0.3), pelo)  # melena por la espalda
        for s in (-1, 1):
            esfera((s * 0.27, 0.0, 0.93), (0.08, 0.1, 0.22), pelo)

    extras = p["extras"]
    if "barba" in extras:
        barba = esfera((0, 0.14, 0.96), (0.27, 0.18, 0.2), pelo)
        recortar(barba, lambda co: co.y > 0.06 and co.z < 1.03)
        for s in (-1, 1):
            esfera((s * 0.05, 0.285, 1.0), (0.06, 0.028, 0.028), pelo, rot=(0, s * 18, s * -12))
    if "bigote" in extras:
        for s in (-1, 1):
            esfera((s * 0.055, 0.285, 1.0), (0.065, 0.03, 0.03), pelo, rot=(0, s * 22, s * -14))
    if "gafas" in extras:
        for s in (-1, 1):
            anillo((s * 0.1, 0.29, 1.1), 0.06, 0.008, NEGRO, rot=(90, 0, 0), seg=16)
            tubo((s * 0.16, 0.285, 1.11), (s * 0.29, 0.1, 1.12), 0.006, 0.006, NEGRO, lados=6)
        tubo((-0.04, 0.29, 1.11), (0.04, 0.29, 1.11), 0.006, 0.006, NEGRO, lados=6)


def tocado(p):
    global HUESO
    HUESO = "head"
    if not p["tocado"]:
        return
    tipo, color = p["tocado"]
    oscuro = tuple(c * 0.75 for c in color)
    n = len(partes)
    if tipo == "gorra":
        cap = esfera(CABEZA + Vector((0, -0.01, 0.06)), (0.33, 0.32, 0.3), color, seg=24, anillos=12)
        recortar(cap, lambda co: co.z > 1.19)
        visera = esfera((0, 0.27, 1.22), (0.2, 0.17, 0.02), color, rot=(-12, 0, 0))
        recortar(visera, lambda co: co.y > 0.16)
        esfera((0, -0.01, 1.44), (0.03, 0.03, 0.02), oscuro, seg=8, anillos=4)  # botón
    elif tipo == "paja":
        base = Vector((0, -0.02, 1.27))
        tubo(base, base + Vector((0, 0, 0.025)), 0.47, 0.47, color, lados=28).scale = (1, 0.88, 1)
        anillo(base + Vector((0, 0, 0.03)), 0.455, 0.026, oscuro, escala=(1, 0.88, 1), seg=28)
        tubo(base, base + Vector((0, 0, 0.2)), 0.23, 0.2, color, lados=20)
        esfera(base + Vector((0, 0, 0.2)), (0.2, 0.19, 0.045), color)
        tubo(base + Vector((0, 0, 0.02)), base + Vector((0, 0, 0.07)), 0.234, 0.228, CUERO, lados=20)
        girar(partes_desde(n), base, (-10, 0, 0))
    elif tipo == "fedora":
        base = Vector((0, -0.02, 1.27))
        tubo(base, base + Vector((0, 0, 0.022)), 0.38, 0.38, color, lados=28)
        tubo(base, base + Vector((0, 0, 0.21)), 0.22, 0.2, color, lados=20)
        esfera(base + Vector((0, 0, 0.21)), (0.2, 0.18, 0.04), color)
        caja(base + Vector((0, 0.06, 0.24)), (0.05, 0.16, 0.03), oscuro)  # pellizco de la copa
        tubo(base + Vector((0, 0, 0.02)), base + Vector((0, 0, 0.07)), 0.226, 0.222, NEGRO, lados=20)
        girar(partes_desde(n), base, (-8, 0, 0))
    elif tipo == "pamela":
        base = Vector((0, -0.02, 1.25))
        ala = esfera(base + Vector((0, 0, 0.02)), (0.52, 0.5, 0.06), color, seg=28, anillos=8)
        recortar(ala, lambda co: co.z > base.z - 0.005)
        esfera(base + Vector((0, 0, 0.1)), (0.24, 0.23, 0.17), color)
        anillo(base + Vector((0, 0, 0.06)), 0.235, 0.025, BLANCO, seg=20)
        girar(partes_desde(n), base, (-16, 0, 0))
    elif tipo == "panuelo":
        tela = esfera(CABEZA + Vector((0, -0.025, 0.03)), (0.335, 0.32, 0.315), color, seg=24, anillos=12)
        recortar(tela, lambda co: co.y < 0.16 or co.z > 1.27)
        esfera((0, -0.3, 1.02), (0.06, 0.05, 0.05), color)  # nudo
        for s in (-1, 1):
            esfera((s * 0.05, -0.31, 0.93), (0.04, 0.025, 0.09), color, rot=(0, s * 20, 0))
    elif tipo == "cinta":
        # Diadema: alta en la frente y baja en la nuca, pegada a la cabeza
        anillo(CABEZA + Vector((0, -0.02, 0.06)), 0.28, 0.032, color, escala=(1.08, 1.0, 1), rot=(35, 0, 0), seg=24)
        esfera((0.24, 0.1, 1.22), (0.06, 0.03, 0.05), color, rot=(0, 0, 30))  # lazo


def partes_desde(n):
    return [o for o, _ in partes[n:]]


def tronco(p):
    global HUESO
    tipo, color, color2 = p["top"]
    w = p["anchura"]
    oscuro = tuple(c * 0.8 for c in color)
    HUESO = "spine"
    torso = color2 if tipo in ("peto", "chaleco", "chaqueta") else color
    esfera((0, 0, 0.58), (0.22 * w, 0.19 * w, 0.22), torso)
    if tipo == "rebeca":
        esfera((0, 0.15 * w, 0.66), (0.08, 0.05, 0.08), color2)  # blusa en el escote
        for z in (0.5, 0.57, 0.64):
            esfera((0, 0.19 * w + 0.005, z), (0.018, 0.01, 0.018), BLANCO, seg=8, anillos=4)
        anillo((0, 0, 0.42), 0.21 * w, 0.025, oscuro, escala=(1, 0.88, 1))
    elif tipo == "camisa":
        for s in (-1, 1):
            caja((s * 0.05, 0.11, 0.78), (0.08, 0.05, 0.03), color, rot=(-30, 0, s * 25))  # cuello
    elif tipo == "jersey":
        anillo((0, 0, 0.42), 0.21 * w, 0.03, oscuro, escala=(1, 0.88, 1))
        anillo((0, 0.0, 0.79), 0.09, 0.025, oscuro)
    elif tipo == "chaleco":
        for s in (-1, 1):
            caja((s * 0.08 * w, 0.16 * w, 0.58), (0.13 * w, 0.06, 0.3), color, rot=(-6, 0, s * 12))
        caja((0, -0.16 * w, 0.58), (0.3 * w, 0.05, 0.3), color)
        for z in (0.5, 0.58):
            esfera((0.02, 0.2 * w, z), (0.016, 0.01, 0.016), LATON, seg=8, anillos=4)
    elif tipo == "chaqueta":
        chaq = esfera((0, -0.01, 0.57), (0.235 * w, 0.205 * w, 0.24), color)
        recortar(chaq, lambda co: co.y < 0.12 or abs(co.x) > 0.06)
        for s in (-1, 1):
            caja((s * 0.07, 0.17 * w, 0.7), (0.05, 0.03, 0.14), oscuro, rot=(-10, 0, s * -20))  # solapas
    elif tipo == "peto":
        caja((0, 0.17 * w, 0.58), (0.24 * w, 0.05, 0.2), color, rot=(-10, 0, 0))
        caja((0, 0.195 * w, 0.58), (0.1, 0.012, 0.07), oscuro, rot=(-10, 0, 0))
        for s in (-1, 1):
            caja((s * 0.09, 0.11, 0.72), (0.04, 0.12, 0.022), color, rot=(-35, 0, 0))
            caja((s * 0.09, -0.12, 0.64), (0.04, 0.06, 0.2), color, rot=(18, 0, 0))
            esfera((s * 0.09, 0.19 * w, 0.67), (0.02, 0.012, 0.02), LATON, seg=8, anillos=4)
    elif tipo == "vestido":
        anillo((0, 0.03, 0.79), 0.1, 0.025, BLANCO)  # cuello de bebé

    if "bufanda" in p["extras"]:
        anillo((0, 0.01, 0.8), 0.11, 0.04, (0.85, 0.2, 0.2))
        caja((0.07, 0.15, 0.66), (0.07, 0.03, 0.2), (0.85, 0.2, 0.2), rot=(-12, 0, 8))
    if "bolso" in p["extras"]:
        anillo((0, 0, 0.58), 0.25 * w, 0.012, CUERO, escala=(1, 0.95, 1.3), rot=(0, 40, 0), seg=24)

    # Caderas: lo que no sigue a las piernas
    HUESO = "hips"
    bajo, color_bajo = p["bajo"]
    if tipo == "vestido":
        tubo((0, 0, 0.5), (0, 0, 0.2), 0.2 * w, 0.32 * w, color, lados=20)
    elif bajo == "falda":
        tubo((0, 0, 0.48), (0, 0, 0.1), 0.22 * w, 0.3 * w, color_bajo, lados=20)
    else:
        cadera = color if tipo == "peto" else color_bajo
        esfera((0, 0, 0.42), (0.23 * w, 0.2 * w, 0.14), cadera)
    if "cinturon" in p["extras"]:
        anillo((0, 0, 0.44), 0.235 * w, 0.022, CUERO_OSCURO, escala=(1, 0.88, 1))
        caja((0, 0.21 * w, 0.44), (0.06, 0.015, 0.045), LATON)
    if "delantal" in p["extras"]:
        caja((0, 0.235 * w, 0.32), (0.3 * w, 0.02, 0.32), BLANCO, rot=(6, 0, 0))
        HUESO = "spine"
        caja((0, 0.19 * w, 0.6), (0.2 * w, 0.02, 0.2), BLANCO, rot=(-8, 0, 0))
        HUESO = "hips"
    if "bolso" in p["extras"]:
        caja((0.27 * w, 0.0, 0.38), (0.07, 0.15, 0.12), CUERO)


def piernas(p):
    global HUESO
    bajo, color_bajo = p["bajo"]
    w = p["anchura"]
    for lado, s in (("R", 1), ("L", -1)):  # +x antes del giro = derecha
        HUESO = f"leg.{lado}"
        x = s * 0.1 * w
        if bajo == "pantalon":
            tubo((x, 0, 0.4), (x, 0, 0.1), 0.085, 0.075, color_bajo)
        elif bajo == "corto":
            tubo((x, 0, 0.4), (x, 0, 0.24), 0.09, 0.085, color_bajo)
            tubo((x, 0, 0.25), (x, 0, 0.08), 0.055, 0.05, p["piel"])
        else:  # falda / medias: pierna con medias o piel bajo la falda
            media = color_bajo if bajo == "medias" else p["piel"]
            tubo((x, 0, 0.36), (x, 0, 0.08), 0.06, 0.05, media)
        zapato = esfera((x, 0.035, 0.055), (0.075, 0.115, 0.06), p["zapato"])
        suela = tubo((x, 0.035, 0.0), (x, 0.035, 0.016), 0.075, 0.075, tuple(c * 0.6 for c in p["zapato"]), lados=12)
        suela.scale = (1, 1.5, 1)
        recortar(zapato, lambda co: co.z > -0.0001)


def brazos(p):
    global HUESO
    tipo, color, color2 = p["top"]
    w = p["anchura"]
    manga = color2 if tipo in ("peto", "chaleco") else color
    for lado, s in (("R", 1), ("L", -1)):  # +x antes del giro = derecha
        HUESO = f"arm.{lado}"
        hombro = Vector((s * HOMBRO[0] * w, 0, HOMBRO[2]))
        mano = Vector((s * (MANO[0] * w + 0.02), MANO[1], MANO[2]))
        d = mano - hombro
        esfera(hombro, (0.085, 0.085, 0.085), manga)
        if p["manga"] == "larga":
            tubo(hombro + d * 0.1, mano - d * 0.12, 0.058, 0.052, manga, lados=10)
            anillo(mano - d * 0.12, 0.05, 0.014, tuple(c * 0.85 for c in manga), rot=(0, s * -20, 0), seg=12)
        elif p["manga"] == "remangada":
            tubo(hombro + d * 0.1, hombro + d * 0.55, 0.06, 0.056, manga, lados=10)
            anillo(hombro + d * 0.55, 0.058, 0.018, manga, rot=(0, s * -20, 0), seg=12)
            tubo(hombro + d * 0.5, mano, 0.05, 0.045, p["piel"], lados=10)
        else:
            anillo(hombro + d * 0.25, 0.065, 0.018, tuple(c * 0.85 for c in manga), rot=(0, s * -20, 0), seg=12)
            tubo(hombro + d * 0.2, mano, 0.05, 0.045, p["piel"], lados=10)
        esfera(mano, (0.058, 0.05, 0.062), p["piel"])

        extras = p["extras"]
        if lado == "L" and "cesta" in extras:
            c = mano + Vector((0.02, 0.04, -0.12))
            cesta = tubo(c + Vector((0, 0, -0.06)), c + Vector((0, 0, 0.04)), 0.07, 0.09, MIMBRE, lados=12)
            cesta.scale = (1, 0.75, 1)
            asa = anillo(c + Vector((0, 0, 0.04)), 0.075, 0.01, MIMBRE, rot=(0, 90, 90), seg=14)
            recortar(asa, lambda co, z=c.z: co.z > z + 0.035)
        if lado == "R" and "baston" in extras:
            tubo(mano + Vector((0, 0.02, 0.02)), Vector((mano.x - 0.02, 0.05, 0.0)), 0.016, 0.014, MADERA, lados=8)
            esfera(mano + Vector((0.02, 0.03, 0.04)), (0.04, 0.025, 0.025), MADERA)
        if lado == "R" and "maletin" in extras:
            c = mano + Vector((-0.02, 0.0, -0.13))
            caja(c, (0.06, 0.24, 0.17), CUERO)
            caja(c + Vector((0, 0, 0.09)), (0.02, 0.08, 0.02), CUERO_OSCURO)
            caja(c + Vector((0.032, 0, 0.04)), (0.004, 0.05, 0.02), LATON)


# ---------- Rig y animación ----------
HUESOS = {  # nombre: (cabeza, padre)
    "root": ((0, 0, 0), None),
    "hips": ((0, 0, CADERA_Z), "root"),
    "spine": ((0, 0, 0.5), "hips"),
    "head": ((0, 0, 0.8), "spine"),
    "leg.L": ((-0.1, 0, CADERA_Z), "hips"),  # antes del giro de 180°
    "leg.R": ((0.1, 0, CADERA_Z), "hips"),
    "arm.L": ((-HOMBRO[0], 0, HOMBRO[2]), "spine"),
    "arm.R": ((HOMBRO[0], 0, HOMBRO[2]), "spine"),
}


def montar(id_, p, mallas):
    """Une las piezas en una malla con grupos de vértices por hueso y la arma."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj, hueso in mallas:
        grupo = obj.vertex_groups.new(name=hueso)
        grupo.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0][0]
    bpy.ops.object.convert(target="MESH")  # aplica biseles
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = obj.data.name = f"SM_{id_}"
    obj.data.materials.clear()
    obj.data.materials.append(MATERIAL)

    # Escala de la figura (altura) horneada en los vértices
    h = p["altura"]
    obj.data.transform(Matrix.Scale(h, 4))
    obj.data.transform(GIRO)  # la cara pasa a -Y (ver la cabecera)

    datos = bpy.data.armatures.new(f"RIG_{id_}")
    arm = bpy.data.objects.new(f"RIG_{id_}", datos)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    w = p["anchura"]
    for nombre, (cabeza_h, padre) in HUESOS.items():
        b = datos.edit_bones.new(nombre)
        x = cabeza_h[0] * (w if nombre.startswith(("leg", "arm")) else 1)
        b.head = GIRO.to_3x3() @ Vector((x, cabeza_h[1], cabeza_h[2])) * h
        b.tail = b.head + Vector((0, 0, 0.1 * h))
        b.roll = 0
        if padre:
            b.parent = datos.edit_bones[padre]
    bpy.ops.object.mode_set(mode="OBJECT")

    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return obj, arm


def clave(arm, f, poses):
    """poses: {hueso: (cabeceo, giro, alabeo en grados, desplazamiento z)}.

    Con el hueso hacia arriba y roll 0, su X local es +X del mundo, su Y la
    vertical y su Z el eje -Y, que es «delante». Cabeceo positivo lleva la
    pierna o el brazo hacia delante; giro, alrededor de la vertical; alabeo
    positivo inclina hacia +X del mundo, el lado izquierdo del personaje.
    """
    for nombre in HUESOS:
        pb = arm.pose.bones[nombre]
        cabeceo, giro, alabeo, dz = poses.get(nombre, (0, 0, 0, 0))
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = Euler((math.radians(-cabeceo), math.radians(giro), math.radians(alabeo)))
        # El eje Y local del hueso apunta hacia arriba (+Z del mundo)
        pb.location = (0, dz, 0)
        pb.keyframe_insert("rotation_euler", frame=f)
        pb.keyframe_insert("location", frame=f)


def animar(arm, p):
    ad = arm.animation_data_create()
    falda = p["bajo"][0] in ("falda",) or p["top"][0] == "vestido"
    amp = ZANCADA_GRADOS * (0.75 if falda else 1)
    h = p["altura"]

    # walk: dos pasos por ciclo; la cadera sube al pasar la pierna y gira un poco
    act = bpy.data.actions.new(f"walk_{p['id']}")
    ad.action = act
    for i in range(9):
        f = 1 + i * WALK // 8
        t = i / 8 * 2 * math.pi
        a = math.sin(t) * amp
        bote = abs(math.cos(t)) * 0.025 * h
        # La cadera gira con la pierna que avanza; el pecho, al revés
        clave(arm, f, {
            "hips": (0, math.sin(t) * 6, math.cos(t) * 2, bote - 0.012 * h),
            "spine": (4, -math.sin(t) * 10, 0, 0),
            "head": (-3, math.sin(t) * 4, 0, 0),
            "leg.L": (a, 0, 0, 0),
            "leg.R": (-a, 0, 0, 0),
            "arm.L": (-a * 0.85, 0, 5, 0),  # brazos algo separados del cuerpo
            "arm.R": (a * 0.85, 0, -5, 0),
        })
    act.name = "walk"
    ad.action = None

    # idle: respiración y un leve vaivén de cabeza en 2 s
    act_i = bpy.data.actions.new(f"idle_{p['id']}")
    ad.action = act_i
    for i in range(5):
        f = 1 + i * IDLE // 4
        t = i / 4 * 2 * math.pi
        clave(arm, f, {
            "hips": (0, 0, 0, 0),
            "spine": (math.sin(t) * 2, 0, 0, math.sin(t) * 0.006 * h),
            "head": (-math.sin(t) * 2, math.sin(t * 0.5) * 6, 0, 0),
            "arm.L": (0, 0, 3 + math.sin(t) * 2, 0),
            "arm.R": (0, 0, -3 - math.sin(t) * 2, 0),
        })
    act_i.name = "idle"
    ad.action = None
    return act, act_i


def nla(arm, acciones):
    ad = arm.animation_data
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    for act in acciones:
        nombre = act.name.split(".")[0]
        track = ad.nla_tracks.new()
        track.name = nombre
        strip = track.strips.new(nombre, 1, act)
        strip.name = nombre
        track.mute = True
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()


def construir(id_, p):
    global partes
    partes = []
    p = dict(p, id=id_)
    piernas(p)
    tronco(p)
    brazos(p)
    cabeza(p)
    tocado(p)
    obj, arm = montar(id_, p, partes)
    acciones = animar(arm, p)
    nla(arm, acciones)
    return obj, arm


def exportar(id_, obj, arm):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    destino = FUENTES / f"transeunte_{id_}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(destino),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_yup=True,
    )
    shutil.copyfile(destino, PUBLIC / destino.name)
    return {
        "triangulos": sum(len(q.vertices) - 2 for q in obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "altura_m": round(obj.dimensions.z, 3),
    }


def preview(figuras):
    escena = bpy.context.scene
    # En fila para la foto (el GLB ya se exportó en el origen)
    for i, (_, arm) in enumerate(figuras):
        arm.location.x = (i - (len(figuras) - 1) / 2) * 0.8  # de izquierda a derecha
    # Fotograma a mitad de paso para ver el rig en acción
    for _, arm in figuras:
        arm.animation_data.nla_tracks["walk"].mute = False
    escena.frame_set(1 + WALK // 4)

    sol = bpy.data.lights.new("Sol", "SUN")
    sol.energy = 3.5
    sol_obj = bpy.data.objects.new("Sol", sol)
    sol_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(25))
    escena.collection.objects.link(sol_obj)

    cam = bpy.data.cameras.new("Camara")
    cam.lens = 40
    cam_obj = bpy.data.objects.new("Camara", cam)
    cam_obj.location = (1.2, -9.5, 3.6)
    escena.collection.objects.link(cam_obj)
    escena.camera = cam_obj
    objetivo = Vector((0, 0, 0.7))
    cam_obj.rotation_euler = (objetivo - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    mundo = bpy.data.worlds.new("Fondo")
    mundo.use_nodes = True
    mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.08, 0.09, 0.11, 1)
    mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.5
    escena.world = mundo

    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 1600
    escena.render.resolution_y = 600
    escena.render.filepath = str(OUT / "preview.png")
    bpy.ops.render.render(write_still=True)
    for _, arm in figuras:
        arm.animation_data.nla_tracks["walk"].mute = True
        arm.location.x = 0


def material_col():
    mat = bpy.data.materials.new("M_Transeunte")
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    attr = ns.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.75
    return mat


if __name__ == "__main__":
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    MATERIAL = material_col()
    FUENTES.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    figuras, metricas = [], {}
    for id_, p in PERSONAJES.items():
        obj, arm = construir(id_, p)
        metricas[id_] = exportar(id_, obj, arm)
        figuras.append((obj, arm))
        print("OK", id_, metricas[id_], flush=True)
    metricas["_zancada_m_por_ciclo"] = round(
        4 * PIERNA * math.sin(math.radians(ZANCADA_GRADOS)), 3
    )  # dos pasos, a escala 1; con falda es 0,75 veces
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "transeuntes.blend"))
    preview(figuras)
