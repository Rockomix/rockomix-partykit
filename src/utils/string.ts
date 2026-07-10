export function removeKaraokeInstrumentalWording(inputString: string) {
  // Regular expression to match and remove bracketed or square-bracketed words
  const regex = /\[(?:karaoke|instrumental)\]|\((?:karaoke|instrumental)\)/gi;

  // Replace matching words and brackets with an empty string
  return inputString.replace(regex, "");
}

export function removeBracketedContent(inputString: string) {
  // Regular expression to match and remove anything within [] or ()
  const regex = /\[[^\]]*\]|\([^)]*\)/g;

  // Replace matching content and brackets with an empty string
  return inputString.replace(regex, "");
}
