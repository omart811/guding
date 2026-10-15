import { prisma } from '../../utils/prisma'
import { requireUser, requirePerm } from '../../utils/rbac'
import { ok } from '../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user:add', 'system:user:edit', 'system:org')
  const list = await prisma.dept.findMany({ orderBy: { id: 'asc' } })
  return ok(list)
})
