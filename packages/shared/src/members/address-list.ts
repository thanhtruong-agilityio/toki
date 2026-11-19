// The addresses typed into the invite field (TOKI-024 R35): split at commas and
// line breaks, trimmed, in lower case, each once. Whether a piece is a valid
// address is decided by the server (parseEmail), not here.
export function parseAddressList(text: string): string[] {
  const seen = new Set<string>();
  for (const piece of text.split(/[,\r\n]/)) {
    const address = piece.trim().toLowerCase();
    if (address.length > 0) seen.add(address);
  }
  return [...seen];
}
