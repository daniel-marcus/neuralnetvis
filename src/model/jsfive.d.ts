declare module "jsfive" {
  class File {
    constructor(buffer: ArrayBuffer)
    get(path: string): { value: number[] }
  }
}
