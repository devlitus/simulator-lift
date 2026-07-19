Actúa como un desarrollador senior de videojuegos web especializado en Babylon.js, HTML5 y JavaScript (ES6+).

OBJETIVO
Crea un simulador de vida tipo pueblo en 3D, estilo Stardew Valley, jugable en el navegador, usando Babylon.js como motor. Combina tres sistemas: granja, relaciones con NPCs y misiones.

REQUISITOS TÉCNICOS
- Motor: Babylon.js (última versión estable disponible).
- HTML5 + JavaScript ES6+. TypeScript es aceptable si lo justificas.
- Usa primitivas geométricas básicas de Babylon.js (cajas, cilindros, esferas, planos) para representar personajes, cultivos y edificios — no dependas de modelos 3D externos (.glb/.gltf) salvo que expliques cómo y de dónde se cargarían.
- Física integrada de Babylon.js (Cannon.js, Ammo.js u Oimo.js — indica cuál eliges y por qué) para colisiones básicas del jugador con el entorno.
- Cámara en tercera persona o isométrica (indica cuál eliges y por qué encaja mejor con este tipo de juego).
- Código organizado en módulos claros (ej: Jugador, Cultivos, NPCs, Misiones, Economía, Mundo, UI, GameLoop).
- Guardado de partida en localStorage.
- Debe funcionar abriendo el proyecto en un servidor local simple (indica cómo se ejecuta).

SISTEMAS QUE DEBE INCLUIR

1. MUNDO Y GRANJA
   - Terreno navegable en 3D con una parcela de granja donde plantar.
   - Varios tipos de cultivos con distinto tiempo de crecimiento y precio.
   - Etapas visuales de crecimiento representadas con cambios de escala/color del modelo.
   - Necesidad de riego; los cultivos se marchitan si no se riegan.
   - Ciclo día/noche simple (afecta iluminación de la escena).

2. NPCS Y RELACIONES
   - Al menos 3 NPCs con posición fija o rutas de movimiento simples (waypoints).
   - Sistema de diálogo básico al interactuar (acercarse + tecla de interacción).
   - Medidor de "amistad/relación" por NPC que sube al hablar o regalar objetos.
   - Los NPCs deben reaccionar (cambiar diálogo) según el nivel de relación.

3. MISIONES
   - Al menos 3 misiones simples (ej: entregar un cultivo a un NPC, recolectar X objetos, hablar con alguien).
   - Panel de seguimiento de misión activa.
   - Recompensas en monedas o mejora de relación al completarlas.

4. ECONOMÍA
   - Moneda del jugador.
   - Punto de venta (tienda o mercado) para vender cosechas.
   - Tienda para comprar semillas, herramientas o regalos para NPCs.

5. INTERFAZ DE USUARIO
   - HUD con dinero, día actual, misión activa e inventario.
   - Sistema de movimiento con teclado (WASD o flechas) e interacción con tecla dedicada.
   - Notificaciones simples de eventos (ej: "Cosecha lista", "Misión completada").

ENTREGABLES
1. El código completo y funcional (indica cómo estructurar los archivos del proyecto).
2. Un breve resumen (máx. 10 líneas) de cómo está organizado el código y cómo ampliarlo.
3. Una lista de 3-5 posibles mejoras futuras (más NPCs, estaciones del año, animales, multijugador, etc.).

RESTRICCIONES
- Prioriza que el juego sea jugable y sin errores por encima de tener contenido masivo.
- Si simplificas algo por limitaciones de espacio o complejidad 3D, dilo explícitamente en vez de dejar código incompleto sin avisar.
- Si alguna funcionalidad pedida es poco viable en una primera versión (ej: animaciones de personaje complejas), indícalo y propone una alternativa más simple.