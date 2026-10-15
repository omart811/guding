import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'
import { genAssetNo } from '../../../utils/asset'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:add')
  const b = await readBody(event)
  const {
    name, categoryId, spec, brand, unit, status, orgId, deptId,
    keeperId, location, purchaseDate, originalValue, supplier, invoiceNo, remark,
  } = b || {}
  if (!name || !categoryId) return fail('资产名称和分类必填')
  const cat = await prisma.assetCategory.findUnique({ where: { id: categoryId } })
  if (!cat) return fail('资产分类不存在')

  // 数据范围约束：非超管只能在自己范围内新增
  let finalOrgId = orgId || user.orgId
  let finalDeptId = deptId || null
  if (!user.isSuper) {
    if (user.scope === 'ORG') {
      if (orgId && orgId !== user.orgId) return fail('只能在本组织下新增资产')
      finalOrgId = user.orgId
    } else if (user.scope === 'DEPT') {
      finalOrgId = user.orgId
      finalDeptId = user.deptId
    } else {
      return fail('无权限操作')
    }
  }

  const value = Number(originalValue) || 0
  const assetNo = await genAssetNo()
  const created = await prisma.asset.create({
    data: {
      assetNo,
      name,
      categoryId,
      spec,
      brand,
      unit: unit || '台',
      status: status || 'IN_STOCK',
      orgId: finalOrgId || null,
      deptId: finalDeptId || deptId || null,
      keeperId: keeperId || null,
      location,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      originalValue: value,
      accumulated: 0,
      netValue: value,
      supplier,
      invoiceNo,
      remark,
    },
  })
  // 入库流水（新资产一律先入在库）
  await prisma.assetFlow.create({
    data: {
      type: 'IN',
      assetId: created.id,
      toOrgId: created.orgId,
      toDeptId: created.deptId,
      flowDate: created.purchaseDate || new Date(),
      operatorId: user.id,
      operatorName: user.name,
      remark: '采购入库',
    },
  })
  await opLog(event, { module: 'asset', action: `新增资产 ${assetNo}` })
  return ok({ id: created.id, assetNo })
})
