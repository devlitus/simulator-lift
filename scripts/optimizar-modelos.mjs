// Optimiza los modelos 3D que sirve el juego.
//
//   pnpm optimizar:modelos              # assets/ -> public/models/
//   pnpm optimizar:modelos -- --out X   # escribe en otra carpeta (pruebas)
//   pnpm optimizar:modelos -- gon.glb   # solo los archivos indicados
//
// Lee SIEMPRE los fuentes de `assets/` (nunca se tocan) y regenera la copia
// publicada en `public/models/`, así que se puede relanzar las veces que haga
// falta. Qué hace con cada modelo lo decide la tabla MODELOS:
//
//   - `tex`   lado máximo de las texturas, que además pasan a WebP
//             (EXT_texture_webp, que el cargador glTF de Babylon trae de serie).
//   - `tris`  fracción de triángulos que se conserva. Solo para las mallas de
//             Hunyuan3D: llegan con sombreado plano (3 vértices propios por
//             triángulo, ~120 000 vértices para ~20 000 posiciones), así que se
//             sueldan por posición+UV, se simplifican con meshoptimizer y se
//             recalculan normales suaves. A la distancia de la cámara un
//             triángulo de esas mallas ocupa 1–3 píxeles: no se distingue.
//   - sin `tris` la geometría no se toca (modelos de pocas caras y aristas
//     vivas: baldosas, parcela, árboles, pozo y todo lo modelado por script).
//
// No se usa Draco ni Meshopt como compresión: Babylon descarga sus
// decodificadores de un CDN externo y el juego no debe depender de eso.
//
// Al terminar comprueba que cada modelo conserva nodos, materiales,
// animaciones y caja envolvente (el código busca nodos por nombre y escala
// varios modelos por su caja real) y falla si algo cambia.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup,
  getBounds,
  prune,
  simplifyPrimitive,
  textureCompress,
  weldPrimitive,
} from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTES = path.join(RAIZ, 'assets');

// Una malla se trata como «de Hunyuan» (soldar + simplificar + normales
// suaves) a partir de este tamaño; así la regadera del granjero, de pocas
// caras y aristas vivas, queda intacta dentro de su mismo archivo.
const VERTICES_MALLA_DENSA = 20000;

// Calidad WebP. Los mapas de normales y ORM del pozo van más altos porque el
// error ahí se ve como ruido en la luz, no como desenfoque.
const CALIDAD_COLOR = 90;
const CALIDAD_DATOS = 96;

/**
 * Archivo publicado -> { src: fuente en assets/, tex?, tris?, error? }.
 * `error` es el desvío máximo de la simplificación, relativo al tamaño de la
 * malla (0,002 ≈ 3 mm en un personaje de 1,5 m; un píxel son ~7 mm con el
 * zoom más cercano).
 */
