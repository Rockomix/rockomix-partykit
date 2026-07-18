export const esMX = {
  common: {},
  host: {},
  cohost: {},
  guest: {},
  settings: {},
  errors: {},
  notifications: {},
  terms: {},
  landing: {
    termsOfService: "T\u00e9rminos de servicio",
    logoAlt: "Logo de My Karaoke Party",
    brandSuffix: "by Kikekaraoke",
    promoTitle: "\u00bfQuieres crear tu propio karaoke?",
    promoBody: "Ahora puedes con MyKaraoke Video. \u00a1Solo toma 2 minutos!",
    promoCta: "\u00a1Pru\u00e9balo ahora!",
    partyNamePlaceholder: "Mi fiesta incre\u00edble...",
    creating: "Creando...",
    startParty: "Iniciar Fiesta \u{1f389}",
  },
  join: {
    title: "\u00a1\u00danete a una fiesta!",
    description:
      "\u00danete a una fiesta ingresando el c\u00f3digo de la fiesta y tu nombre.",
    partyCodeLabel: "C\u00f3digo",
    partyCodePlaceholder: "Ingresa el c\u00f3digo de la fiesta...",
    nameLabel: "Nombre",
    namePlaceholder: "Ingresa tu nombre...",
    joining: "Uni\u00e9ndome...",
    submit: "Unirse a la fiesta \u{1f389}",
  },
  player: {
    embedBlocked:
      "Este video no se puede insertar. Haz clic en el bot\u00f3n para abrir una nueva pesta\u00f1a en YouTube.",
    playInYouTube: "Reproducir en YouTube",
    skip: "Saltar",
    loading: "Cargando...",
    errors: {
      invalidVideoId: "ID de video no v\u00e1lido",
      html5: "Error del reproductor HTML5",
      notFound: "Video no encontrado",
      embeddingDisabled: "La inserci\u00f3n est\u00e1 deshabilitada",
      unknown: "C\u00f3digo de error de YouTube desconocido",
    },
  },
  search: {
    placeholder: "Ingresa el artista y/o nombre de la canci\u00f3n...",
    search: "Buscar",
    errorTitle: "\u00a1Error!",
    errorBody:
      "Ocurri\u00f3 un error inesperado al buscar videos de karaoke. Int\u00e9ntalo m\u00e1s tarde.",
    emptyTitle: "\u00a1No se encontr\u00f3 nada!",
    emptyBody: "No se encontraron videos de karaoke para {{query}}",
    add: "Agregar",
    loading: "Cargando resultados...",
  },
  party: {
    playlistEmpty: "La lista de reproducci\u00f3n est\u00e1 vac\u00eda",
    hornSent: "\u00a1Alguien toc\u00f3 una bocina!",
  },
} as const;

export type LocaleMessages = typeof esMX;
