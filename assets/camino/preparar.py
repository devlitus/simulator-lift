"""Limpia la baldosa de Hunyuan y exporta tres variantes de uso en el juego."""

import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ASSETS = Path(__file__).resolve().parent.parent
objetos = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if len(objetos) != 1:
    raise RuntimeError('Se espera solo la baldosa recién importada de Hunyuan')
obj = objetos[0]
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

bm = bmesh.new()
bm.from_mesh(obj.data)
antes = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
pendientes = set(bm.faces)
islas = []
while pendientes:
    pila = [pendientes.pop()]
    isla = []
    while pila:
        cara = pila.pop()
        isla.append(cara)
        for arista in cara.edges:
            for vecina in arista.link_faces:
                if vecina in pendientes:
                    pendientes.remove(vecina)
                    pila.append(vecina)
    islas.append(isla)
islas.sort(key=len, reverse=True)
descartadas = [cara for isla in islas[1:] for cara in isla]
if descartadas:
    bmesh.ops.delete(bm, geom=descartadas, context='FACES')
sueltas = [v for v in bm.verts if not v.link_faces]
if sueltas:
    bmesh.ops.delete(bm, geom=sueltas, context='VERTS')
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(obj.data)
bm.free()

obj.matrix_world = Matrix.Rotation(math.pi, 4, 'Z') @ obj.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
reductor = obj.modifiers.new('Presupuesto para repetición en los caminos', 'DECIMATE')
reductor.ratio = min(1, 500 / len(obj.data.polygons))
bpy.ops.object.modifier_apply(modifier=reductor.name)
obj.data.calc_loop_triangles()


def normalizar(malla):
    puntos = [v.co for v in malla.data.vertices]
    minimo = Vector(tuple(min(v[i] for v in puntos) for i in range(3)))
    maximo = Vector(tuple(max(v[i] for v in puntos) for i in range(3)))
    ancho, fondo, alto = maximo - minimo
    if min(ancho, fondo, alto) <= 0:
        raise RuntimeError('Baldosa sin volumen')
    centro = (minimo + maximo) / 2
    for vertice in malla.data.vertices:
        vertice.co.x = (vertice.co.x - centro.x) * 0.98 / ancho
        vertice.co.y = (vertice.co.y - centro.y) * 0.98 / fondo
        vertice.co.z = (vertice.co.z - minimo.z) * 0.035 / alto
    malla.data.update()


normalizar(obj)
imagenes = set()
for material in obj.data.materials:
    if not material or not material.use_nodes:
        continue
    for nodo in material.node_tree.nodes:
        if nodo.type == 'BSDF_PRINCIPLED':
            nodo.inputs['Metallic'].default_value = 0
            nodo.inputs['Roughness'].default_value = 0.9
        if nodo.type == 'TEX_IMAGE' and nodo.image:
            imagenes.add(nodo.image)
for imagen in imagenes:
    if max(imagen.size) > 1024:
        imagen.scale(1024, 1024)
    imagen.pack()

variantes = [obj]
for i in (1, 2):
    variante = obj.copy()
    variante.data = obj.data.copy()
    bpy.context.collection.objects.link(variante)
    for vertice in variante.data.vertices:
        x, y = vertice.co.x, vertice.co.y
        vertice.co.x *= 1 + 0.025 * math.sin(y * 7 + i * 1.7)
        vertice.co.y *= 1 + 0.020 * math.sin(x * 8 + i * 2.3)
    # Girar geometría y textura juntas mantiene la correspondencia UV del
    # atlas: reflejar todo el atlas pondría la textura del canto sobre la cara.
    giro = Matrix.Rotation(i * math.pi / 2, 3, 'Z')
    for vertice in variante.data.vertices:
        vertice.co = giro @ vertice.co
    normalizar(variante)
    variantes.append(variante)

resultado = []
for i, variante in enumerate(variantes, start=1):
    variante.name = f'BaldosaCamino_0{i}'
    bpy.ops.object.select_all(action='DESELECT')
    variante.select_set(True)
    bpy.context.view_layer.objects.active = variante
    variante.data.calc_loop_triangles()
    ruta = ASSETS / 'models' / f'baldosa_camino_0{i}.glb'
    bpy.ops.export_scene.gltf(filepath=str(ruta), export_format='GLB',
                              use_selection=True)
    resultado.append({'modelo': variante.name,
                      'triangulos': len(variante.data.loop_triangles),
                      'vertices': len(variante.data.vertices),
                      'dimensiones': [0.98, 0.98, 0.035]})

# Separar las piezas en la fuente facilita compararlas y editarlas. Los GLB
# ya se han exportado individualmente con su base centrada en el origen.
for i, variante in enumerate(variantes):
    variante.location.x = i * 1.2
bpy.ops.object.select_all(action='SELECT')
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / 'baldosas_camino.blend'))
print(json.dumps({'vertices_originales': antes,
                  'islas_originales': [len(i) for i in islas],
                  'texturas': [(i.name, list(i.size)) for i in imagenes],
                  'variantes': resultado}, ensure_ascii=False))
