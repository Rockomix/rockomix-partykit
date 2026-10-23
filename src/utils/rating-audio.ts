import type { RatingScore } from "~/utils/rating";

export const RATING_SPIN_SOUND =
  "/sounds/fx_califica/ding_ding_ding_mezcla.mp3";

const RATING_REVEAL_SOUNDS: Record<RatingScore, readonly string[]> = {
  6: [
    "/sounds/fx_califica/6_dun_dun_dun.mp3",
    "/sounds/fx_califica/6_grillos.mp3",
  ],
  7: [
    "/sounds/fx_califica/7_aww.mp3",
    "/sounds/fx_califica/7_sad_music.mp3",
    "/sounds/fx_califica/7_titanic_flauta.mp3",
  ],
  8: [
    "/sounds/fx_califica/8_chiquillos.mp3",
    "/sounds/fx_califica/8_risa_kid.mp3",
  ],
  9: [
    "/sounds/fx_califica/9_ultrainstinto.mp3",
    "/sounds/fx_califica/9_wow.mp3",
  ],
  10: ["/sounds/fx_califica/10_aplusos.mp3"],
};

export function getRatingRevealSound(score: RatingScore): string {
  const sounds = RATING_REVEAL_SOUNDS[score];
  return sounds[Math.floor(Math.random() * sounds.length)] ?? sounds[0]!;
}
