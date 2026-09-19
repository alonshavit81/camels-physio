/**
 * Browser-side file plumbing for backups, written around iOS Safari quirks:
 *
 * - Web Share with files opens the iOS share sheet straight into WhatsApp and
 *   is the only fully reliable path from a Home-Screen (standalone) web app.
 * - `<a download>` + Blob URL works in a Safari tab ("Do you want to download?"
 *   → Files › Downloads). The object URL must NOT be revoked right away: Safari
 *   resolves the download asynchronously, so we revoke a minute later.
 *   In a Home-Screen app the same anchor does NOT download: WebKit shows the
 *   file in a full-screen preview (Share → Save to Files is the way out), so
 *   the outcome is reported as 'standalone-preview' and the UI words it honestly.
 * - `window.open(blobUrl)` is the fallback for in-app browsers without download support.
 * - Last resort: a data: URI built with encodeURIComponent (UTF-8 safe, no btoa).
 *   It goes through the same download policy as the blob anchor, so it may also
 *   end in a preview; never report it as a completed download.
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'failed' | 'unsupported'
export type DownloadOutcome = 'downloaded' | 'opened' | 'standalone-preview' | 'data-uri'

const REVOKE_DELAY_MS = 60_000

/** True when running as a Home-Screen web app (iOS "standalone" or display-mode: standalone). */
export function isStandaloneDisplay(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean }
    return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

export function makeBackupBlob(json: string): Blob {
  return new Blob([json], { type: 'application/json;charset=utf-8' })
}

export function makeBackupFile(json: string, name: string): File {
  return new File([makeBackupBlob(json)], name, { type: 'application/json' })
}

/** Feature detection for the share sheet with a JSON file attached. */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false
    return navigator.canShare({ files: [makeBackupFile('{}', 'probe.json')] })
  } catch {
    return false
  }
}

/**
 * Must be called synchronously from a click handler (user activation).
 * navigator.share is invoked before the first await.
 *
 * Outcomes: 'cancelled' = the user dismissed the sheet; 'unsupported' = the
 * data was rejected (TypeError: no file support), so a download is the only
 * option; 'failed' = the sheet did not open for a transient reason
 * (NotAllowedError after a hung share, InvalidStateError, ...): sharing still
 * works, the user should simply tap Share again.
 */
export async function shareBackup(json: string, name: string): Promise<ShareOutcome> {
  let file: File
  try {
    file = makeBackupFile(json, name)
    if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] })) return 'unsupported'
  } catch {
    return 'unsupported'
  }
  try {
    // No title/text: WebKit adds the title as a separate text activity item ahead
    // of the file, which WhatsApp can send instead of the .json (WKShareSheet.mm;
    // Apple forums thread 665812). iOS names the attachment from File.name anyway.
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    if (err instanceof TypeError) return 'unsupported'
    return 'failed'
  }
}

function clickAnchor(href: string, name: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Synchronous download chain. Returns which path was taken so the UI can explain it. */
export function downloadBackup(json: string, name: string): DownloadOutcome {
  const standalone = isStandaloneDisplay()
  const supportsDownload = 'download' in HTMLAnchorElement.prototype
  if (supportsDownload) {
    const url = URL.createObjectURL(makeBackupBlob(json))
    clickAnchor(url, name)
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
    // A Home-Screen app has no download UI: iOS shows the file in a preview instead (see header).
    return standalone ? 'standalone-preview' : 'downloaded'
  }
  if (!standalone) {
    const url = URL.createObjectURL(makeBackupBlob(json))
    const win = window.open(url, '_blank')
    if (win) {
      window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
      return 'opened'
    }
    URL.revokeObjectURL(url)
  }
  clickAnchor(`data:application/json;charset=utf-8,${encodeURIComponent(json)}`, name)
  return 'data-uri'
}

/** file.text() with a FileReader fallback for older WebKit. Always decodes as UTF-8. */
export function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.readAsText(file, 'utf-8')
  })
}
