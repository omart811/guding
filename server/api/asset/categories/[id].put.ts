import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:category:edit')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, parentId, usefulLife, remark } = body || {}
  if (!name) return fail('分类名称必填')
  if (parentId === id) return fail('上级分类不能是自己')
  const cat = await prisma.assetCategory.findUnique({ where: { id } })
  if (!cat) return fail('分类不存在')
  await prisma.assetCategory.update({
    where: { id },
    data: { name, parentId: parentId || null, usefulLife: Number(usefulLife) || cat.usefulLife, remark },
  })
  await opLog(event, { module: 'asset', action: `编辑资产分类 ${name}` })
  return ok()
})
