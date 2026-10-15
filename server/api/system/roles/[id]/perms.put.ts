import { prisma } from '../../../../utils/prisma'
import { requireUser, requirePerm } from '../../../../utils/rbac'
import { ok, fail } from '../../../../utils/resp'
import { opLog } from '../../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role:edit')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const permIds: string[] = body?.permIds || []
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) return fail('角色不存在')
  if (role.code === 'SUPER_ADMIN' && !user.isSuper) return fail('内置角色不可修改')
  await prisma.$transaction([
    prisma.rolePerm.deleteMany({ where: { roleId: id } }),
    prisma.rolePerm.createMany({ data: permIds.map((permId) => ({ roleId: id, permId })) }),
  ])
  await opLog(event, { module: 'system', action: '分配权限' })
  return ok()
})
