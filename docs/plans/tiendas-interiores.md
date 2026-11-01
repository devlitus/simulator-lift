# Plan: tres tiendas con interior y tendero

Rama: `feature/zona-ventas` (sustituye a los puestos sin vendedor de esa rama,
que no llegaron a commit). Estado: aprobado e implementado; pendiente el modelo
3D de Tomás (el servidor de Hunyuan3D no estaba disponible).

## Decisión

Las tres tiendas del mercado serán **edificios del mismo estilo con interior**,
con su tendero detrás del mostrador: se entra con `Intro` por la puerta (como
la casa y el almacén), se habla con el tendero y se compra. Es el patrón de
los juegos de granja (la tienda de Pierre, el rancho de Marnie o la herrería
en Stardew Valley) y aprovecha el sistema de puertas que ya existe.

| Tienda | Tendero | Vende | Exterior (x, z) |
| --- | --- | --- | --- |
| Semillas | Marta | Semillas | 22, -8 |
| Rancho | Nuevo NPC: Tomás, el ganadero | Animales y pienso | 12, -8 |
| Floristería | Lila | Flor y pastel | 4,5, -8 |

Lila ya es la florista: pasa a atender su tienda en lugar de pasear por el
jardín. Sus diálogos, amistad y misiones no cambian.

## Fases

1. **Exteriores del mismo estilo** — un generador procedural en Blender
   (`assets/tiendas/generar.py`), en el estilo de la casa del granjero:
   zócalo de piedra, madera, tejado de tejas, escaparate, toldo y letrero
   rotulado por el juego. Tres variantes (color de toldo y fachada, género en
   el escaparate). Sustituye a `tienda_marta.glb` (Hunyuan, de otro estilo)
   y a los puestos de `assets/puestos_mercado/`, que se borran.
2. **Interiores** — un generador de interior de tienda
   (`assets/tienda_interior/generar.py`, como `casa_interior` y
   `almacen_interior`): suelo, paredes, mostrador, estanterías y género de cada
   tipo (sacos y cajas de semillas; pienso, paja y aperos; cubos de flores,
   macetas y el pastel). Tres escenarios lejos del pueblo, con su planta pura
   (`src/world/shopInterior.ts`) y colisiones testeadas como las de la casa.
3. **Tenderos** — `NpcDef` gana dónde atiende (tienda e interior); Marta y Lila
   se quedan tras su mostrador. Tomás se añade en `data/npcs.ts` con sus
   diálogos; su modelo 3D se genera con el proceso de `generar-asset-3d`
   (referencia en ComfyUI → Hunyuan3D). Si el servidor de Hunyuan no está
   disponible, entra con las primitivas de color y el modelo queda pendiente.
4. **Juego** — `Intro` en cada puerta entra y sale; hablar con el tendero →
   «Comprar» abre su tienda (`GameUI.openShop(kind)`, ya separado por tipo).
   La cámara usa encuadre fijo dentro, como en la casa. Se quitan los puestos
   sin vendedor y su interacción con `E`.
5. **Verificación** — tests de plantas y colisiones, `lint`, `typecheck`,
   `build` y prueba en el navegador de las tres tiendas.

## Fuera de alcance

Horarios de apertura y la rutina de los tenderos (se quedan siempre en su
tienda).