const MODELOS = {
  // Personajes (1,3–1,5 m de alto en el juego, ~225 px con el zoom mínimo).
  'granjero.glb': { src: 'granjero_texturizado.glb', tex: 1024, tris: 0.3, error: 0.002 },
  'gon.glb': { src: 'models/gon.glb', tex: 1024, tris: 0.3, error: 0.002 },
  'lila.glb': { src: 'models/lila.glb', tex: 1024, tris: 0.3, error: 0.002 },
  'marta.glb': { src: 'models/marta.glb', tex: 1024, tris: 0.3, error: 0.002 },
  // Animales: se clonan por cabeza, así que cada triángulo cuenta varias veces.
  'vaca.glb': { src: 'models/vaca.glb', tex: 1024, tris: 0.3, error: 0.002 },
  'oveja.glb': { src: 'oveja_anim.glb', tex: 1024, tris: 0.3, error: 0.002 },
  'gallina.glb': { src: 'models/gallina.glb', tex: 512, tris: 0.15, error: 0.004 },
  // Edificios de Hunyuan. La casa de Gon y el almacén son grandes en pantalla.
  'casa_gon.glb': { src: 'models/casa_gon.glb', tex: 2048, tris: 0.5, error: 0.001 },
  'almacen.glb': { src: 'almacen.glb', tex: 2048, tris: 0.5, error: 0.001 },
  'puesto_ventas.glb': { src: 'puesto_ventas.glb', tex: 1024, tris: 0.3, error: 0.002 },
  // Props con textura: solo texturas.
  'arbol_01.glb': { src: 'arbol_01.glb', tex: 1024 },
  'arbol_02.glb': { src: 'arbol_02.glb', tex: 1024 },
  'arbol_03.glb': { src: 'arbol_03.glb', tex: 1024 },
  'parcela_plantacion.glb': { src: 'parcela_plantacion.glb', tex: 1024 },
  'pozo.glb': { src: 'pozo.glb', tex: 1024 },
  'baldosa_camino_01.glb': { src: 'models/baldosa_camino_01.glb', tex: 512 },
  'baldosa_camino_02.glb': { src: 'models/baldosa_camino_02.glb', tex: 512 },
  'baldosa_camino_03.glb': { src: 'models/baldosa_camino_03.glb', tex: 512 },
  'escenario.glb': { src: 'escenario.glb', tex: 512 },
  // Modelado por script (colores planos o JPEG de 512 ya ajustados): solo
  // deduplicar y podar, sin pérdida.
  'tomas.glb': { src: 'models/tomas.glb' },
  'casa_granjero.glb': { src: 'casa_granjero.glb' },
  'casa_interior.glb': { src: 'casa_interior.glb' },
  'almacen_interior.glb': { src: 'almacen_interior.glb' },
  'entrada_granja.glb': { src: 'entrada_granja.glb' },
  'tienda_semillas.glb': { src: 'tienda_semillas.glb' },
  'tienda_animales.glb': { src: 'tienda_animales.glb' },
  'tienda_flores.glb': { src: 'tienda_flores.glb' },
  'tienda_interior_semillas.glb': { src: 'tienda_interior_semillas.glb' },
  'tienda_interior_animales.glb': { src: 'tienda_interior_animales.glb' },
  'tienda_interior_flores.glb': { src: 'tienda_interior_flores.glb' },
  'casa_vecino_cabana.glb': { src: 'casa_vecino_cabana.glb' },
  'casa_vecino_encalada.glb': { src: 'casa_vecino_encalada.glb' },
  'casa_vecino_entramado.glb': { src: 'casa_vecino_entramado.glb' },
  'casa_vecino_piedra.glb': { src: 'casa_vecino_piedra.glb' },
  'casa_vecino_porche.glb': { src: 'casa_vecino_porche.glb' },
  ...Object.fromEntries(
    [
      'anselmo',
      'bruno',
      'clara',
      'ernesto',
      'ines',
      'lucia',
      'mateo',
      'nuria',
      'pablo',
      'rosa',
    ].map((id) => [`transeunte_${id}.glb`, { src: `models/transeunte_${id}.glb` }]),
  ),
};

// --- Medidas y huella de un documento (para la tabla y las comprobaciones) ---

function medir(doc) {
  const raiz = doc.getRoot();
  let tris = 0;
  let verts = 0;
  for (const malla of raiz.listMeshes()) {
    for (const prim of malla.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      verts += pos.getCount();
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
    }
  }
  const cajas = raiz.listScenes().map((e) => getBounds(e));
  return {
    tris,
    verts,
    nodos: raiz
      .listNodes()
      .map((n) => n.getName())
      .sort(),
    mallas: raiz
      .listMeshes()
      .map((m) => m.getName())
      .sort(),
    materiales: raiz
      .listMaterials()
      .map((m) => m.getName())
      .sort(),
    animaciones: raiz
      .listAnimations()
      .map((a) => `${a.getName()}:${a.listChannels().length}`)
      .sort(),
    pieles: raiz.listSkins().map((s) => s.listJoints().length),
    texturas: raiz.listTextures().map((t) => (t.getSize() ?? [0, 0]).join('×')),
    min: cajas[0].min,
    max: cajas[0].max,
  };
}

