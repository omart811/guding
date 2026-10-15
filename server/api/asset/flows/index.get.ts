import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { ok } from '../../../utils/resp'
import { buildAssetWhere, resolveFlowNames } from '../../../utils/asset'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:flow')
  const q = getQuery(event)
  const page = Number(q.page) || 1
  const size = Number(q.size) || 20
  // 数据范围：按资产归属过滤（与台账同一套规则）
  const assetWhere = await buildAssetWhere(user, {})
  const where: any = { asset: assetWhere }
  if (q.type) where.type = q.type
  if (q.assetId) where.assetId = q.assetId
  const keyword = ((q.keyword as string) || '').trim()
  if (keyword) {
    where.asset = { ...assetWhere, OR: [{ assetNo: { contains: keyword } }, { name: { contains: keyword } }] }
  }
  if (q.start || q.end) {
    where.flowDate = {}
    if (q.start) where.flowDate.gte = new Date(q.start as string)
    if (q.end) where.flowDate.lte = new Date(`${q.end}T23:59:59`)
  }
  const [list, total] = await Promise.all([
    prisma.assetFlow.findMany({
      where,
      include: { asset: { select: { id: true, assetNo: true, name: true, status: true } } },
      orderBy: { flowDate: 'desc' },
      skip: (page - 1) * size,
      take: size,
    }),
    prisma.assetFlow.count({ where }),
  ])
  const names = await resolveFlowNames(list)
  return ok({
    list: list.map((f) => ({
      ...f,
      fromText: names.text(f.fromOrgId, f.fromDeptId, f.fromKeeperId),
      toText: names.text(f.toOrgId, f.toDeptId, f.toKeeperId),
    })),
    total,
  })
})
