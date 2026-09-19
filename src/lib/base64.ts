/**
 * UTF-8 safe base64. Plain btoa(str) throws on any character outside Latin-1
 * (Hebrew, emoji), so we always go through bytes. Chunked to stay under the
 * argument-count limit of String.fromCharCode.apply on large backups.
 */
const CHUNK = 0x8000

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}
