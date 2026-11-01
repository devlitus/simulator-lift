// Tipos transversales compartidos entre vistas y main (sin lógica).

// Interacción contextual que una vista ofrece al jugador cercano.
// action null = solo se muestra la etiqueta (p. ej. "sin semillas").
// key: tecla que la dispara (por defecto E; el pozo usa P).
export interface Interaction {
  dist: number;
  label: string;
  action: (() => void) | null;
  key?: 'e' | 'p';
}

// Botón de un diálogo/modal de la UI.
export interface DialogButton {
  label: string;
  handler: () => void;
  disabled?: boolean;
}
