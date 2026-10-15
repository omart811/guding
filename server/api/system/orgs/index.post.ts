import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:org:add')
  const body = await readBody(event)
  const { code, name, parentId } = body || {}
  if (!code || !name) return fail('编码和名称必填')
  if (await prisma.org.findUnique({ where: { code } })) return fail('组织编码已存在')
  const created = await prisma.org.create({ data: { code, name, parentId: parentId || null } })
  await opLog(event, { module: 'system', action: '新增组织' })
  return ok({ id: created.id })
})
