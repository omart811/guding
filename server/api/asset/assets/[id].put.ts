import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:edit')
  const id = getRouterParam(event, 'id')!
  const b = await readBody(event)
  const {
    name, categoryId, spec, brand, unit, status, orgId, deptId,
    keeperId, location, purchaseDate, originalValue, netValue, accumulated, supplier, invoiceNo, remark,
  } = b || {}
  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) return fail('资产不存在')
  if (!user.isSuper) {
    if (user.scope === 'ORG' && asset.orgId !== user.orgId) return fail('只能编辑本组织资产')
    if (user.scope === 'SELF') return fail('无权限操作')
    if (user.scope === 'DEPT' && asset.deptId !== user.deptId) return fail('只能编辑本部门资产')
  }
  if (categoryId && !(await prisma.assetCategory.findUnique({ where: { id: categoryId } }))) {
    return fail('资产分类不存在')
  }
  const value = originalValue === undefined || originalValue === null ? asset.originalValue : Number(originalValue)
  await prisma.asset.update({
    where: { id },
    data: {
      name,
      categoryId: categoryId || asset.categoryId,
      spec,
      brand,
      unit,
      status,
      orgId: orgId === undefined ? asset.orgId : orgId || null,
      deptId: deptId === undefined ? asset.deptId : deptId || null,
      keeperId: keeperId === undefined ? asset.keeperId : keeperId || null,
      location,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      originalValue: value,
      accumulated: accumulated === undefined || accumulated === null ? asset.accumulated : Number(accumulated),
      netValue: netValue === undefined || netValue === null ? asset.netValue : Number(netValue),
      supplier,
      invoiceNo,
      remark,
    },
  })
  await opLog(event, { module: 'asset', action: `编辑资产 ${asset.assetNo}` })
  return ok()
})
