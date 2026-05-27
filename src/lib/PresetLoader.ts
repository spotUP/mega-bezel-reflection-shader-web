import type { WasmBridge } from './WasmBridge'
import type { PresetInfo } from './types'

export class PresetLoader {
  private bridge: WasmBridge
  private baseUrl: string

  constructor(bridge: WasmBridge, baseUrl: string) {
    this.bridge = bridge
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async load(presetUrl: string): Promise<PresetInfo> {
    const presetText = await this.fetchText(presetUrl)
    const presetDir = presetUrl.substring(0, presetUrl.lastIndexOf('/'))
    const memfsPresetPath = '/preset/current.slangp'

    this.ensureDir('/preset')
    this.bridge.fs.writeFile(memfsPresetPath, presetText)

    if (!this.bridge.loadPreset(memfsPresetPath))
      throw new Error(`Failed to parse preset: ${presetUrl}`)

    const info = this.bridge.getPresetInfo()

    await Promise.all([
      this.loadShaderFiles(info, presetDir),
      this.loadLutFiles(info, presetDir),
    ])

    return info
  }

  private async loadShaderFiles(info: PresetInfo, presetDir: string) {
    const seen = new Set<string>()
    const fetches: Promise<void>[] = []

    for (const relPath of info.passPaths) {
      const absMemfs = this.resolveMemfsPath('/preset', relPath)
      if (seen.has(absMemfs)) continue
      seen.add(absMemfs)

      const url = this.resolveUrl(presetDir, relPath)
      fetches.push(this.fetchAndWrite(url, absMemfs))
    }

    await Promise.all(fetches)
  }

  private async loadLutFiles(info: PresetInfo, presetDir: string) {
    const fetches: Promise<void>[] = []

    for (let i = 0; i < info.luts; i++) {
      const relPath = info.lutPaths[i]
      const absMemfs = this.resolveMemfsPath('/preset', relPath)
      const url = this.resolveUrl(presetDir, relPath)
      fetches.push(this.fetchAndWriteImage(url, absMemfs))
    }

    await Promise.all(fetches)
  }

  private async fetchText(url: string): Promise<string> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`)
    return resp.text()
  }

  private async fetchAndWrite(url: string, memfsPath: string) {
    const text = await this.fetchText(url)
    this.ensureDirForFile(memfsPath)
    this.bridge.fs.writeFile(memfsPath, text)
  }

  private async fetchAndWriteImage(url: string, memfsPath: string) {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Failed to fetch image ${url}: ${resp.status}`)
    const blob = await resp.blob()
    const bitmap = await createImageBitmap(blob)

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)

    const header = new Uint32Array([bitmap.width, bitmap.height])
    const headerBytes = new Uint8Array(header.buffer)
    const rawData = new Uint8Array(headerBytes.byteLength + imageData.data.byteLength)
    rawData.set(headerBytes, 0)
    rawData.set(imageData.data, headerBytes.byteLength)

    this.ensureDirForFile(memfsPath + '.raw')
    this.bridge.fs.writeFile(memfsPath + '.raw', rawData)
    bitmap.close()
  }

  private resolveUrl(presetDir: string, relPath: string): string {
    const parts = [...presetDir.split('/'), ...relPath.split('/')]
    const resolved: string[] = []
    for (const p of parts) {
      if (p === '..') resolved.pop()
      else if (p !== '.' && p !== '') resolved.push(p)
    }
    return resolved.join('/')
  }

  private resolveMemfsPath(base: string, relPath: string): string {
    const parts = [...base.split('/').filter(Boolean), ...relPath.split('/')]
    const resolved: string[] = []
    for (const p of parts) {
      if (p === '..') resolved.pop()
      else if (p !== '.' && p !== '') resolved.push(p)
    }
    return '/' + resolved.join('/')
  }

  private ensureDir(path: string) {
    const parts = path.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current += '/' + part
      try { this.bridge.fs.stat(current) }
      catch { this.bridge.fs.mkdir(current) }
    }
  }

  private ensureDirForFile(path: string) {
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir) this.ensureDir(dir)
  }
}
