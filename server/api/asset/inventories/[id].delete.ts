import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'
import { buildInventoryWhere } from '../../../utils/inventory'

/// 删除盘点单（明细级联删除；已完成的不允许删除）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory:del')
  const id = getRouterParam(event, 'id') as string

  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) return fail('盘点单不存在或无权操作')

  const inv = await prisma.inventory.findUnique({ where: { id }, select: { code: true, status: true } })
  if (!inv) return fail('盘点单不存在')
  if (inv.status === 'DONE') return fail('已完成的盘点单不可删除')

  await prisma.inventory.delete({ where: { id } })
  await opLog(event, { module: 'asset', action: `删除盘点单 ${inv.code}` })
  return ok({ id })
})
