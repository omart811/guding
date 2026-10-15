import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok, fail } from '../../../utils/resp'
import { opLog } from '../../../utils/log'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user:edit')
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { name, phone, orgId, deptId, roleIds = [], status } = body || {}
  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) return fail('用户不存在')
  if (!user.isSuper) {
    if (target.username === 'admin') return fail('不能修改内置管理员')
    if (user.scope === 'ORG' && target.orgId !== user.orgId) return fail('只能修改本组织用户')
    const superRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } })
    if (superRole && roleIds.includes(superRole.id)) return fail('不能分配超级管理员角色')
  }
  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: {
        name,
        phone,
        status,
        orgId: orgId || null,
        deptId: deptId || null,
        roles: { create: roleIds.map((roleId: string) => ({ roleId })) },
      },
    }),
  ])
  await opLog(event, { module: 'system', action: '编辑用户' })
  return ok()
})
