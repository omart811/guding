import { createError } from 'h3'

export const ok = (data: any = null, msg = '操作成功') => ({ code: 0, data, msg })

/// 业务失败：默认 400；鉴权类失败传 401（如未登录/登录过期）
export const fail = (msg: string, statusCode = 400) => {
  throw createError({ statusCode, message: msg })
}
