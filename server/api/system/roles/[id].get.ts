import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role:edit', 'system:role:add')
  const id = getRouterParam(event, 'id')!
  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) return fail('角色不存在')
  const permIds = (await prisma.rolePerm.findMany({ where: { roleId: id }, select: { permId: true } })).map(
    (x) => x.permId,
  )
  return ok({ ...role, permIds })
})
