import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm, scopeWhere } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:user')
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const size = Number(q.size) || 20
  const keyword = (q.keyword as string) || ''
  const where: any = { ...scopeWhere(user) }
  if (keyword) where.OR = [{ username: { contains: keyword } }, { name: { contains: keyword } }]
  if (q.orgId) where.orgId = q.orgId
  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { org: true, dept: true, roles: { include: { role: true } } },
      skip: (page - 1) * size,
      take: size,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])
  const safeList = list.map(({ password, ...rest }) => rest)
  return ok({ list: safeList, total })
})
