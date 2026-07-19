// Constantes técnicas del motor (no balance de juego: eso vive en data/).
export const CONFIG = {
  dayLengthSeconds: 150, // duración de un día completo en segundos reales
  groundSize: 64, // tamaño del terreno (cuadrado, en unidades)
  playerSpeed: 5.5, // velocidad de movimiento del jugador
  interactionRadius: 2.4, // distancia máxima para interactuar con NPCs / objetos
  tileRadius: 1.6, // distancia máxima para interactuar con un surco
} as const;
