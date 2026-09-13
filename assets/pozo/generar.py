"""Pozo estilizado reproducible: ejecutar con Blender 5, por fases.

blender --background --python assets/pozo/generar.py -- construir
Las fases hornear/exportar parten de assets/pozo.blend. Ver README.md.
"""

import json
import math
import random
import shutil
import site
import sys
from pathlib import Path

# Blender necesita numpy para glTF; en WSL puede estar instalado en user site.
sys.path.append(site.getusersitepackages())

import bmesh
import bpy
from mathutils import Vector

ASSETS = Path(__file__).resolve().parents[1]
OUT = ASSETS / "pozo"
RNG = random.Random(13092026)


def activar(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def material(nombre, color, rugosidad, tipo="piedra", metal=0.0):
    mat = bpy.data.materials.new(nombre)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rugosidad
    bsdf.inputs["Metallic"].default_value = metal
    coord = ns.new("ShaderNodeTexCoord")
    mapping = ns.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = (12, 12, 1.3) if tipo == "madera" else (1, 1, 1)
    links.new(coord.outputs["Generated"], mapping.inputs[0])
    noise = ns.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5 if tipo == "madera" else 38
    noise.inputs["Detail"].default_value = 3
    noise.inputs["Roughness"].default_value = 0.7
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    ramp = ns.new("ShaderNodeValToRGB")
    for element, factor in zip(ramp.color_ramp.elements, (0.65, 1.18)):
        element.color = (*(min(c * factor, 1) for c in color), 1)
    links.new(noise.outputs["Fac"], ramp.inputs[0])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = ns.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.2
    bump.inputs["Distance"].default_value = 0.009 if tipo == "madera" else 0.015
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    mat["rugosidad"] = rugosidad
    mat["metal"] = metal
    return mat


def acabado(obj, mat, bisel=0.0):
    obj.data.materials.append(mat)
    activar(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bisel:
        mod = obj.modifiers.new("Bordes suaves", "BEVEL")
        mod.width = bisel
        mod.segments = 1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def caja(nombre, centro, medidas, mat, bisel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro)
    obj = bpy.context.object
    obj.name = nombre
    obj.dimensions = medidas
    return acabado(obj, mat, bisel)


def barra(nombre, inicio, fin, radio, mat, vertices=10):
    a, b = Vector(inicio), Vector(fin)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radio, depth=(b - a).length, location=(a + b) / 2
    )
    obj = bpy.context.object
    obj.name = nombre
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return acabado(obj, mat)


def arco(nombre, r_ext, r_int, z0, z1, ang0, ang1, mat, pasos=2, bisel=0.01):
    verts, caras = [], []
    for i in range(pasos + 1):
        a = ang0 + (ang1 - ang0) * i / pasos
        for r, z in ((r_ext, z0), (r_int, z0), (r_ext, z1), (r_int, z1)):
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(pasos):
        j, k = i * 4, (i + 1) * 4
        caras.extend(((j, k, k + 2, j + 2), (k + 1, j + 1, j + 3, k + 3),
                      (j + 2, k + 2, k + 3, j + 3), (k, j, j + 1, k + 1)))
    n = pasos * 4
    if abs(ang1 - ang0 - math.tau) > 1e-6:
        caras.extend(((1, 0, 2, 3), (n, n + 1, n + 3, n + 2)))
    mesh = bpy.data.meshes.new(nombre)
    mesh.from_pydata(verts, [], caras)
    mesh.update()
    obj = bpy.data.objects.new(nombre, mesh)
    bpy.context.collection.objects.link(obj)
    return acabado(obj, mat, bisel)


def construir():
    # La colección propia permite repetir el script sin borrar trabajo ajeno.
    anterior = bpy.data.collections.get("Pozo")
    if anterior:
        for obj in list(anterior.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(anterior)
    coleccion = bpy.data.collections.new("Pozo")
    bpy.context.scene.collection.children.link(coleccion)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children["Pozo"]
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1
    RNG.seed(13092026)

    piedras = [material(f"Caliza_{i}", tuple(c * f for c in (0.40, 0.38, 0.32)), 0.86)
               for i, f in enumerate((0.82, 0.92, 1.0, 1.08, 1.18))]
    madera = material("Roble", (0.30, 0.135, 0.047), 0.76, "madera")
    canto = material("Roble_cantos", (0.21, 0.085, 0.027), 0.8, "madera")
    tejas = [material(f"Terracota_{i}", (0.39 * f, 0.073 * f, 0.041 * f), 0.83)
             for i, f in enumerate((0.82, 0.94, 1.08, 1.2))]
    cuerda = material("Cañamo", (0.41, 0.285, 0.13), 0.94, "madera")
    hierro = material("Hierro", (0.055, 0.064, 0.067), 0.52, metal=0.75)
    agua = material("Agua_profunda", (0.014, 0.045, 0.047), 0.3)

    # Dos hiladas trabadas y una albardilla: el hueco es geometría real.
    for fila, (r, ri, z0, z1) in enumerate(((0.78, 0.53, 0, 0.30),
                                          (0.78, 0.53, 0.31, 0.62),
                                          (0.83, 0.50, 0.63, 0.81))):
        for i in range(12):
            ang = (i + (0.5 if fila == 1 else 0)) * math.tau / 12
            arco(f"Piedra_{fila}_{i:02}", r + RNG.uniform(-0.008, 0.008), ri,
                 z0, z1 + RNG.uniform(-0.006, 0.006), ang + 0.008,
                 ang + math.tau / 12 - 0.008, RNG.choice(piedras), bisel=0.013)
    # Plano opaco sombreado en el fondo, sin transparencia ni coste adicional.
    barra("Fondo_agua", (0, 0, 0.045), (0, 0, 0.065), 0.525, agua, 32)

    for lado in (-1, 1):
        caja("Poste", (lado * 0.67, 0, 1.0), (0.16, 0.18, 1.94), madera)
        caja("Zapata", (lado * 0.67, 0, 0.89), (0.18, 0.20, 0.10), hierro, 0.006)
        caja("Apoyo_eje", (lado * 0.67, 0, 1.30), (0.20, 0.23, 0.19), canto)
        # Riostras cortas bajo el tejado, a ambos lados del poste.
        for frente in (-1, 1):
            a, b = Vector((lado * 0.67, 0, 1.55)), Vector((lado * 0.67, frente * 0.47, 1.80))
            obj = caja("Riostra", (a + b) / 2, (0.09, 0.09, (b - a).length), madera, 0.006)
            obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
        caja("Travesaño", (lado * 0.67, 0, 1.78), (0.13, 1.24, 0.12), canto)

    barra("Torno", (-0.84, 0, 1.30), (0.87, 0, 1.30), 0.085, madera, 16)
    for x in (-0.88, 0.89):
        barra("Collarin", (x - 0.026, 0, 1.30), (x + 0.026, 0, 1.30), 0.112, hierro, 12)
    caja("Manivela", (0.93, 0, 1.16), (0.075, 0.08, 0.34), hierro, 0.005)
    barra("Empuñadura", (0.94, 0, 1.02), (1.11, 0, 1.02), 0.048, madera)
    barra("Cuerda_colgante", (0.05, -0.084, 1.30), (0.05, -0.084, 0.13), 0.018, cuerda, 8)
    for i in range(9):
        bpy.ops.mesh.primitive_torus_add(major_segments=12, minor_segments=4,
                                       location=(-0.10 + i * 0.023, 0, 1.30),
                                       major_radius=0.088, minor_radius=0.012,
                                       rotation=(0, math.pi / 2, 0))
        acabado(bpy.context.object, cuerda).name = "Cuerda_enrollada"

    # Tejas solapadas y cumbrera; el alero tiene grosor visible por debajo.
    pendiente = math.atan2(0.38, 0.66)
    for lado in (-1, 1):
        panel = caja("Tablero_tejado", (0, lado * 0.34, 1.955), (1.86, 0.79, 0.06), canto)
        panel.rotation_euler.x = -lado * pendiente
        for fila in range(3):
            y = 0.13 + fila * 0.235
            for columna in range(6):
                x = -0.80 + columna * 0.32
                z = 2.18 - y * math.tan(pendiente) + (2 - fila) * 0.012
                tile = caja("Teja", (x, lado * y, z), (0.313, 0.315, 0.045),
                            RNG.choice(tejas), 0.009)
                tile.rotation_euler.x = -lado * pendiente
    barra("Cumbrera", (-0.99, 0, 2.16), (0.99, 0, 2.16), 0.072, tejas[1], 12)
    for x in (-0.965, 0.965):
        for lado in (-1, 1):
            a, b = Vector((x, 0, 2.155)), Vector((x, lado * 0.735, 1.74))
            obj = caja("Remate_tejado", (a + b) / 2, (0.07, 0.08, (b - a).length), canto)
            obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()

    # Cubo abierto con duelas y aros, apoyado en el borde frontal.
    cx, cy, cz = 0.32, -0.55, 0.81
    for i in range(12):
        ang = i * math.tau / 12
        obj = arco("Duela", 0.128, 0.103, 0, 0.24, ang + 0.01,
                   ang + math.tau / 12 - 0.01, madera, pasos=1, bisel=0.003)
        obj.location = (cx, cy, cz)
    barra("Base_cubo", (cx, cy, cz), (cx, cy, cz + 0.018), 0.112, canto, 12)
    for altura in (0.045, 0.195):
        obj = arco("Aro_cubo", 0.135, 0.123, 0, 0.025, 0, math.tau,
                   hierro, pasos=16, bisel=0)
        obj.location = (cx, cy, cz + altura)
    for lado in (-1, 1):
        barra("Asa_cubo", (cx + lado * 0.14, cy, cz + 0.18),
              (cx + lado * 0.14, cy, cz + 0.36), 0.012, hierro, 6)
    barra("Asa_cubo_superior", (cx - 0.14, cy, cz + 0.36),
          (cx + 0.14, cy, cz + 0.36), 0.016, hierro, 8)

    # Un objeto/un material final por LOD reduce las llamadas de dibujo.
    piezas = [o for o in coleccion.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in piezas:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = piezas[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "SM_Pozo_LOD0"
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.calc_loop_triangles()
    if len(obj.data.loop_triangles) > 4800:
        mod = obj.modifiers.new("Presupuesto LOD0", "DECIMATE")
        mod.ratio = 4800 / len(obj.data.loop_triangles)
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.008)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.calc_loop_triangles()
    print("Blocking completo:", len(obj.data.loop_triangles), "triángulos")
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.samples = 8
    bpy.context.scene.render.bake.margin = 8
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "pozo.blend"))


def hornear(canal):
    obj = bpy.data.objects["SM_Pozo_LOD0"]
    activar(obj)
    imagen = bpy.data.images.new(f"Pozo_{canal}", width=1024, height=1024, alpha=False)
    if canal != "color":
        imagen.colorspace_settings.name = "Non-Color"
    imagen.filepath_raw = str(OUT / f"pozo_{canal}.png")
    imagen.file_format = "PNG"
    restaurar = []
    for mat in obj.data.materials:
        ns, links = mat.node_tree.nodes, mat.node_tree.links
        destino = ns.new("ShaderNodeTexImage")
        destino.image = imagen
        ns.active = destino
        salida = ns.get("Material Output")
        bsdf = ns.get("Principled BSDF")
        restaurar.append((mat, bsdf.outputs["BSDF"], salida.inputs["Surface"]))
        if canal == "normal":
            continue
        emision = ns.new("ShaderNodeEmission")
        if canal == "color":
            links.new(bsdf.inputs["Base Color"].links[0].from_socket, emision.inputs["Color"])
        else:
            ao = ns.new("ShaderNodeAmbientOcclusion")
            ao.inputs["Distance"].default_value = 0.24
            ao.samples = 16
            combinar = ns.new("ShaderNodeCombineColor")
            combinar.mode = "RGB"
            links.new(ao.outputs["AO"], combinar.inputs[0])
            combinar.inputs[1].default_value = mat["rugosidad"]
            combinar.inputs[2].default_value = mat["metal"]
            links.new(combinar.outputs[0], emision.inputs["Color"])
        links.new(emision.outputs[0], salida.inputs["Surface"])
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.device = "CPU"
    bpy.context.scene.cycles.samples = 8
    bpy.context.scene.render.bake.margin = 8
    bpy.context.scene.render.bake.use_clear = True
    bpy.ops.object.bake(type="NORMAL" if canal == "normal" else "EMIT")
    imagen.save()
    for mat, origen, destino in restaurar:
        mat.node_tree.links.new(origen, destino)
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "pozo.blend"))
    print("Atlas horneado:", imagen.filepath_raw)


