import type { EmscriptenModule, PresetInfo } from './types'

type WasmFn = (...args: any[]) => any

export class WasmBridge {
  private mod: EmscriptenModule
  private fns: Record<string, WasmFn> = {}
  private uploadPtr = 0
  private uploadSize = 0

  constructor(mod: EmscriptenModule) {
    this.mod = mod
    this.bindFunctions()
  }

  private wrap(name: string, ret: string, args: string[]): WasmFn {
    const fn = this.mod.cwrap(name, ret, args)
    this.fns[name] = fn
    return fn
  }

  private bindFunctions() {
    this.wrap('mbz_init', 'number', [])
    this.wrap('mbz_version', 'number', [])
    this.wrap('mbz_load_preset', 'number', ['string'])
    this.wrap('mbz_get_pass_count', 'number', [])
    this.wrap('mbz_get_lut_count', 'number', [])
    this.wrap('mbz_get_parameter_count', 'number', [])
    this.wrap('mbz_get_pass_source_path', 'string', ['number'])
    this.wrap('mbz_get_lut_id', 'string', ['number'])
    this.wrap('mbz_get_lut_path', 'string', ['number'])
    this.wrap('mbz_get_parameter_id', 'string', ['number'])
    this.wrap('mbz_get_parameter_value', 'number', ['number'])
    this.wrap('mbz_get_feedback_pass', 'number', [])
    this.wrap('mbz_destroy', 'void', [])

    this.wrap('mbz_compile_shader', 'number', ['string', 'number'])
    this.wrap('mbz_get_compiled_vertex', 'string', [])
    this.wrap('mbz_get_compiled_fragment', 'string', [])
    this.wrap('mbz_get_compile_error', 'string', [])

    this.wrap('mbz_renderer_init_gl', 'number', ['string'])
    this.wrap('mbz_renderer_create', 'number', ['string'])
    this.wrap('mbz_renderer_upload_frame', 'number', ['number', 'number', 'number'])
    this.wrap('mbz_renderer_render', 'void', ['number', 'number'])
    this.wrap('mbz_renderer_set_frame_count', 'void', ['number'])
    this.wrap('mbz_renderer_destroy', 'void', [])
  }

  private call(name: string, ...args: any[]): any {
    return this.fns[name](...args)
  }

  get fs() { return this.mod.FS }

  init(): boolean {
    return this.call('mbz_init') === 1
  }

  version(): number {
    return this.call('mbz_version')
  }

  loadPreset(memfsPath: string): boolean {
    return this.call('mbz_load_preset', memfsPath) === 1
  }

  getPresetInfo(): PresetInfo {
    const passes = this.call('mbz_get_pass_count') as number
    const luts = this.call('mbz_get_lut_count') as number
    const parameters = this.call('mbz_get_parameter_count') as number
    const feedbackPass = this.call('mbz_get_feedback_pass') as number

    const passPaths: string[] = []
    for (let i = 0; i < passes; i++)
      passPaths.push(this.call('mbz_get_pass_source_path', i))

    const lutIds: string[] = []
    const lutPaths: string[] = []
    for (let i = 0; i < luts; i++) {
      lutIds.push(this.call('mbz_get_lut_id', i))
      lutPaths.push(this.call('mbz_get_lut_path', i))
    }

    return { passes, luts, parameters, feedbackPass, passPaths, lutIds, lutPaths }
  }

  compileShader(memfsPath: string, glslVersion = 300): boolean {
    return this.call('mbz_compile_shader', memfsPath, glslVersion) === 1
  }

  getCompiledVertex(): string {
    return this.call('mbz_get_compiled_vertex')
  }

  getCompiledFragment(): string {
    return this.call('mbz_get_compiled_fragment')
  }

  getCompileError(): string {
    return this.call('mbz_get_compile_error')
  }

  rendererInitGL(selector: string): boolean {
    return this.call('mbz_renderer_init_gl', selector) === 1
  }

  rendererCreate(memfsPresetPath: string): boolean {
    return this.call('mbz_renderer_create', memfsPresetPath) === 1
  }

  rendererUploadFrame(rgba: Uint8Array, width: number, height: number): boolean {
    const size = rgba.byteLength
    if (size > this.uploadSize) {
      if (this.uploadPtr) this.mod._free(this.uploadPtr)
      this.uploadPtr = this.mod._malloc(size)
      this.uploadSize = size
    }
    this.mod.HEAPU8.set(rgba, this.uploadPtr)
    return this.call('mbz_renderer_upload_frame', this.uploadPtr, width, height) === 1
  }

  rendererRender(viewportWidth: number, viewportHeight: number) {
    this.call('mbz_renderer_render', viewportWidth, viewportHeight)
  }

  rendererSetFrameCount(count: number) {
    this.call('mbz_renderer_set_frame_count', count)
  }

  rendererDestroy() {
    this.call('mbz_renderer_destroy')
  }

  destroy() {
    if (this.uploadPtr) {
      this.mod._free(this.uploadPtr)
      this.uploadPtr = 0
      this.uploadSize = 0
    }
    this.call('mbz_destroy')
  }
}
