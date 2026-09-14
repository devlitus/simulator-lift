# Plan: Casa de Lila 3D en el juego

Rama: `feature/casa-lila-3d`. Se aplican los skills
`best-zimage-prompting` y `generar-asset-3d`, siguiendo como precedente la
tienda de Marta: modelo propio con textura, colisión independiente y
fallback visible con primitivas.

## Decisión

Crear una casita de florista de estilo chibi, con fachada verde salvia,
entramado y puerta de madera hacia `+z`, tejado terracota a dos aguas,
ventanas con jardineras y flores. La referencia se generará localmente en
ComfyUI con Z-Image-Turbo (1024×1024, 8 pasos, CFG 1.0, fondo liso) y se
convertirá en un GLB texturizado mediante Hunyuan3D-2. El edificio será
estático: no necesita rig ni animaciones.

El nuevo asset se llamará `casa_lila.glb`. Su fuente versionada será
`assets/casa_lila.blend`; las copias exportada y servida serán
`assets/models/casa_lila.glb` y `public/models/casa_lila.glb`.

## Pasos

1. **Referencia.** Generar en ComfyUI una vista frontal limpia de la casa:
   completamente visible, centrada, sin personajes, árboles, texto ni
   recortes; guardar la variante elegida como `assets/casa_lila_referencia.png`.
2. **Modelo con textura.** Usar Hunyuan3D-2 image→3D a partir de esa
   referencia. Antes de la carga se confirmará que no compite con otro
   trabajo pesado de GPU/RAM.
3. **Acabado en Blender.** Soldar los vértices y conservar sólo la isla
   principal si hubiera artefactos; comprobar fachada y puerta hacia `+z`,
   apoyar el edificio en `y = 0`, aplicar la orientación en el eje vertical
   del mundo y guardar el `.blend` fuente. Exportar el GLB con materiales y
   texturas embebidos.
4. **Publicación.** Copiar el GLB idéntico a `assets/models/` y
   `public/models/`; documentar los tres ficheros fuente/publicados en
   `assets/README.md`.
5. **Sustitución en la vista.** En `src/world/worldView.ts`, convertir la
   actual casa verde de Lila en fallback, añadir una caja de colisión fija
   acorde con el volumen actual y cargar `casa_lila.glb` de forma asíncrona.
   El modelo se escalará con su caja envolvente real a una altura objetivo de
   unos 4.8 m, se apoyará con su mínimo vertical y proyectará sombras. Si la
   carga falla, las primitivas actuales permanecerán visibles.
6. **Verificación.** Ejecutar `pnpm verify`; arrancar el juego, comprobar que
   `/models/casa_lila.glb` responde y revisar visualmente que la casa se
   apoya en el suelo, mira al camino (`+z`), bloquea al jugador y no muestra
   el fallback cuando el modelo carga.

## Criterios de aceptación

- La casa verde de primitivas de Lila queda reemplazada por un GLB texturizado.
- La puerta queda hacia el camino y el edificio no flota, se hunde ni rota al
  revés.
- La colisión no depende de la carga del GLB.
- Si el GLB no está disponible, se conserva la casa de primitivas actual.
- `pnpm verify` termina correctamente.
