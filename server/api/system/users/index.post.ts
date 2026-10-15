import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { hashPwd } from '../../../utils/auth'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user:add')
  const body = await readBody(event)
  const { username, name, phone, orgId, deptId, roleIds = [], password, status } = body || {}
  if (!username || !name) return fail('用户名和姓名必填')
  if (user.scope === 'SELF') return fail('无权限操作')
  const superRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } })
  if (!user.isSuper && superRole && roleIds.includes(superRole.id)) return fail('不能分配超级管理员角色')
  if (!user.isSuper && user.scope === 'ORG' && orgId && orgId !== user.orgId) return fail('只能创建本组织用户')
  if (await prisma.user.findUnique({ where: { username } })) return fail('用户名已存在')
  const created = await prisma.user.create({
    data: {
      username,
      name,
      phone,
      password: hashPwd(password || 'Admin@123'),
      orgId: orgId || null,
      deptId: deptId || null,
      status: status ?? 1,
      roles: { create: roleIds.map((roleId: string) => ({ roleId })) },
    },
  })
  await opLog(event, { module: 'system', action: '新增用户' })
  return ok({ id: created.id })
})
