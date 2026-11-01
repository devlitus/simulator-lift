// WellView (vista Babylon): anima el pozo al llenar la regadera. El cubo baja
// al fondo mientras la cuerda se alarga y la manivela gira, y vuelve a subir;
// al llegar arriba avisa para que se llene la regadera. Sin reglas de juego:
// quien recibe el aviso (main.ts) se lo pide a FarmLogic.
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh, Scene } from '@babylonjs/core';

// Línea de tiempo (s): el cubo baja, espera en el fondo y sube.
const BAJA_HASTA = 0.9;
const SUBE_DESDE = 1.2;
const SUBE_HASTA = 2.1;
const BAJADA = 0.62; // cuánto baja el cubo (m): casi hasta el agua del fondo
const RADIO_TORNO = 0.085; // la manivela gira lo que enrolla el torno

// Suavizado para que el cubo arranque y frene sin tirones
function suave(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export interface WellParts {
  cubo: AbstractMesh;
  cuerda: AbstractMesh;
  manivela: AbstractMesh;
}

export class WellView {
  // Pivotes en espacio de mundo: así los giros y escalas no dependen de la
  // conversión de ejes del glTF.
  private cubo: TransformNode; // centro del cubo
  private cuerda: TransformNode; // punto del torno del que cuelga la cuerda
  private manivela: TransformNode; // eje del torno, a la altura de la manivela
  private cuboReposo: Vector3;
  private largoCuerda: number; // largo de la cuerda en reposo
  private altoAsa: number; // del centro del cubo al extremo de la cuerda
  private t = -1; // segundos desde que empezó (-1 = parado)
  private alSubir: (() => void) | null = null;

  constructor(scene: Scene, parts: WellParts) {
    const pivote = (nombre: string, mesh: AbstractMesh, punto: Vector3): TransformNode => {
      const nodo = new TransformNode(nombre, scene);
      nodo.position.copyFrom(punto);
      nodo.rotationQuaternion = Quaternion.Identity();
      mesh.setParent(nodo); // conserva la transformación de mundo
      return nodo;
    };
    const caja = (m: AbstractMesh) => {
      m.computeWorldMatrix(true); // también actualiza su caja en mundo
      return m.getBoundingInfo().boundingBox;
    };
    const bCubo = caja(parts.cubo);
    const bCuerda = caja(parts.cuerda);
    const bManivela = caja(parts.manivela);
    const arriba = new Vector3(
      bCuerda.centerWorld.x,
      bCuerda.maximumWorld.y,
      bCuerda.centerWorld.z,
    );
    this.largoCuerda = bCuerda.maximumWorld.y - bCuerda.minimumWorld.y;
    this.cuboReposo = bCubo.centerWorld.clone();
    this.altoAsa = arriba.y - this.largoCuerda - this.cuboReposo.y;
    this.cubo = pivote('pozoCubo', parts.cubo, this.cuboReposo);
    this.cuerda = pivote('pozoCuerda', parts.cuerda, arriba);
    // El torno corre a lo largo del eje X del mundo, a la altura de la cuerda
    this.manivela = pivote(
      'pozoManivela',
      parts.manivela,
      new Vector3(bManivela.centerWorld.x, arriba.y, arriba.z),
    );
  }

  /** Baja y sube el cubo; `alSubir` se llama cuando vuelve arriba. Devuelve la duración (s). */
  play(alSubir: () => void): number {
    this.alSubir = alSubir;
    this.t = 0;
    return SUBE_HASTA;
  }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    const t = this.t;
    let hondo = 0;
    if (t < BAJA_HASTA) hondo = suave(t / BAJA_HASTA);
    else if (t < SUBE_DESDE) hondo = 1;
    else hondo = 1 - suave((t - SUBE_DESDE) / (SUBE_HASTA - SUBE_DESDE));
    const bajada = hondo * BAJADA;

    this.cubo.position.set(this.cuboReposo.x, this.cuboReposo.y - bajada, this.cuboReposo.z);
    this.manivela.rotationQuaternion = Quaternion.RotationAxis(
      Vector3.Right(),
      bajada / RADIO_TORNO,
    );
    // La cuerda baja del torno al asa: se estira lo que baja el cubo
    const largo = this.cuerda.position.y - (this.cubo.position.y + this.altoAsa);
    this.cuerda.scaling.set(1, Math.max(largo, 0.01) / this.largoCuerda, 1);

    if (t >= SUBE_HASTA) {
      this.t = -1;
      const avisar = this.alSubir;
      this.alSubir = null;
      avisar?.();
    }
  }
}
