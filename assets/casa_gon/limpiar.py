"""Acabado reproducible del GLB de Hunyuan; ejecutar dentro de Blender."""

import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ASSETS = Path('/home/carle/works/simulator-lift/assets')
objetos = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if len(objetos) != 1:
    raise RuntimeError('Se esperaba únicamente la malla importada de la casa de Gon')

obj = objetos[0]
obj.name = 'CasaGon'
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

# Esta casa llega con la puerta hacia -X; el giro la deja hacia +Y,
# que glTF sirve hacia +z en Babylon. Verificado en el navegador.
obj.matrix_world = Matrix.Rotation(3 * math.pi / 2, 4, 'Z') @ obj.matrix_world
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
puntos = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
minimo = Vector(tuple(min(p[i] for p in puntos) for i in range(3)))
maximo = Vector(tuple(max(p[i] for p in puntos) for i in range(3)))
obj.location -= Vector(((minimo.x + maximo.x) / 2,
                        (minimo.y + maximo.y) / 2, minimo.z))
bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
for material in obj.data.materials:
    if material and material.use_nodes:
        for nodo in material.node_tree.nodes:
            if nodo.type == 'BSDF_PRINCIPLED':
                nodo.inputs['Metallic'].default_value = 0
                nodo.inputs['Roughness'].default_value = 0.85

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ASSETS / 'casa_gon.blend'))
salida = ASSETS / 'models' / 'casa_gon.glb'
bpy.ops.export_scene.gltf(filepath=str(salida), export_format='GLB',
                          use_selection=True)
print(json.dumps({'vertices_antes': antes,
                  'vertices': len(obj.data.vertices),
                  'caras': len(obj.data.polygons),
                  'islas': [len(i) for i in islas],
                  'dimensiones': list(obj.dimensions),
                  'glb': str(salida)}, ensure_ascii=False))
