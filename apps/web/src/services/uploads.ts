import { api } from './api'

export interface UploadedImage {
  /** 可直接用于 <img src> 的站内地址 */
  url: string
  size: number
}

/** 图片上传：落盘到服务器，组件只保存返回的地址，画布 JSON 不会被 base64 撑大 */
export async function uploadImage(file: File | Blob, fileName?: string): Promise<UploadedImage> {
  const form = new FormData()
  const name = fileName ?? (file instanceof File ? file.name : 'image.png')
  form.append('file', file, name)
  return api<UploadedImage>('/uploads', { method: 'POST', body: form })
}
