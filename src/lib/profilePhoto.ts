export const emptyProfilePhotos: Record<string, string> = {}

export async function prepareProfilePhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) { bitmap.close(); throw new Error('Could not prepare this profile photo.') }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare this profile photo.')), 'image/webp', 0.82))
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this profile photo.'))
    reader.onerror = () => reject(new Error('Could not read this profile photo.'))
    reader.readAsDataURL(blob)
  })
}
