import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'
import { categoryWithChildren } from '../../../utils/asset'
import { genInventoryCode } from '../../../utils/inventory'

/// 新建盘点单：按范围把资产快照进明细
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory:add')
  const b = await readBody(event)
  const { name, orgId, deptId, categoryId, startDate, ownerId, remark } = b || {}
  if (!name) return fail('请填写盘点名称')

  // 数据范围：非超管只能盘点自己管辖范围内的资产
  let finalOrgId: string | null = orgId || null
  let finalDeptId: string | null = deptId || null
  if (!user.isSuper) {
    if (user.scope === 'ORG') {
      if (orgId && orgId !== user.orgId) return fail('只能盘点本组织的资产')
      finalOrgId = user.orgId
    } else if (user.scope === 'DEPT') {
      finalOrgId = user.orgId
      finalDeptId = user.deptId
    } else {
      return fail('无权限操作')
    }
  }

  const assetWhere: any = {}
  if (finalOrgId) assetWhere.orgId = finalOrgId
  if (finalDeptId) assetWhere.deptId = finalDeptId
  if (categoryId) assetWhere.categoryId = { in: await categoryWithChildren(categoryId) }
  // 已报废/处置的资产不纳入盘点
  assetWhere.status = { notIn: ['SCRAPPED', 'DISPOSED'] }

  const assets = await prisma.asset.findMany({
    where: assetWhere,
    include: { category: { select: { name: true } } },
  })
  if (!assets.length) return fail('所选范围内没有可盘点的资产')

  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true } })
    : null
  const code = await genInventoryCode()

  const inv = await prisma.inventory.create({
    data: {
      code,
      name,
      orgId: finalOrgId,
      deptId: finalDeptId,
      categoryId: categoryId || null,
      status: 'DOING',
      startDate: startDate ? new Date(startDate) : new Date(),
      ownerId: owner?.id || user.id,
      ownerName: owner?.name || user.name,
      remark,
      createdById: user.id,
      createdBy: user.name,
      items: {
        create: assets.map((a) => ({
          assetId: a.id,
          assetNo: a.assetNo,
          assetName: a.name,
          categoryName: a.category?.name || null,
          expectedStatus: a.status,
          expectedOrgId: a.orgId,
          expectedDeptId: a.deptId,
          expectedKeeperId: a.keeperId,
          expectedLocation: a.location,
        })),
      },
    },
  })

  await opLog(event, { module: 'asset', action: `新建盘点单 ${code}（${assets.length} 项）` })
  return ok({ id: inv.id, code, count: assets.length })
})
