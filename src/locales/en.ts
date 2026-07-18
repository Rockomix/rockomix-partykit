export const en = {
  common: {},
  host: {},
  cohost: {},
  guest: {},
  settings: {},
  errors: {},
  notifications: {},
  terms: {},
  landing: {
    termsOfService: "Terms of Service",
    logoAlt: "My Karaoke Party logo",
    brandSuffix: "by Kikekaraoke",
    promoTitle: "Want to make your own karaoke?",
    promoBody: "Now you can with MyKaraoke Video. It takes 2 minutes!",
    promoCta: "Try it now!",
    partyNamePlaceholder: "My Awesome Party...",
    creating: "Creating...",
    startParty: "Start Party 🎉",
  },
  join: {
    title: "Join a Party!",
    description: "Join a party by entering the party code and your name.",
    partyCodeLabel: "Code",
    partyCodePlaceholder: "Enter the party code...",
    nameLabel: "Name",
    namePlaceholder: "Enter your name...",
    joining: "Joining...",
    submit: "Join Party 🎉",
  },
  player: {
    embedBlocked:
      "This video cannot be embedded. Click the button to open a new tab in YouTube.",
    playInYouTube: "Play in YouTube",
    skip: "Skip",
    loading: "Loading...",
    errors: {
      invalidVideoId: "Invalid video ID",
      html5: "HTML5 player error",
      notFound: "Video not found",
      embeddingDisabled: "Embedding disabled",
      unknown: "Unknown YouTube error code",
    },
  },
  search: {
    placeholder: "Enter artist and/or song name...",
    search: "Search",
    errorTitle: "Error!",
    errorBody:
      "There was an unexpected error while searching for karaoke videos. Try again later.",
    emptyTitle: "Nothing found!",
    emptyBody: "No karaoke videos found for {{query}}",
    add: "Add",
    loading: "Loading results...",
  },
  party: {
    playlistEmpty: "Playlist is empty",
    hornSent: "Someone sent a horn!",
  },
} as const;

export type LocaleMessages = typeof en;
