import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'
import { buildAssetWhere } from '../../../utils/asset'

/// 台账概览：数量、状态分布、原值/净值合计（受数据范围限制）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger')
  const where = await buildAssetWhere(user, {})
  const [total, inUse, inStock, repair, scrapped, agg] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.count({ where: { ...where, status: 'IN_USE' } }),
    prisma.asset.count({ where: { ...where, status: 'IN_STOCK' } }),
    prisma.asset.count({ where: { ...where, status: 'REPAIR' } }),
    prisma.asset.count({ where: { ...where, status: 'SCRAPPED' } }),
    prisma.asset.aggregate({ where, _sum: { originalValue: true, netValue: true, accumulated: true } }),
  ])
  return ok({
    total,
    inUse,
    inStock,
    repair,
    scrapped,
    originalValue: agg._sum.originalValue || 0,
    netValue: agg._sum.netValue || 0,
    accumulated: agg._sum.accumulated || 0,
  })
})
