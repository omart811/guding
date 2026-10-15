import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'
import { assetInclude, buildAssetWhere } from '../../../utils/asset'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger')
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const size = Number(q.size) || 20
  const where = await buildAssetWhere(user, q)
  const [list, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: assetInclude,
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.asset.count({ where }),
  ])
  return ok({ list, total })
})
