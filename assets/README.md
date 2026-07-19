# assets/

Carpeta reservada para contenido binario futuro: modelos `.glb`/`.gltf`, texturas, sprites y audio.

La v1 del simulador no la necesita: personajes, cultivos, NPCs y edificios se construyen enteramente con primitivas de Babylon.js (`BABYLON.MeshBuilder`) definidas en código, así que no hay nada que versionar aquí todavía.

Cuando se incorporen modelos externos (ver "Posibles mejoras futuras" en el README principal), la convención propuesta es:

```
assets/
  models/   # .glb / .gltf
  textures/
  audio/
```

y cargarlos con `BABYLON.SceneLoader.ImportMeshAsync(...)` desde la vista de dominio correspondiente (p. ej. `src/npcs/npcView.js` para reemplazar las primitivas de un NPC), manteniendo un *fallback* a las primitivas actuales si el modelo no carga.
