import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:org:del')
  const id = getRouterParam(event, 'id')!
  const org = await prisma.org.findUnique({ where: { id } })
  if (!org) return fail('组织不存在')
  const userCount = await prisma.user.count({ where: { orgId: id } })
  if (userCount > 0) return fail('该组织下存在用户，无法删除')
  const childCount = await prisma.org.count({ where: { parentId: id } })
  if (childCount > 0) return fail('请先删除子组织')
  await prisma.org.delete({ where: { id } })
  await opLog(event, { module: 'system', action: '删除组织' })
  return ok()
})
