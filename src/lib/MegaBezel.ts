import type { MegaBezelOptions, FrameSource, PresetInfo, EmscriptenModule } from './types'
import { WasmBridge } from './WasmBridge'
import { PresetLoader } from './PresetLoader'
import { FrameFeeder } from './FrameFeeder'

declare function MegaBezelModule(opts?: Record<string, any>): Promise<EmscriptenModule>

export class MegaBezel {
  private canvas: HTMLCanvasElement
  private bridge: WasmBridge | null = null
  private loader: PresetLoader | null = null
  private feeder: FrameFeeder | null = null
  private presetInfo: PresetInfo | null = null
  private wasmUrl: string
  private ready = false

  constructor(options: MegaBezelOptions) {
    this.canvas = options.canvas
    this.wasmUrl = options.wasmUrl || '/dist/wasm/mega-bezel.wasm'
  }

  async init(): Promise<void> {
    const mod = await MegaBezelModule({
      canvas: this.canvas,
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) return this.wasmUrl
        return path
      },
    })

    this.bridge = new WasmBridge(mod)
    if (!this.bridge.init())
      throw new Error('Failed to initialize WASM bridge')

    if (!this.bridge.rendererInitGL('#' + this.canvas.id))
      throw new Error('Failed to initialize GL context')

    this.ready = true
  }

  async loadPreset(presetUrl: string, baseUrl?: string): Promise<PresetInfo> {
    if (!this.bridge) throw new Error('Not initialized')

    this.loader = new PresetLoader(this.bridge, baseUrl || '')
    this.presetInfo = await this.loader.load(presetUrl)

    if (!this.bridge.rendererCreate('/preset/current.slangp'))
      throw new Error('Failed to create renderer from preset')

    return this.presetInfo
  }

  renderFrame(source: FrameSource): void {
    if (!this.bridge) return

    if (!this.feeder) {
      const w = this.getSourceWidth(source)
      const h = this.getSourceHeight(source)
      this.feeder = new FrameFeeder(w, h)
    }

    const rgba = this.feeder.extractRGBA(source)
    const w = this.feeder.getWidth()
    const h = this.feeder.getHeight()

    this.bridge.rendererUploadFrame(rgba, w, h)
    this.bridge.rendererRender(this.canvas.width, this.canvas.height)
  }

  setParameter(name: string, value: number): boolean {
    if (!this.bridge) return false
    return this.bridge.rendererSetParameter(name, value)
  }

  getPresetInfo(): PresetInfo | null {
    return this.presetInfo
  }

  isReady(): boolean {
    return this.ready
  }

  destroy(): void {
    if (this.bridge) {
      this.bridge.rendererDestroy()
      this.bridge.destroy()
      this.bridge = null
    }
    this.ready = false
  }

  private getSourceWidth(source: FrameSource): number {
    if (source instanceof ImageData) return source.width
    if (source instanceof HTMLVideoElement) return source.videoWidth || source.width
    if ('width' in source) return source.width
    return 256
  }

  private getSourceHeight(source: FrameSource): number {
    if (source instanceof ImageData) return source.height
    if (source instanceof HTMLVideoElement) return source.videoHeight || source.height
    if ('height' in source) return source.height
    return 224
  }
}
