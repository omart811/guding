import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:role:add')
  const body = await readBody(event)
  const { code, name, dataScope = 'ORG', status = 1 } = body || {}
  if (!code || !name) return fail('编码和名称必填')
  if (await prisma.role.findUnique({ where: { code } })) return fail('角色编码已存在')
  const created = await prisma.role.create({ data: { code, name, dataScope, status } })
  await opLog(event, { module: 'system', action: '新增角色' })
  return ok({ id: created.id })
})
