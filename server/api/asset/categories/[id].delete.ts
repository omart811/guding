import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:category:del')
  const id = getRouterParam(event, 'id')!
  const cat = await prisma.assetCategory.findUnique({ where: { id } })
  if (!cat) return fail('分类不存在')
  const childCount = await prisma.assetCategory.count({ where: { parentId: id } })
  if (childCount > 0) return fail('请先删除子分类')
  const assetCount = await prisma.asset.count({ where: { categoryId: id } })
  if (assetCount > 0) return fail('该分类下存在资产，无法删除')
  await prisma.assetCategory.delete({ where: { id } })
  await opLog(event, { module: 'asset', action: `删除资产分类 ${cat.name}` })
  return ok()
})