function comprobar(nombre, antes, despues) {
  const fallos = [];
  for (const campo of ['nodos', 'mallas', 'materiales', 'animaciones', 'pieles']) {
    if (JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo])) {
      fallos.push(`cambian ${campo}: ${antes[campo]} -> ${despues[campo]}`);
    }
  }
  // La caja envolvente puede moverse lo que permite la simplificación, pero
  // el juego escala por ella: más de un 0,5 % del tamaño sería un cambio real.
  for (let eje = 0; eje < 3; eje++) {
    const lado = antes.max[eje] - antes.min[eje];
    const desvio = Math.max(
      Math.abs(antes.min[eje] - despues.min[eje]),
      Math.abs(antes.max[eje] - despues.max[eje]),
    );
    if (desvio > lado * 0.005) {
      fallos.push(`la caja se mueve ${desvio.toFixed(4)} en el eje ${'xyz'[eje]} (lado ${lado})`);
    }
  }
  if (fallos.length) throw new Error(`${nombre}: ${fallos.join('; ')}`);
}

// --- Geometría -------------------------------------------------------------

/** Normales suaves: media ponderada por área de las caras que comparten posición. */
function normalesSuaves(doc, prim) {
  const pos = prim.getAttribute('POSITION');
  const idx = prim.getIndices();
  const n = pos.getCount();
  const p = pos.getArray();
  const indices = idx.getArray();

  // Los vértices de una costura de UV comparten posición pero no índice:
  // se acumula por posición para que la luz no marque la costura.
  const grupoDe = new Uint32Array(n);
  const porPosicion = new Map();
  for (let i = 0; i < n; i++) {
    const clave = `${p[i * 3]},${p[i * 3 + 1]},${p[i * 3 + 2]}`;
    let grupo = porPosicion.get(clave);
    if (grupo === undefined) {
      grupo = porPosicion.size;
      porPosicion.set(clave, grupo);
    }
    grupoDe[i] = grupo;
  }

  const suma = new Float64Array(porPosicion.size * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const ux = p[b] - p[a];
    const uy = p[b + 1] - p[a + 1];
    const uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a];
    const vy = p[c + 1] - p[a + 1];
    const vz = p[c + 2] - p[a + 2];
    // El producto vectorial sin normalizar ya pesa cada cara por su área.
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [indices[t], indices[t + 1], indices[t + 2]]) {
      const g = grupoDe[v] * 3;
      suma[g] += nx;
      suma[g + 1] += ny;
      suma[g + 2] += nz;
    }
  }

  const normales = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = grupoDe[i] * 3;
    const largo = Math.hypot(suma[g], suma[g + 1], suma[g + 2]) || 1;
    normales[i * 3] = suma[g] / largo;
    normales[i * 3 + 1] = suma[g + 1] / largo;
    normales[i * 3 + 2] = suma[g + 2] / largo;
  }
  const buffer = doc.getRoot().listBuffers()[0];
  prim.setAttribute(
    'NORMAL',
    doc.createAccessor().setType('VEC3').setArray(normales).setBuffer(buffer),
  );
}

function simplificarMallasDensas(doc, { tris, error }) {
  for (const malla of doc.getRoot().listMeshes()) {
    for (const prim of malla.listPrimitives()) {
      if (prim.getAttribute('POSITION').getCount() < VERTICES_MALLA_DENSA) continue;
      // Sin las normales planas, soldar une los 3 vértices propios de cada
      // triángulo en los ~24 000 que de verdad distinguen posición y UV.
      prim.setAttribute('NORMAL', null);
      weldPrimitive(prim);
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: tris, error });
      normalesSuaves(doc, prim);
    }
  }
}

