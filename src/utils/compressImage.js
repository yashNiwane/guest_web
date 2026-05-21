import imageCompression from 'browser-image-compression'

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) return file

  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1800,
    useWebWorker: true,
    initialQuality: 0.82,
  })
}
