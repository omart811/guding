import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:org', 'system:user:add')
  const list = await prisma.org.findMany({ orderBy: { code: 'asc' } })
  const build = (parentId: string | null): any[] =>
    list
      .filter((o) => (o.parentId ?? null) === parentId)
      .map((o) => ({ ...o, children: build(o.id) }))
  return ok(build(null))
})
