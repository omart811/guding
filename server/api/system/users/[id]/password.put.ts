import { prisma } from '../../../../utils/prisma'
import { requireUser, requirePerm } from '../../../../utils/rbac'
import { hashPwd } from '../../../../utils/auth'
import { ok, fail } from '../../../../utils/resp'
import { opLog } from '../../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user:resetpwd')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const pwd = body?.password
  if (!pwd || String(pwd).length < 6) return fail('密码至少6位')
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return fail('用户不存在')
  if (!user.isSuper && user.scope === 'ORG' && target.orgId !== user.orgId) return fail('只能重置本组织用户密码')
  await prisma.user.update({ where: { id }, data: { password: hashPwd(pwd) } })
  await opLog(event, { module: 'system', action: '重置密码' })
  return ok()
})
