import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { assetInclude } from '../../../utils/asset'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger')
  const id = getRouterParam(event, 'id')!
  const asset = await prisma.asset.findUnique({ where: { id }, include: assetInclude })
  if (!asset) return fail('资产不存在')
  if (!user.isSuper && user.scope === 'ORG' && asset.orgId !== user.orgId) return fail('无权查看该资产')
  if (!user.isSuper && user.scope === 'SELF' && asset.keeperId !== user.id) return fail('无权查看该资产')
  return ok(asset)
})
