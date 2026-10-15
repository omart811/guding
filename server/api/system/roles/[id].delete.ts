import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role:del')
  const id = getRouterParam(event, 'id')!
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) return fail('角色不存在')
  if (role.code === 'SUPER_ADMIN') return fail('内置角色不可删除')
  const inUse = await prisma.userRole.count({ where: { roleId: id } })
  if (inUse > 0) return fail('该角色已分配用户，无法删除')
  await prisma.role.delete({ where: { id } })
  await opLog(event, { module: 'system', action: '删除角色' })
  return ok()
})
