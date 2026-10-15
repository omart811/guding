import { createError } from 'h3'

export const ok = (data: any = null, msg = '操作成功') => ({ code: 0, data, msg })

/// 业务失败：抛出 400，前端统一 catch
export const fail = (msg: string) => {
  throw createError({ statusCode: 400, message: msg })
}
