import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBackup, shareBackup } from './backupFile'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubShare(share: (data: ShareData) => Promise<void>) {
  const mock = vi.fn(share)
  vi.stubGlobal('navigator', { share: mock, canShare: () => true })
  return mock
}

describe('shareBackup', () => {
  it('shares the file alone: no title item that WhatsApp could post instead of the .json', async () => {
    const share = stubShare(() => Promise.resolve())
    await expect(shareBackup('{}', 'a.json')).resolves.toBe('shared')
    expect(share).toHaveBeenCalledTimes(1)
    const data = share.mock.calls[0]?.[0]
    expect(Object.keys(data ?? {})).toEqual(['files'])
    expect(data?.files?.map((f) => f.name)).toEqual(['a.json'])
  })

  it('maps AbortError (the user dismissed the sheet) to cancelled', async () => {
    stubShare(() => Promise.reject(new DOMException('dismissed', 'AbortError')))
    await expect(shareBackup('{}', 'a.json')).resolves.toBe('cancelled')
  })

  it('maps a TypeError (share data rejected) to unsupported', async () => {
    stubShare(() => Promise.reject(new TypeError('Type error')))
    await expect(shareBackup('{}', 'a.json')).resolves.toBe('unsupported')
  })

  it('maps NotAllowedError / InvalidStateError / unknown errors to failed (sharing still works, tap again)', async () => {
    for (const err of [new DOMException('', 'NotAllowedError'), new DOMException('', 'InvalidStateError'), new Error('boom'), 'nope']) {
      stubShare(() => Promise.reject(err))
      await expect(shareBackup('{}', 'a.json')).resolves.toBe('failed')
    }
  })

  it('is unsupported without navigator.share or when canShare refuses files', async () => {
    vi.stubGlobal('navigator', {})
    await expect(shareBackup('{}', 'a.json')).resolves.toBe('unsupported')
    vi.stubGlobal('navigator', { share: () => Promise.resolve(), canShare: () => false })
    await expect(shareBackup('{}', 'a.json')).resolves.toBe('unsupported')
  })
})

/** Minimal document/window/anchor doubles; records every href that was "clicked". */
function stubDownloadEnv(opts: { standalone: boolean; supportsDownload: boolean; openReturns?: object | null }) {
  const clicked: string[] = []
  vi.stubGlobal('navigator', { standalone: opts.standalone })
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 0,
    open: () => opts.openReturns ?? null,
  })
  vi.stubGlobal('HTMLAnchorElement', { prototype: opts.supportsDownload ? { download: '' } : {} })
  vi.stubGlobal('document', {
    createElement: () => {
      const a = {
        href: '',
        download: '',
        rel: '',
        style: {} as Record<string, string>,
        click() {
          clicked.push(this.href)
        },
        remove() {},
      }
      return a
    },
    body: { appendChild() {} },
  })
  return clicked
}

describe('downloadBackup', () => {
  it('uses a Blob <a download> in a browser tab and reports downloaded', () => {
    const clicked = stubDownloadEnv({ standalone: false, supportsDownload: true })
    expect(downloadBackup('{"a":1}', 'a.json')).toBe('downloaded')
    expect(clicked).toHaveLength(1)
    expect(clicked[0]).toMatch(/^blob:/)
  })

  it('in a Home-Screen app reports standalone-preview (never a completed download) and still uses a Blob, not a data: URI', () => {
    const clicked = stubDownloadEnv({ standalone: true, supportsDownload: true })
    expect(downloadBackup('{"a":1}', 'a.json')).toBe('standalone-preview')
    expect(clicked).toHaveLength(1)
    expect(clicked[0]).toMatch(/^blob:/)
  })

  it('falls back to a UTF-8 data: URI only when nothing else is available', () => {
    const clicked = stubDownloadEnv({ standalone: true, supportsDownload: false })
    expect(downloadBackup('{"שלום":1}', 'a.json')).toBe('data-uri')
    expect(clicked[0]).toMatch(/^data:application\/json;charset=utf-8,/)
    expect(decodeURIComponent(clicked[0]!.split(',')[1]!)).toBe('{"שלום":1}')
  })

  it('opens a tab when a browser tab has no download attribute support', () => {
    stubDownloadEnv({ standalone: false, supportsDownload: false, openReturns: {} })
    expect(downloadBackup('{}', 'a.json')).toBe('opened')
  })
})
