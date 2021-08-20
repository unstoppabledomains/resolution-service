// No @types/path-that-svg
declare module 'path-that-svg' {
  export function pathThatSvg(image_data: string): Promise<string>;
}
