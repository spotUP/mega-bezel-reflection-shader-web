export interface MegaBezelOptions {
  canvas: HTMLCanvasElement
  wasmUrl?: string
}

export interface PresetInfo {
  passes: number
  luts: number
  parameters: number
  feedbackPass: number
  passPaths: string[]
  lutIds: string[]
  lutPaths: string[]
}

export type FrameSource =
  | HTMLCanvasElement
  | HTMLVideoElement
  | HTMLImageElement
  | ImageBitmap
  | OffscreenCanvas
  | ImageData

export interface EmscriptenModule {
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: any[]) => any
  ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any
  HEAPU8: Uint8Array
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void
    readFile: (path: string) => Uint8Array
    mkdir: (path: string) => void
    stat: (path: string) => any
    unlink: (path: string) => void
  }
  _malloc: (size: number) => number
  _free: (ptr: number) => void
}