def hornear_color():
    hornear("color")


def hornear_orm():
    hornear("orm")


def hornear_normal():
    hornear("normal")


def exportar():
    obj = bpy.data.objects["SM_Pozo_LOD0"]
    # Fuente procedural editable aparte; excluida de GLB y de renders.
    fuente = obj.copy()
    fuente.data = obj.data.copy()
    bpy.data.collections["Pozo"].objects.link(fuente)
    fuente.name = "Pozo_Fuente_Procedural"
    fuente.hide_render = True
    fuente.hide_set(True)
    mat = bpy.data.materials.new("Pozo_PBR")
    mat.use_nodes = True
    ns, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = ns.get("Principled BSDF")
    for canal in ("color", "orm", "normal"):
        textura = ns.new("ShaderNodeTexImage")
        textura.image = bpy.data.images.load(str(OUT / f"pozo_{canal}.png"), check_existing=False)
        if canal != "color":
            textura.image.colorspace_settings.name = "Non-Color"
        if canal == "color":
            links.new(textura.outputs["Color"], bsdf.inputs["Base Color"])
        elif canal == "orm":
            sep = ns.new("ShaderNodeSeparateColor")
            links.new(textura.outputs["Color"], sep.inputs[0])
            links.new(sep.outputs[1], bsdf.inputs["Roughness"])
            links.new(sep.outputs[2], bsdf.inputs["Metallic"])
            # El exportador reconoce este grupo y reutiliza el canal R del ORM.
            grupo = bpy.data.node_groups.get("glTF Material Output")
            if not grupo:
                grupo = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
                grupo.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
            nodo = ns.new("ShaderNodeGroup")
            nodo.node_tree = grupo
            links.new(sep.outputs[0], nodo.inputs["Occlusion"])
        else:
            normal = ns.new("ShaderNodeNormalMap")
            normal.inputs["Strength"].default_value = 0.45
            links.new(textura.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs[0], bsdf.inputs["Normal"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for cara in obj.data.polygons:
        cara.material_index = 0
    activar(obj)
    tri = obj.modifiers.new("Triangulos_exportacion", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=tri.name)
    lods = [obj]
    # El 30 % conserva cerradas las duelas finas del cubo en el último LOD.
    for nivel, ratio in ((1, 0.50), (2, 0.30)):
        lod = obj.copy()
        lod.data = obj.data.copy()
        bpy.data.collections["Pozo"].objects.link(lod)
        lod.name = f"SM_Pozo_LOD{nivel}"
        activar(lod)
        mod = lod.modifiers.new("Simplificacion", "DECIMATE")
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        lod.data.validate()
        # Sin reutilizar normales tangentes de otra topología en los LOD lejanos.
        simple = mat.copy()
        simple.name = f"Pozo_PBR_LOD{nivel}"
        for nodo in list(simple.node_tree.nodes):
            if nodo.type == "NORMAL_MAP" or (nodo.type == "TEX_IMAGE" and "normal" in nodo.image.name):
                simple.node_tree.nodes.remove(nodo)
        lod.data.materials.clear()
        lod.data.materials.append(simple)
        lods.append(lod)
    bpy.ops.object.select_all(action="DESELECT")
    for lod in lods:
        lod.hide_set(False)
        lod.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(ASSETS / "pozo.glb"), export_format="GLB",
                              use_selection=True, export_texcoords=True, export_normals=True,
                              export_tangents=True, export_animations=False, export_extras=True)
    shutil.copy2(ASSETS / "pozo.glb", ASSETS.parent / "public/models/pozo.glb")
    for lod in lods[1:]:
        lod.hide_render = True
        lod.hide_set(True)
    colision = caja("UCX_Pozo", (0, 0, 0.50), (1.6, 1.6, 1.0), mat, 0)
    colision.display_type = "WIRE"
    colision.hide_render = True
    colision.hide_set(True)
    bpy.ops.file.pack_all()
    activar(obj)
    metricas = []
    for lod in lods:
        lod.data.calc_loop_triangles()
        bm = bmesh.new()
        bm.from_mesh(lod.data)
        metricas.append({"nombre": lod.name, "triangulos": len(lod.data.loop_triangles),
                         "vertices": len(lod.data.vertices),
                         "aristas_no_manifold": sum(not e.is_manifold for e in bm.edges),
                         "caras_degeneradas": sum(f.calc_area() < 1e-10 for f in bm.faces)})
        bm.free()
    (OUT / "metricas.json").write_text(json.dumps(metricas, indent=2) + "\n")
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "pozo.blend"))
    print(json.dumps(metricas))


