import { prisma } from '../../utils/prisma'
import { requireUser, requirePerm } from '../../utils/rbac'
import { ok } from '../../utils/resp'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'system:log')
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const size = Number(q.size) || 20
  const where: any = {}
  if (q.module) where.module = q.module
  if (q.keyword) {
    const kw = q.keyword as string
    where.OR = [{ userName: { contains: kw } }, { action: { contains: kw } }]
  }
  if (q.today) where.createdAt = { gte: new Date(new Date().toDateString()) }
  const [list, total] = await Promise.all([
    prisma.operationLog.findMany({ where, skip: (page - 1) * size, take: size, orderBy: { createdAt: 'desc' } }),
    prisma.operationLog.count({ where }),
  ])
  return ok({ list, total })
})
