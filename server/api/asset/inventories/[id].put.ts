import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'
import { buildInventoryWhere } from '../../../utils/inventory'

/// 更新盘点单：基本信息 / 完成 / 重新开启
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') as string
  const b = await readBody(event)
  const { action, name, remark, ownerId, endDate } = b || {}

  // 数据范围校验：盘点单必须落在当前用户可见范围内
  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) return fail('盘点单不存在或无权操作')

  const inv = await prisma.inventory.findUnique({ where: { id } })
  if (!inv) return fail('盘点单不存在')

  if (action === 'finish') {
    requirePerm(user, 'asset:inventory:finish')
    if (inv.status === 'DONE') return fail('该盘点单已完成')
    const pending = await prisma.inventoryItem.count({ where: { inventoryId: id, checked: false } })
    if (pending) return fail(`还有 ${pending} 项未盘点，无法完成`)
    await prisma.inventory.update({
      where: { id },
      data: { status: 'DONE', endDate: endDate ? new Date(endDate) : new Date() },
    })
    await opLog(event, { module: 'asset', action: `完成盘点单 ${inv.code}` })
    return ok({ status: 'DONE' })
  }

  if (action === 'reopen') {
    requirePerm(user, 'asset:inventory:finish')
    if (inv.status !== 'DONE') return fail('该盘点单尚未完成')
    await prisma.inventory.update({ where: { id }, data: { status: 'DOING', endDate: null } })
    await opLog(event, { module: 'asset', action: `重新开启盘点单 ${inv.code}` })
    return ok({ status: 'DOING' })
  }

  // 常规信息更新
  requirePerm(user, 'asset:inventory:add')
  if (inv.status === 'DONE') return fail('已完成的盘点单不可修改')
  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true } })
    : null
  await prisma.inventory.update({
    where: { id },
    data: {
      name: name ?? inv.name,
      remark: remark ?? inv.remark,
      ownerId: owner ? owner.id : inv.ownerId,
      ownerName: owner ? owner.name : inv.ownerName,
    },
  })
  await opLog(event, { module: 'asset', action: `编辑盘点单 ${inv.code}` })
  return ok({ id })
})
