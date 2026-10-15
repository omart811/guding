import { prisma } from '../../../../utils/prisma'
import { requireUser, requirePerm } from '../../../../utils/rbac'
import { ok, fail } from '../../../../utils/resp'
import { opLog } from '../../../../utils/log'
import { buildInventoryWhere, INV_RESULT } from '../../../../utils/inventory'

/// 录入盘点结果：支持逐条（items）或批量同结果（itemIds + result）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory:check')
  const id = getRouterParam(event, 'id') as string
  const b = await readBody(event)
  const { items, itemIds, result, remark } = b || {}

  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) return fail('盘点单不存在或无权操作')

  const inv = await prisma.inventory.findUnique({ where: { id }, select: { code: true, status: true } })
  if (!inv) return fail('盘点单不存在')
  if (inv.status === 'DONE') return fail('盘点单已完成，不可再录入')

  // 归一化待更新项
  const payload: { id: string; result: string; remark?: string }[] = []
  if (Array.isArray(items) && items.length) {
    for (const it of items) {
      if (!it?.id) return fail('明细 id 不能为空')
      if (!INV_RESULT[it.result]) return fail(`不支持的盘点结果：${it.result}`)
      payload.push({ id: it.id, result: it.result, remark: it.remark })
    }
  } else if (Array.isArray(itemIds) && itemIds.length) {
    if (!INV_RESULT[result]) return fail(`不支持的盘点结果：${result}`)
    payload.push(...itemIds.map((iid: string) => ({ id: iid, result, remark })))
  } else {
    return fail('请选择要录入的明细')
  }

  // 明细必须属于本盘点单
  const owned = await prisma.inventoryItem.findMany({
    where: { id: { in: payload.map((p) => p.id) }, inventoryId: id },
    select: { id: true },
  })
  if (owned.length !== payload.length) return fail('存在不属于该盘点单的明细')
  const ownedIds = new Set(owned.map((o) => o.id))

  const now = new Date()
  const ops = payload
    .filter((p) => ownedIds.has(p.id))
    .map((p) =>
      prisma.inventoryItem.update({
        where: { id: p.id },
        data: {
          result: p.result,
          checked: p.result !== 'PENDING',
          checkedAt: p.result === 'PENDING' ? null : now,
          checkerId: p.result === 'PENDING' ? null : user.id,
          checkerName: p.result === 'PENDING' ? null : user.name,
          remark: p.remark ?? null,
        },
      }),
    )
  await prisma.$transaction(ops)

  await opLog(event, { module: 'asset', action: `录入盘点结果 ${inv.code}（${ops.length} 项）` })
  return ok({ count: ops.length })
})
