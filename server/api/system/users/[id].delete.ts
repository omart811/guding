import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user:del')
  const id = getRouterParam(event, 'id')!
  if (id === user.id) return fail('不能删除当前登录用户')
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return fail('用户不存在')
  if (!user.isSuper) {
    if (target.username === 'admin') return fail('不能删除内置管理员')
    if (user.scope === 'ORG' && target.orgId !== user.orgId) return fail('只能删除本组织用户')
  }
  await prisma.user.delete({ where: { id } })
  await opLog(event, { module: 'system', action: '删除用户' })
  return ok()
})
