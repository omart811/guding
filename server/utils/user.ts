import { prisma } from './prisma'

const rank: Record<string, number> = { ALL: 0, ORG: 1, DEPT: 2, SELF: 3 }

/// 组装当前登录用户信息（角色、权限、数据范围）
export async function getMe(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { roles: { include: { role: true } }, org: true, dept: true },
  })
  if (!user) return null
  const roles = user.roles.map((ur) => ({
    id: ur.role.id,
    code: ur.role.code,
    name: ur.role.name,
    dataScope: ur.role.dataScope,
  }))
  const isSuper = roles.some((r) => r.code === 'SUPER_ADMIN')
  let perms: string[] = []
  if (isSuper) {
    perms = (await prisma.permission.findMany({ select: { code: true } })).map((p) => p.code)
  } else if (roles.length) {
    const rp = await prisma.rolePerm.findMany({
      where: { roleId: { in: roles.map((r) => r.id) } },
      include: { perm: true },
    })
    perms = [...new Set(rp.map((x) => x.perm.code))]
  }
  const scope = roles.map((r) => r.dataScope).sort((a, b) => (rank[a] ?? 3) - (rank[b] ?? 3))[0] || 'SELF'
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    status: user.status,
    orgId: user.orgId,
    deptId: user.deptId,
    org: user.org,
    dept: user.dept,
    roles,
    perms,
    isSuper,
    scope,
  }
}
