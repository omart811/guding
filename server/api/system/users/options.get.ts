import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm, scopeWhere } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

/// 用户下拉选项（选择使用人/保管人用），受数据范围限制
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:add', 'asset:ledger:edit', 'system:user')
  const where: any = { ...scopeWhere(user), status: 1 }
  const list = await prisma.user.findMany({
    where,
    select: { id: true, name: true, orgId: true, deptId: true },
    orderBy: { name: 'asc' },
  })
  return ok(list)
})
