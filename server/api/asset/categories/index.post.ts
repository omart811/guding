import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:category:add')
  const body = await readBody(event)
  const { code, name, parentId, usefulLife, remark } = body || {}
  if (!code || !name) return fail('分类编码和名称必填')
  if (await prisma.assetCategory.findUnique({ where: { code } })) return fail('分类编码已存在')
  const created = await prisma.assetCategory.create({
    data: {
      code,
      name,
      parentId: parentId || null,
      usefulLife: Number(usefulLife) || 60,
      remark,
    },
  })
  await opLog(event, { module: 'asset', action: `新增资产分类 ${name}` })
  return ok({ id: created.id })
})
