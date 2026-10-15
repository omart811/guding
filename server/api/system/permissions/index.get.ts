import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role:edit', 'system:role:add')
  const list = await prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { type: 'asc' }] })
  return ok(list)
})
