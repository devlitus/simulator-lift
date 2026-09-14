# Plan: Baldosas de camino 3D

Rama: `feature/baldosas-camino-3d`, creada desde `main` en un worktree
independiente. Incorpora la casa de Gon ya integrada en `main`.

## Objetivo y diseño

Crear tres variantes de baldosa de piedra cálida y gastada, con textura
embebida y relieve muy bajo. Los modelos se colocan sobre los caminos
actuales, de 2,2 m de ancho; la tierra permanece visible entre las piedras.
Las variantes comparten dimensiones para alternarse sin cortes artificiales.

## Trabajo

1. Generar una referencia de baldosa cuadrada con esquinas redondeadas en
   Z-Image-Turbo local: 1024×1024, 8 pasos, CFG 1 y fondo claro liso.
2. Crear la malla y la textura con Hunyuan3D local. En Blender, soldar antes
   de retirar islas, reducir a un presupuesto de unos 500 triángulos por
   baldosa y normalizar la huella y altura usando su caja envolvente.
3. Derivar tres variantes de la malla texturizada, con variaciones leves de
   contorno y orientación, conservando una huella de 0,98 m y altura de 0,035 m.
4. Guardar la fuente `.blend`, el workflow, la referencia y el script;
   exportar las tres variantes en `assets/models/` y `public/models/`.
5. Cargar las variantes una sola vez en `WorldView` y reutilizarlas mediante
   instancias. Distribuir dos filas sobre cada camino, evitando duplicar las
   piedras en el cruce. Mantener el suelo como superficie física y crear
   baldosas de primitivas como respaldo ante un fallo de carga.
6. Ejecutar `pnpm verify` y `pnpm build`. Revisar en el navegador las juntas,
   el cruce, los extremos, las sombras recibidas y que se puede caminar.
   Verificar también el respaldo con los GLB bloqueados.

## Aceptación

- Hay tres modelos GLB con textura y fuente editable.
- Los caminos muestran las variantes sin piedras superpuestas en el cruce.
- El relieve es bajo y no impide caminar por los caminos.
- Se reutilizan geometría y materiales sin importar un GLB por baldosa.
- Ante un fallo de carga, permanece un camino transitable con respaldo.
- Las verificaciones pasan y existe una captura del resultado.
