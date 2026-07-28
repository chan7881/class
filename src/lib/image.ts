/** 교사·학생이 올리는 이미지를 서버에 보내기 전에 브라우저에서 줄인다 (docs/PLAN.md 5번 항목). */

export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024 // 10MB
export const MAX_RESIZED_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

export class ImageTooLargeError extends Error {}

export async function resizeImage(file: Blob, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 생성할 수 없습니다')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지 변환에 실패했습니다'))), 'image/jpeg', quality)
  })
}

/** 원본이 너무 크면 거부하고, 리사이즈한 뒤에도 크면 거부한다. */
export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new ImageTooLargeError('이미지 용량이 너무 큽니다 (10MB 이하만 업로드할 수 있어요).')
  }
  const resized = await resizeImage(file)
  if (resized.size > MAX_RESIZED_BYTES) {
    throw new ImageTooLargeError('줄여도 용량이 너무 큽니다. 더 작은 이미지를 써주세요.')
  }
  return resized
}
