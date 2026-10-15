import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:org:edit')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, parentId } = body || {}
  if (!name) return fail('名称必填')
  if (parentId === id) return fail('上级不能是自己')
  const org = await prisma.org.findUnique({ where: { id } })
  if (!org) return fail('组织不存在')
  await prisma.org.update({ where: { id }, data: { name, parentId: parentId || null } })
  await opLog(event, { module: 'system', action: '编辑组织' })
  return ok()
})