// --- Proceso ---------------------------------------------------------------

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function optimizar(nombre, cfg, destino) {
  const fuente = path.join(FUENTES, cfg.src);
  const doc = await io.read(fuente);
  doc.setLogger({ debug() {}, info() {}, warn: console.warn, error: console.error });
  const antes = medir(doc);

  if (cfg.tris) simplificarMallasDensas(doc, cfg);

  if (cfg.tex) {
    const comunes = {
      encoder: sharp,
      targetFormat: 'webp',
      resize: [cfg.tex, cfg.tex],
      effort: 6,
    };
    await doc.transform(
      textureCompress({ ...comunes, quality: CALIDAD_COLOR, slots: /^(baseColor|emissive)/ }),
      textureCompress({ ...comunes, quality: CALIDAD_DATOS, slots: /^(?!baseColor|emissive)/ }),
    );
  }

  // keepUniqueNames: el código distingue materiales y mallas por nombre.
  // keepLeaves: `spout_tip` es un nodo vacío que marca la boca de la regadera.
  // Sí se quitan las UV de las mallas cuyo material no tiene textura (los
  // modelos de colores planos las exportan sin usarlas); COLOR_0 se conserva.
  await doc.transform(
    dedup({ keepUniqueNames: true }),
    prune({ keepLeaves: true, keepAttributes: false, keepSolidTextures: true }),
  );

  const salida = path.join(destino, nombre);
  await io.write(salida, doc);

  // Se mide lo escrito, no lo que hay en memoria.
  const despues = medir(await io.read(salida));
  comprobar(nombre, antes, despues);
  return {
    nombre,
    antes: { ...antes, bytes: fs.statSync(fuente).size },
    despues: { ...despues, bytes: fs.statSync(salida).size },
  };
}

function tabla(filas) {
  const mb = (b) => (b / 1e6).toFixed(2).replace('.', ',');
  const miles = (v) => Math.round(v).toLocaleString('es-ES');
  const lineas = [
    '| Archivo | Antes (MB) | Después (MB) | Ahorro | Triángulos | Vértices | Texturas |',
    '| --- | ---: | ---: | ---: | --- | --- | --- |',
  ];
  const cambio = (a, d, f) => (a === d ? f(a) : `${f(a)} → ${f(d)}`);
  let totalAntes = 0;
  let totalDespues = 0;
  for (const { nombre, antes, despues } of filas) {
    totalAntes += antes.bytes;
    totalDespues += despues.bytes;
    lineas.push(
      `| \`${nombre}\` | ${mb(antes.bytes)} | ${mb(despues.bytes)} | ${Math.round(
        (1 - despues.bytes / antes.bytes) * 100,
      )} % | ${cambio(antes.tris, despues.tris, miles)} | ${cambio(
        antes.verts,
        despues.verts,
        miles,
      )} | ${cambio(antes.texturas.join(' ') || '—', despues.texturas.join(' ') || '—', String)} |`,
    );
  }
  lineas.push(
    `| **Total (${filas.length})** | **${mb(totalAntes)}** | **${mb(totalDespues)}** | **${Math.round(
      (1 - totalDespues / totalAntes) * 100,
    )} %** | | | |`,
  );
  return lineas.join('\n');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  let destino = path.join(RAIZ, 'public', 'models');
  const iOut = args.indexOf('--out');
  if (iOut >= 0) destino = path.resolve(args.splice(iOut, 2)[1]);
  const pedidos = args.length ? args : Object.keys(MODELOS).sort();
  for (const nombre of pedidos) {
    if (!MODELOS[nombre]) throw new Error(`Modelo desconocido: ${nombre}`);
  }

  fs.mkdirSync(destino, { recursive: true });
  await MeshoptSimplifier.ready;
  const filas = [];
  for (const nombre of pedidos) {
    filas.push(await optimizar(nombre, MODELOS[nombre], destino));
    process.stderr.write(`✓ ${nombre}\n`);
  }
  console.log(tabla(filas));
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
