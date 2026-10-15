import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'
import { FLOW_TYPE } from '../../../utils/asset'

/// 发起资产流转：领用 ISSUE / 归还 RETURN / 调拨 TRANSFER（支持批量）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const b = await readBody(event)
  const { type, assetIds = [], toOrgId, toDeptId, toKeeperId, flowDate, remark } = b || {}

  const permMap: Record<string, string> = {
    ISSUE: 'asset:flow:issue',
    RETURN: 'asset:flow:return',
    TRANSFER: 'asset:flow:transfer',
  }
  if (!permMap[type]) return fail('不支持的流转类型')
  requirePerm(user, permMap[type])
  if (!Array.isArray(assetIds) || !assetIds.length) return fail('请选择资产')

  const assets = await prisma.asset.findMany({ where: { id: { in: assetIds } } })
  if (assets.length !== assetIds.length) return fail('存在无效资产')
  const date = flowDate ? new Date(flowDate) : new Date()

  const ops: any[] = []
  for (const a of assets) {
    // 数据范围：非超管只能操作本组织资产
    if (!user.isSuper) {
      if (user.scope === 'ORG') {
        if (a.orgId !== user.orgId) return fail(`资产 ${a.assetNo} 不属于本组织`)
        if (toOrgId && toOrgId !== user.orgId) return fail('跨组织调拨需超级管理员操作')
      } else {
        return fail('无权限操作')
      }
    }

    const patch: any = {}
    if (type === 'ISSUE') {
      if (a.status !== 'IN_STOCK') return fail(`资产 ${a.assetNo} 不是「在库」状态，无法领用`)
      if (!toKeeperId && !toDeptId) return fail('领用需指定使用人或使用部门')
      patch.status = 'IN_USE'
      if (toDeptId) patch.deptId = toDeptId
      if (toKeeperId) patch.keeperId = toKeeperId
    } else if (type === 'RETURN') {
      if (a.status !== 'IN_USE') return fail(`资产 ${a.assetNo} 不是「在用」状态，无法归还`)
      patch.status = 'IN_STOCK'
      patch.keeperId = null
    } else {
      if (['SCRAPPED', 'DISPOSED'].includes(a.status)) return fail(`资产 ${a.assetNo} 已报废/处置，无法调拨`)
      if (!toOrgId && !toDeptId && !toKeeperId) return fail('请指定调拨目标')
      const changed =
        (toOrgId && toOrgId !== a.orgId) ||
        (toDeptId && toDeptId !== a.deptId) ||
        (toKeeperId && toKeeperId !== a.keeperId)
      if (!changed) return fail(`资产 ${a.assetNo} 的调拨目标与当前归属相同`)
      if (toOrgId && toOrgId !== a.orgId) {
        // 跨公司调拨：部门与使用人需重新指定，否则清空
        patch.orgId = toOrgId
        patch.deptId = toDeptId || null
        patch.keeperId = toKeeperId || null
      } else {
        if (toDeptId) patch.deptId = toDeptId
        if (toKeeperId) patch.keeperId = toKeeperId
      }
    }

    // 状态与使用人保持一致
    const nextKeeper = patch.keeperId === undefined ? a.keeperId : patch.keeperId
    const nextStatus = patch.status || a.status
    if (!nextKeeper && nextStatus === 'IN_USE') patch.status = 'IN_STOCK'
    if (nextKeeper && nextStatus === 'IN_STOCK') patch.status = 'IN_USE'

    const merged = {
      orgId: patch.orgId === undefined ? a.orgId : patch.orgId,
      deptId: patch.deptId === undefined ? a.deptId : patch.deptId,
      keeperId: patch.keeperId === undefined ? a.keeperId : patch.keeperId,
    }

    ops.push(
      prisma.asset.update({ where: { id: a.id }, data: patch }),
      prisma.assetFlow.create({
        data: {
          type,
          assetId: a.id,
          fromOrgId: a.orgId,
          fromDeptId: a.deptId,
          fromKeeperId: a.keeperId,
          toOrgId: merged.orgId,
          toDeptId: merged.deptId,
          toKeeperId: merged.keeperId,
          flowDate: date,
          operatorId: user.id,
          operatorName: user.name,
          remark,
        },
      }),
    )
  }

  await prisma.$transaction(ops)
  await opLog(event, { module: 'asset', action: `${FLOW_TYPE[type]}（${assets.length} 条）` })
  return ok({ count: assets.length })
})
