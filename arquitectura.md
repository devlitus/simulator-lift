Actúa como un arquitecto de software senior especializado en aplicaciones JavaScript/TypeScript de larga duración y videojuegos web con Babylon.js.

CONTEXTO
Estoy construyendo un simulador de vida tipo pueblo en 3D con Babylon.js (granja + relaciones con NPCs + misiones). El proyecto crecerá con el tiempo: más sistemas, más contenido, posiblemente varios colaboradores. Necesito que la base de código esté diseñada para mantenimiento a largo plazo, no solo para funcionar en la primera versión.

OBJETIVO
Define y aplica una arquitectura de software sólida para este proyecto, priorizando mantenibilidad, escalabilidad y facilidad de testing por encima de la velocidad de entrega inmediata.

REQUISITOS DE ARQUITECTURA

1. ESTRUCTURA DE CARPETAS
   - Propón una estructura de carpetas clara y escalable (ej: separación por dominio: /player, /crops, /npcs, /quests, /economy, /world, /ui, /core, /assets).
   - Explica el criterio detrás de la organización elegida (por dominio vs por tipo de archivo) y por qué es mejor para este proyecto.

2. SEPARACIÓN DE RESPONSABILIDADES
   - Separa claramente: lógica de juego (game logic), renderizado (Babylon.js), estado (state management) y UI.
   - La lógica de negocio (ej: reglas de crecimiento de cultivos, cálculo de relación con NPCs) NO debe depender directamente de clases de Babylon.js — debe poder testearse sin necesidad de renderizar una escena.
   - Usa un patrón de gestión de estado explícito (ej: store centralizado, sistema de eventos/pub-sub, o ECS — Entity Component System) e indica cuál eliges y por qué encaja mejor con un juego de este tipo.

3. PATRONES DE DISEÑO
   - Identifica y aplica los patrones de diseño relevantes para este proyecto (ej: Factory para crear cultivos/NPCs, Observer para el sistema de eventos, State para las fases de crecimiento o el estado de una misión, Singleton solo donde esté justificado).
   - Evita sobre-ingeniería: no apliques un patrón si añade complejidad sin beneficio claro. Justifica cada patrón que uses.

4. CALIDAD Y CONSISTENCIA DE CÓDIGO
   - Define convenciones de nombres, formato y estilo (indica si usarás TypeScript, ESLint y Prettier, y con qué configuración base).
   - Usa tipado estricto si eliges TypeScript, especialmente en las interfaces entre sistemas (ej: forma de un objeto Cultivo, NPC, Misión).
   - Evita "magic numbers" y strings sueltos: centraliza constantes y configuración de balance de juego (precios, tiempos de crecimiento, etc.) en archivos de configuración separados de la lógica.

5. TESTING
   - Propón una estrategia de testing: qué se testea con pruebas unitarias (lógica de negocio pura) y qué se verifica manualmente o con pruebas de integración (interacción con Babylon.js).
   - Indica qué framework de testing usarías y por qué.

6. DOCUMENTACIÓN Y MANTENIBILIDAD
   - Cada módulo debe incluir un comentario de cabecera explicando su responsabilidad.
   - Genera un README con: cómo levantar el proyecto localmente, estructura de carpetas, y cómo añadir un nuevo sistema (ej: "cómo añadir un nuevo tipo de cultivo") como guía para futuros colaboradores.

7. ESCALABILIDAD
   - El diseño debe permitir añadir nuevo contenido (más cultivos, NPCs, misiones) sin modificar el código base — mediante archivos de datos/configuración (JSON o similares) en vez de hardcodear cada elemento en el código.
   - Explica cómo el diseño facilita esto con un ejemplo concreto (ej: cómo se añadiría un nuevo cultivo solo editando un archivo de datos).

ENTREGABLES
1. Diagrama o esquema en texto de la arquitectura general (módulos y cómo se comunican entre sí).
2. Estructura de carpetas propuesta con una breve descripción de cada una.
3. Ejemplo de código de al menos 2 módulos clave (ej: sistema de cultivos y sistema de misiones) que demuestren la separación de responsabilidades y los patrones elegidos.
4. Lista de decisiones de arquitectura tomadas, cada una con su justificación (formato tipo ADR — Architecture Decision Record: decisión, contexto, alternativas consideradas, consecuencias).

RESTRICCIONES
- No sacrifiques claridad por "elegancia" innecesaria: si una solución simple es suficiente, prefiérela sobre un patrón complejo.
- Si alguna recomendación de arquitectura entra en conflicto con la simplicidad necesaria para una primera versión jugable, indícalo explícitamente y propone cómo migrar de la versión simple a la robusta más adelante.