// WeatherView (vista Babylon): lluvia o nieve que cae alrededor del foco de la
// cámara. No decide el clima (eso es src/calendar/calendar.ts): solo lo pinta.
// En interiores se apaga, porque allí no llueve.
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Scene } from '@babylonjs/core/scene';
import type { WeatherKind } from '../calendar/calendar';

// Caja de emisión sobre el foco: cubre lo que enseña la cámara con el zoom máximo.
// Nace por debajo de la cámara (zoom inicial 12) para que ningún copo pase
// pegado al objetivo y se vea enorme.
const AREA = 26;
const HEIGHT = 10;

export class WeatherView {
  private rain: ParticleSystem;
  private snow: ParticleSystem;
  private origin = new Vector3(0, HEIGHT, 0);
  private weather: WeatherKind = 'sol';
  private indoors = false;

  constructor(scene: Scene) {
    this.rain = this.crearLluvia(scene);
    this.snow = this.crearNieve(scene);
  }

  setWeather(weather: WeatherKind): void {
    this.weather = weather;
    this.sync();
  }

  /** Se llama cada frame con el punto al que mira la cámara. */
  update(focusX: number, focusZ: number, indoors: boolean): void {
    this.origin.set(focusX, HEIGHT, focusZ);
    if (indoors !== this.indoors) {
      this.indoors = indoors;
      this.sync();
    }
  }

  private sync(): void {
    const fuera = !this.indoors;
    this.toggle(this.rain, fuera && this.weather === 'lluvia');
    this.toggle(this.snow, fuera && this.weather === 'nieve');
  }

  private toggle(ps: ParticleSystem, on: boolean): void {
    if (on && !ps.isStarted()) ps.start();
    if (!on && ps.isStarted()) {
      ps.stop();
      ps.reset(); // al entrar en casa no se quedan gotas flotando en la escena
    }
  }

  private textura(scene: Scene, name: string, draw: (ctx: CanvasRenderingContext2D) => void) {
    const tex = new DynamicTexture(name, 32, scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    draw(ctx);
    tex.hasAlpha = true;
    tex.update();
    return tex;
  }

  private base(scene: Scene, name: string, capacity: number): ParticleSystem {
    const ps = new ParticleSystem(name, capacity, scene);
    ps.emitter = this.origin;
    ps.minEmitBox = new Vector3(-AREA, 0, -AREA);
    ps.maxEmitBox = new Vector3(AREA, 0, AREA);
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.isLocal = false;
    return ps;
  }

  // Gotas: trazos finos y alargados que caen rápido en la dirección de la caída
  private crearLluvia(scene: Scene): ParticleSystem {
    const ps = this.base(scene, 'lluvia', 3000);
    ps.particleTexture = this.textura(scene, 'gotaLluviaTex', (ctx) => {
      ctx.fillStyle = 'white';
      ctx.fillRect(14, 0, 4, 32);
    });
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.color1 = new Color4(0.8, 0.88, 1, 0.8);
    ps.color2 = new Color4(0.66, 0.76, 0.92, 0.65);
    ps.colorDead = new Color4(0.6, 0.72, 0.9, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.14;
    ps.minScaleY = 5;
    ps.maxScaleY = 7;
    ps.minLifeTime = 0.55;
    ps.maxLifeTime = 0.65;
    ps.emitRate = 2600;
    ps.direction1 = new Vector3(-0.6, -18, -0.3);
    ps.direction2 = new Vector3(-0.4, -16, -0.1);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1;
    return ps;
  }

  // Copos: puntos blancos que bajan despacio y se mecen
  private crearNieve(scene: Scene): ParticleSystem {
    const ps = this.base(scene, 'nieve', 4000);
    ps.particleTexture = this.textura(scene, 'copoTex', (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    });
    ps.color1 = new Color4(1, 1, 1, 0.95);
    ps.color2 = new Color4(0.9, 0.94, 1, 0.8);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.14;
    ps.maxSize = 0.24;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 6;
    ps.emitRate = 600; // 600 × 6 s cabe en la capacidad: sin huecos en la nevada
    ps.direction1 = new Vector3(-0.4, -1.6, -0.4);
    ps.direction2 = new Vector3(0.4, -1.9, 0.4);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1;
    ps.minAngularSpeed = -1;
    ps.maxAngularSpeed = 1;
    ps.preWarmCycles = 200; // al empezar a nevar ya hay copos a todas las alturas
    ps.preWarmStepOffset = 5;
    return ps;
  }
}
