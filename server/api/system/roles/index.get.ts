import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role', 'system:user:add')
  const list = await prisma.role.findMany({ orderBy: { createdAt: 'asc' } })
  return ok({ list })
})
