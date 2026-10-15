import { prisma } from './prisma'
import { scopeWhere } from './rbac'

/// 组装资产查询条件：数据范围 + 关键字 + 分类子树 + 状态 + 购置日期区间
export async function buildAssetWhere(user: any, q: Record<string, any>) {
  const where: any = { ...scopeWhere(user, { org: 'orgId', dept: 'deptId', user: 'keeperId' }) }
  const keyword = ((q.keyword as string) || '').trim()
  if (keyword) {
    where.OR = [
      { assetNo: { contains: keyword } },
      { name: { contains: keyword } },
      { spec: { contains: keyword } },
      { brand: { contains: keyword } },
    ]
  }
  if (q.categoryId) where.categoryId = { in: await categoryWithChildren(q.categoryId as string) }
  if (q.orgId) where.orgId = q.orgId
  if (q.deptId) where.deptId = q.deptId
  if (q.keeperId) where.keeperId = q.keeperId
  if (q.status) where.status = q.status
  if (q.start || q.end) {
    where.purchaseDate = {}
    if (q.start) where.purchaseDate.gte = new Date(q.start as string)
    if (q.end) where.purchaseDate.lte = new Date(`${q.end}T23:59:59`)
  }
  return where
}

/// 分类 id 及其全部子分类 id
export async function categoryWithChildren(rootId: string) {
  const all = await prisma.assetCategory.findMany({ select: { id: true, parentId: true } })
  const ids = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const next = all.filter((c) => c.parentId && frontier.includes(c.parentId)).map((c) => c.id)
    frontier = next.filter((id) => !ids.includes(id))
    ids.push(...frontier)
  }
  return ids
}

/// 生成资产编号：ZC + yyyyMMdd + 4 位当日序号
export async function genAssetNo() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const prefix = `ZC${ymd}`
  const last = await prisma.asset.findFirst({
    where: { assetNo: { startsWith: prefix } },
    orderBy: { assetNo: 'desc' },
    select: { assetNo: true },
  })
  const seq = last ? Number(last.assetNo.slice(-4)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

export const ASSET_STATUS: Record<string, string> = {
  IN_STOCK: '在库',
  IN_USE: '在用',
  REPAIR: '维修中',
  SCRAPPED: '已报废',
  DISPOSED: '已处置',
}

export const FLOW_TYPE: Record<string, string> = {
  IN: '入库',
  ISSUE: '领用',
  RETURN: '归还',
  TRANSFER: '调拨',
}

/// 把流转记录里的 组织/部门/使用人 id 批量解析为可读文本
export async function resolveFlowNames(flows: any[]) {
  const orgIds = new Set<string>()
  const deptIds = new Set<string>()
  const userIds = new Set<string>()
  for (const f of flows) {
    for (const id of [f.fromOrgId, f.toOrgId]) if (id) orgIds.add(id)
    for (const id of [f.fromDeptId, f.toDeptId]) if (id) deptIds.add(id)
    for (const id of [f.fromKeeperId, f.toKeeperId]) if (id) userIds.add(id)
  }
  const [orgs, depts, users] = await Promise.all([
    prisma.org.findMany({ where: { id: { in: [...orgIds] } }, select: { id: true, name: true } }),
    prisma.dept.findMany({ where: { id: { in: [...deptIds] } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }),
  ])
  const om = new Map(orgs.map((o) => [o.id, o.name]))
  const dm = new Map(depts.map((d) => [d.id, d.name]))
  const um = new Map(users.map((u) => [u.id, u.name]))
  const text = (orgId?: string | null, deptId?: string | null, keeperId?: string | null) =>
    [orgId ? om.get(orgId) : '', deptId ? dm.get(deptId) : '', keeperId ? um.get(keeperId) : '']
      .filter(Boolean)
      .join(' / ') || '-'
  return { text }
}

export const fmtDate = (d: Date | null | undefined) =>
  d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''

/// 资产详情/列表的公共 include
export const assetInclude = {
  category: true,
  org: true,
  dept: true,
  keeper: { select: { id: true, name: true } },
} as const
