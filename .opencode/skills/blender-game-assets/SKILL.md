---
name: blender-game-assets
description: Pipeline completo Blender para modelos 3D game-ready — blocking, high/low poly, retopo, UV, bake, PBR, LOD, colision, rig y export FBX a Unity/Unreal/Godot.
type: prompt
whenToUse: When the user asks to create 3D models for games, game-ready assets, low-poly, retopology, UV/bake, LODs, export FBX to Unity/Unreal/Godot, or mentions Blender + juegos.
---

# Blender — Modelos 3D para Juegos (Game-Ready)

Pipeline estándar industria (Blender → Unity / Unreal / Godot). Sintetizado de Meshy, Hyper3D, PropGon Academy, StraySpark 2026, CityGame, Frogames.

Objetivo: malla que se vea AAA pero corra a 60fps. Regla de oro: **silueta primero, detalle después, optimización siempre**.

Output de este proyecto: raíz `W:\render3D\` (AGENTS.md §4). FBX/GLB + texturas + previews ahí.

## 0. Preproducción (antes de abrir Blender)

- Moodboard + referencias: frente/lateral/trasera, materiales, nivel de desgaste, ángulo principal de cámara.
- Define: motor destino (Unity Y-up / Unreal Z-up + cm / Godot), plataforma (móvil/PC/consola), estilo (stylized vs PBR realista).
- Presupuesto de tris (guía 2026, ajustar x0.25 móvil, x2-10 cinemática PC):

| Tipo | Tris |
|---|---|
| Hero prop (arma, item clave) | 5.000–20.000 |
| Prop entorno (caja, mueble) | 500–5.000 |
| Fondo / distante | 100–1.000 |
| Personaje completo | 15.000–80.000 |
| Vehículo | 10.000–50.000 |
| Muro/suelo modular | 100–2.000 |

- Sin referencias claras no modelar: el prop sale sin carácter y rompe las fases siguientes.

## 1. Setup escena Blender

1. Units → Metric, `1 unidad = 1 metro`. Para UE5: o `Unit Scale 0.01` o `export scale 100` (elegir UNA y documentarla).
2. Activa snapping + grid para modulares (incrementos 10/50/100 cm).
3. Nomenclatura desde el día 1: `SM_Nombre_LOD0`, `UCX_Nombre` (colisión), `Nombre_L/_R` huesos.
4. Guarda `.blend` versionado. Valida escala con cubo referencia 1×1×1 m.

## 2. Blocking — silueta

- Solo primitivas, sin detalle. Pregunta: ¿se reconoce a contraluz?
- Hard-surface: Mirror (modela mitad) + Solidify (grosor chapas) + Array (repeticiones).
- Modular: define kit base (muro 2m, esquina, suelo, techo, puerta) que encaje exacto, sin biseles que sobresalgan.
- Origen/pivote: en borde de encaje para modulares, base-centro para props, pies-centro personajes.

## 3. High-poly (detalle que se va a bakear)

- Hard-surface: Boolean (Union/Difference) + Bevel controlado + Sub-D con creases.
  - Bevel define material bajo luz: pequeño/duro = metal, grande/suave = plástico blando.
  - Ngons OK en high plano, nunca en curva que se bakea.
- Orgánico: Sculpt Mode (Dyntopo/Multires) o ZBrush → detalle arrugas, tornillos, costuras.
- Regla: lo que ocupe <3-4 px en el bake es invisible — no lo моделить.
- Mantén high y low alineados en el mismo espacio 3D.

## 4. Retopología / Low-poly (la que entra al motor)

- Manual (RetopoFlow / Quad Draw / poly-by-poly Blender): obligatoria en personajes y mallas que deforman. Cuida edge-loops en hombros, dedos, cara.
- Auto (ZRemesher, Instant Meshes, QuadriFlow, Decimate Planar): válida para props estáticos y entorno.
- IA (Meshy/Hyper3D/Rodin): buen punto de partida/prototipo; siempre cleanup después.
- Checklist low:
  - [ ] Quads dominantes, sin ngons en curvas, tris OK si sombreados bien
  - [ ] `Merge by Distance`, normales `Recalculate Outside`
  - [ ] `Ctrl+A → All Transforms` aplicado
  - [ ] Sin interior faces, non-manifold, zero-area tris
  - [ ] Polígonos donde la cámara los ve, no en caras planas/ocultas (traseras de pared → eliminar)

## 5. UVs + Texel Density

1. Marca seams en zonas ocultas (axilas, detrás orejas, bordes naturales). `U → Unwrap`.
2. Consistencia > aprovechamiento: misma densidad px/m en todas las islas. Verifica con Texel Density Checker + checker pattern.
3. Empaqueta 0-1 sin solapes (salvo simetría intencional). Segundo canal UV1 lightmap solo si hay baked lighting.
4. Resolución según pantalla: 512 props chicos, 1024/2048 entorno, 2048/4096 hero. Todas las islas proporcionales a su área 3D.

## 6. Bake High → Low

- En Blender: low con nodo Image Texture creado, Render Properties → Bake (Normals, AO, Diffuse, Curvature vía cage).
- O Substance Painter / Marmoset / xNormal (gratis).
- Claves: cage + distancia de rayos ajustada, IDs de material por superficie, low y high solapadas.
- Si hay artefactos: revisa retopo y UVs primero, no subas resolución a lo loco.
- Para LOD2+ rebakea normal map propio, no reutilices el de LOD0.

## 7. Texturizado PBR

- Stack: Albedo/BaseColor + Metallic + Roughness + Normal (baked) + AO.
- En Blender: `Principled BSDF`. En Substance: base materials → desgaste lógico con curvature/AO → storytelling (óxido, huellas donde tiene sentido, no decorativo).
- Tilable + shared materials en modulares (menos draw calls). Evita 1 material por módulo.
- FBX no lleva materiales fiables al motor: exporta geometría+UVs, reconstruye material en Unity/Unreal.

## 8. LODs + Colisión

LODs (no-Nanite / Unity / Godot / skeletal):
- LOD0 100%, LOD1 ~50%, LOD2 ~25%, LOD3 ~10% (billboard 2 tris a 80m+).
- Blender: Decimate Collapse (orgánico) / Planar (hard-surface plano), con Triangulate activado para ver budget real. Multires: exporta cada nivel de subdivisión.
- Nombra `Nombre_LOD0/1/2/3` bajo empty padre `Nombre` → Unity/UE autodetectan cadena LOD.
- Nanite (UE5 static opaco): puedes saltar retopo/LOD manual; no sirve para skeletal, foliage denso con masked, ni animados.

Colisión:
- Duplica low → simplifica drástico (`Decimate` o box/capsule/convex). Objeto separado `UCX_Nombre`.
- En UE desactiva Auto Generate Collision si usas UCX propia.

## 9. Rig (solo deformables)

- Huesos mínimos viables (cada hueso cuesta en motor). Jerarquía acorde a anatomía.
- Weight Paint cuidadoso en articulaciones. IK en extremidades.
- Atajo: Mixamo para humanoides.
- Testea en Blender `Alt+A` / NLA antes de exportar.

## 10. Export FBX / GLB

Blender → File → Export → FBX:
- UE5: `Forward -Y, Up Z Up, Apply Transform ON, Apply Scalings FBX All, Scale 1.0 (escena m) o 100 según setup §1, Smoothing Face, solo Mesh+Armature`.
- Unity: `Forward -Z, Up Y Up, Apply Transform ON`. En Unity deja Scale Factor 1.0 y Transform (1,1,1) limpio — si sale 100x o rotado -90°X, el fix va en Blender, no por asset.
- Godot/web/móvil: prefiere GLB/glTF (PBR más limpio que FBX).
- OBJ solo estáticos sin animación.
- Colecciones modulares: export individual, `Combine Meshes OFF` en UE.

Checklist pre-export (12 puntos):
1. Sin ngons 2. Vértices merged 3. Normales fuera 4. Escala aplicada 5. Origen correcto 6. UVs completos 7. Principled con valores plausibles 8. Nombres LOD/UCX 9. Colisión separada 10. LODs generados 11. Mapas bakeados a resolución correcta 12. Test cubo referencia OK

## 11. Import + validación en motor

- UE5: importa LOD0, luego Static Mesh Editor → LOD Import LOD1/2/3, Screen Size 1.0/0.5/0.25/0.1, `stat unit` + LOD Coloration, Dithered transition anti-pop.
- Unity: prefab con LODGroup auto, Frame Debugger para tris por objeto.
- Lumen se ve distinto a EEVEE: reajusta roughness/metallic en motor con luz similar a escena final.
- Errores típicos: escala mal (sombras/colisiones rotas) → unificar §1; TD inconsistente → rehacer UV antes del bake; desgaste ilógico; pivote mal → no encaja modular.

## 12. Troubleshooting rápido

- Bake con manchas → cage/distancia rayos, high/low desalineados.
- Textura estirada → seams + TD checker.
- FBX gigante/rotado → Apply Transforms + Forward/Up según motor.
- OOM en bake → baja texture_size antes que view_size.
- Pop LOD → sube threshold screen 10% cada vez, shadow LOD = LOD1/2.
- IA mesh (50-500K tris, sin UV, vertex colors) → cleanup: merge distance, QuadriFlow a budget, auto-UV, rebake PBR, LODs, export.

## 13. Receta mínima viable (prop simple sin sculpt)

Blocking → Low directo → UV → PBR procedural bakeado → LOD1/2 Decimate → UCX box → FBX → importa + valida escala/material. Horas, no días.

ARGUMENTS: tipo asset (prop/personaje/modular) + motor destino + plataforma + budget tris + con/sin rig.
