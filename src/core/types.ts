// Tipos transversales compartidos entre vistas y main (sin lógica).

// Interacción contextual que una vista ofrece al jugador cercano.
// action null = solo se muestra la etiqueta (p. ej. "sin semillas").
// key: tecla que la dispara (por defecto E; el pozo usa P y las puertas, Intro).
export interface Interaction {
  dist: number;
  label: string;
  action: (() => void) | null;
  key?: 'e' | 'p' | 'enter';
}

// Botón de un diálogo/modal de la UI.
export interface DialogButton {
  label: string;
  handler: () => void;
  disabled?: boolean;
}
