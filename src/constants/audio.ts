// =====================================================
// Catálogo central de efectos de sonido de Rockomix
// =====================================================

export const AUDIO = {
  FXS: {
    KIKERADIO: "/sounds/fxs/kikekaraoke-envivo.mp3",
  },

  PLAYER: {
    BUZZ: "/sounds/player/buzz.mp3",
  },
} as const;

// CATÁLOGO CENTRAL DE EFECTOS DE SONIDO
export const SOUND_BY_ID = {
  "001": AUDIO.FXS.KIKERADIO,
  // "002": AUDIO.FXS.APLAUSOS,
  // "003": AUDIO.FXS.REDOBLE,
} as const;

// SOUNDPAD DINÁMICO: las asignaciones de PAD no pertenecen a este catálogo
// estático. Se almacenan como datos operativos editables en el Durable Object
// global "__soundpad-general__", bajo la clave "soundPadGeneral". HOST las
// carga anticipadamente y las conserva en memoria; no deben convertirse en
// constantes fijas del proyecto.
