// Ambient globals para el chequeo de tipos (tsc --noEmit).
// Babylon.js y Cannon.js se cargan como <script> UMD vendorizados
// (public/vendor/), no como módulos ES: no hay paquetes @types que instalar,
// así que se declaran como `any` para no perder cobertura de tipos en el
// resto del código.
declare const BABYLON: any;
declare const CANNON: any;

interface Window {
  CANNON: any;
}
