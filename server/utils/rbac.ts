import { createError } from 'h3'
import type { H3Event } from 'h3'
import { getMe } from './user'

/// 从事件上下文取当前用户（带缓存）
export async function requireUser(event: H3Event) {
  if ((event.context as any)._me) return (event.context as any)._me
  const id = (event.context as any).user?.id
  if (!id) throw createError({ statusCode: 401, message: '未登录' })
  const me = await getMe(id)
  if (!me || me.status !== 1) throw createError({ statusCode: 401, message: '用户不存在或已禁用' })
  ;(event.context as any)._me = me
  return me
}

/// any-of 权限校验：codes 命中其一即通过
export function requirePerm(user: any, ...codes: string[]) {
  if (user.isSuper) return
  if (!codes.some((c) => user.perms.includes(c))) {
    throw createError({ statusCode: 403, message: '没有权限' })
  }
}

/// 数据范围过滤条件
export function scopeWhere(user: any, fields: { org?: string; dept?: string; user?: string } = {}) {
  const f = { org: 'orgId', dept: 'deptId', user: 'id', ...fields }
  if (user.isSuper || user.scope === 'ALL') return {}
  if (user.scope === 'ORG') return { [f.org]: user.orgId ?? '__none__' }
  if (user.scope === 'DEPT') return { [f.dept]: user.deptId ?? '__none__' }
  return { [f.user]: user.id }
}
