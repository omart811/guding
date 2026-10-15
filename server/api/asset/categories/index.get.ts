import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:category', 'asset:ledger')
  const list = await prisma.assetCategory.findMany({ orderBy: { code: 'asc' } })
  const build = (parentId: string | null): any[] =>
    list
      .filter((c) => (c.parentId ?? null) === parentId)
      .map((c) => ({ ...c, children: build(c.id) }))
  return ok(build(null))
})
