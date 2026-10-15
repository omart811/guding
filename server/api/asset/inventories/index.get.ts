import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'
import { buildInventoryWhere, inventoryInclude, summarize } from '../../../utils/inventory'

/// 盘点单列表（按数据范围过滤，含盘点进度统计）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory')
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const size = Number(q.size) || 20
  const where = buildInventoryWhere(user, q)

  const [list, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      include: inventoryInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.inventory.count({ where }),
  ])

  const orgIds = [...new Set(list.map((i) => i.orgId).filter(Boolean))] as string[]
  const orgs = await prisma.org.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
  const om = new Map(orgs.map((o) => [o.id, o.name]))

  return ok({
    list: list.map(({ items, ...rest }) => ({
      ...rest,
      orgName: rest.orgId ? om.get(rest.orgId) || '-' : '全公司',
      ...summarize(items),
    })),
    total,
  })
})