def preparar_preview():
    escena = bpy.context.scene
    if not escena.world:
        escena.world = bpy.data.worlds.new("Estudio")
    escena.world.use_nodes = True
    escena.world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.60, 0.68, 1)
    escena.world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    for nombre, pos, energia, tam in (("Luz_principal", (-3, -4, 6), 650, 4),
                                      ("Luz_relleno", (4, -1, 4), 380, 3),
                                      ("Luz_borde", (1, 4, 5), 700, 3)):
        anterior = bpy.data.objects.get(nombre)
        if anterior:
            bpy.data.objects.remove(anterior, do_unlink=True)
        datos = bpy.data.lights.new(nombre, "AREA")
        datos.energy, datos.shape, datos.size = energia, "DISK", tam
        luz = bpy.data.objects.new(nombre, datos)
        escena.collection.objects.link(luz)
        luz.location = pos
        luz.rotation_euler = (Vector((0, 0, 1)) - luz.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=(3.5, -5.5, 3.8))
    camara = bpy.context.object
    camara.name = "Camara_Pozo"
    camara.rotation_euler = (Vector((0, 0, 1.08)) - camara.location).to_track_quat("-Z", "Y").to_euler()
    camara.data.type = "ORTHO"
    camara.data.ortho_scale = 3.15
    escena.camera = camara
    suelo = material("Suelo_estudio", (0.32, 0.30, 0.26), 0.9)
    caja("Suelo_preview", (0, 0, -0.055), (200, 200, 0.1), suelo, 0)
    escena.render.engine = "BLENDER_EEVEE"
    escena.render.resolution_x = 1000
    escena.render.resolution_y = 1000
    escena.render.resolution_percentage = 100
    escena.view_settings.view_transform = "AgX"
    escena.render.filepath = str(OUT / "preview.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / "pozo.blend"))


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["construir"]
    globals()[args[0]]()
