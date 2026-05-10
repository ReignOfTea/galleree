export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      img
        .decode()
        .then(() => resolve())
        .catch(() => resolve())
    }
    img.onerror = () => reject(new Error(`Image failed to load: ${src}`))
    img.src = src
  })
}
