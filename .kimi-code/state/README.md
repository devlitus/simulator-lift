# Estado de tareas a medias

Memoria persistente de tareas (issues de GitHub) que se dejaron a medias entre sesiones. Un archivo por tarea: `issue-<N>.md`.

- **Guardar / actualizar**: skill `pausar` (`/skill:pausar`).
- **Consultar / reanudar**: skill `retomar` (`/skill:retomar`).
- Al abrir sesión, un hook `SessionStart` inyecta automáticamente el contenido de estos archivos en el contexto.

Solo hay tareas vivas: cuando una tarea se completa, su archivo se borra. Estos archivos se commitean a propósito (exentos del `.gitignore`); no escribas secretos en ellos.
