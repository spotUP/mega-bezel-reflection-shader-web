import type { FrameSource } from './types'

export class FrameFeeder {
  private canvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D
  private width: number
  private height: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.canvas = new OffscreenCanvas(width, height)
    this.ctx = this.canvas.getContext('2d')!
  }

  extractRGBA(source: FrameSource): Uint8Array {
    const w = this.getSourceWidth(source)
    const h = this.getSourceHeight(source)

    if (w !== this.width || h !== this.height) {
      this.width = w
      this.height = h
      this.canvas = new OffscreenCanvas(w, h)
      this.ctx = this.canvas.getContext('2d')!
    }

    if (source instanceof ImageData) {
      return new Uint8Array(source.data.buffer)
    }

    this.ctx.drawImage(source as any, 0, 0)
    const imageData = this.ctx.getImageData(0, 0, this.width, this.height)
    return new Uint8Array(imageData.data.buffer)
  }

  getWidth(): number { return this.width }
  getHeight(): number { return this.height }

  private getSourceWidth(source: FrameSource): number {
    if (source instanceof ImageData) return source.width
    if (source instanceof HTMLVideoElement) return source.videoWidth || source.width
    if ('width' in source) return source.width
    return this.width
  }

  private getSourceHeight(source: FrameSource): number {
    if (source instanceof ImageData) return source.height
    if (source instanceof HTMLVideoElement) return source.videoHeight || source.height
    if ('height' in source) return source.height
    return this.height
  }
}
