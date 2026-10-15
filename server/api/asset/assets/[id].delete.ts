import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:del')
  const id = getRouterParam(event, 'id')!
  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) return fail('资产不存在')
  if (!user.isSuper) {
    if (user.scope === 'ORG' && asset.orgId !== user.orgId) return fail('只能删除本组织资产')
    if (user.scope !== 'ORG' && user.scope !== 'ALL') return fail('无权限操作')
  }
  await prisma.asset.delete({ where: { id } })
  await opLog(event, { module: 'asset', action: `删除资产 ${asset.assetNo}` })
  return ok()
})
