import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { buildInventoryWhere, summarize, resolveItemNames } from '../../../utils/inventory'

/// 盘点单详情：明细支持按盘点结果/关键字筛选
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory')
  const id = getRouterParam(event, 'id') as string
  const q = getQuery(event)

  // 数据范围校验：与录入/编辑/删除口径一致，避免越权查看他组织盘点单
  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) return fail('盘点单不存在或无权操作')

  const inv = await prisma.inventory.findUnique({ where: { id } })
  if (!inv) return fail('盘点单不存在')

  const itemWhere: any = { inventoryId: id }
  if (q.result) itemWhere.result = q.result
  if (q.checked === '1') itemWhere.checked = true
  if (q.checked === '0') itemWhere.checked = false
  const keyword = ((q.keyword as string) || '').trim()
  if (keyword) {
    itemWhere.OR = [{ assetNo: { contains: keyword } }, { assetName: { contains: keyword } }]
  }

  const [items, allItems] = await Promise.all([
    prisma.inventoryItem.findMany({ where: itemWhere, orderBy: { assetNo: 'asc' }, take: 2000 }),
    prisma.inventoryItem.findMany({
      where: { inventoryId: id },
      select: { result: true, checked: true },
    }),
  ])

  return ok({
    ...inv,
    stats: summarize(allItems),
    items: await resolveItemNames(items),
  })
})
