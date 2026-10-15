import { verifyJwt } from '../utils/auth'

/// 全局 API 鉴权中间件：/api/auth/* 与 非 API 路由放行
export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return
  const token = getCookie(event, 'fam_token')
  if (!token) throw createError({ statusCode: 401, message: '未登录' })
  const payload = await verifyJwt(token)
  if (!payload) throw createError({ statusCode: 401, message: '登录已过期' })
  event.context.user = { id: payload.sub as string, username: payload.username as string }
})
