// =====================================================
// Catálogo central de efectos de sonido de Rockomix
// =====================================================

import { SOUND_BY_ID } from "~/shared/sound-inventory-rules.mjs";

export const AUDIO = {
  FXS: {
    KIKERADIO: SOUND_BY_ID["001"],
  },

  PLAYER: {
    BUZZ: "/sounds/player/buzz.mp3",
  },
} as const;

// CATÁLOGO CENTRAL DE EFECTOS DE SONIDO
export { SOUND_BY_ID };

// SOUNDPAD DINÁMICO: las asignaciones de PAD no pertenecen a este catálogo
// estático. Se almacenan como datos operativos editables en el Durable Object
// global "__soundpad-general__", bajo la clave "soundPadGeneral". HOST las
// carga anticipadamente y las conserva en memoria; no deben convertirse en
// constantes fijas del proyecto.
