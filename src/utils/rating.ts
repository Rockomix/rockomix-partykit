export type RatingScore = 6 | 7 | 8 | 9 | 10;

const RATING_PHRASES: Record<RatingScore, readonly string[]> = {
  6: [
    "¡La intención estuvo en tono!",
    "¡El sentimiento estuvo; la afinación anda de vacaciones!",
    "¡Eso fue valiente y con mucho corazón!",
  ],
  7: [
    "¡Una más y te fichamos!",
    "¡Ya se empieza a escuchar el contrato!",
    "¡Eso va tomando forma de estrella!",
  ],
  8: [
    "¡Ya casi le quitas el puesto al original!",
    "¡Eso ya suena a edición de lujo!",
    "¡La estrella está calentando motores!",
  ],
  9: [
    "¡Eso ya son palabras mayores!",
    "¡El original acaba de ponerse nervioso!",
    "¡Aquí hay nivel para pedir bis!",
  ],
  10: [
    "¡Woooow! ¡Ya te está buscando Universal Music!",
    "¡Señoras y señores, tenemos estrella!",
    "¡Ese diez viene con ovación incluida!",
  ],
};

function randomUint32(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] ?? 0;
}

function randomBelow(limit: number): number {
  const range = 0x100000000;
  const threshold = range - (range % limit);
  let value = randomUint32();

  while (value >= threshold) {
    value = randomUint32();
  }

  return value % limit;
}

export function generateRatingScore(): RatingScore {
  const bucket = randomBelow(10_000);

  if (bucket < 500) return 6;
  if (bucket < 2_200) return 7;
  if (bucket < 4_000) return 8;
  if (bucket < 7_000) return 9;
  return 10;
}

export function chooseRatingPhrase(score: RatingScore): string {
  const phrases = RATING_PHRASES[score];
  return phrases[randomBelow(phrases.length)] ?? phrases[0]!;
}
