import { prisma } from './prisma'

export const INV_STATUS: Record<string, string> = {
  DOING: '进行中',
  DONE: '已完成',
}

export const INV_RESULT: Record<string, string> = {
  PENDING: '待盘',
  NORMAL: '正常',
  MISSING: '盘亏',
  DAMAGED: '损坏',
}

/// 生成盘点单号：PD + yyyyMMdd + 4 位当日序号
export async function genInventoryCode() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const prefix = `PD${ymd}`
  const last = await prisma.inventory.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })
  const seq = last ? Number(last.code.slice(-4)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

/// 盘点单数据范围：按「盘点明细中是否含本人可管辖的资产」过滤，
/// 与流转记录同一套思路（归属变化即权限变化），避免各模块各写一套
export function buildInventoryWhere(user: any, q: Record<string, any> = {}) {
  const where: any = {}
  if (!user.isSuper && user.scope !== 'ALL') {
    const cond =
      user.scope === 'ORG'
        ? { expectedOrgId: user.orgId ?? '__none__' }
        : user.scope === 'DEPT'
          ? { expectedDeptId: user.deptId ?? '__none__' }
          : { expectedKeeperId: user.id }
    where.items = { some: cond }
  }
  const keyword = ((q.keyword as string) || '').trim()
  if (keyword) {
    where.OR = [{ code: { contains: keyword } }, { name: { contains: keyword } }]
  }
  if (q.status) where.status = q.status
  if (q.orgId) where.orgId = q.orgId
  return where
}

/// 盘点单列表/详情公共 include（只带统计需要的字段）
export const inventoryInclude = {
  items: { select: { result: true, checked: true } },
} as const

/// 由明细汇总盘点统计
export function summarize(items: { result: string; checked: boolean }[]) {
  const total = items.length
  const checked = items.filter((i) => i.checked).length
  const normal = items.filter((i) => i.result === 'NORMAL').length
  const missing = items.filter((i) => i.result === 'MISSING').length
  const damaged = items.filter((i) => i.result === 'DAMAGED').length
  return { total, checked, pending: total - checked, normal, missing, damaged }
}

/// 批量把明细里的 组织/部门/使用人 id 解析成可读文本（避免 N+1）
export async function resolveItemNames(items: any[]) {
  const orgIds = new Set<string>()
  const deptIds = new Set<string>()
  const userIds = new Set<string>()
  for (const i of items) {
    if (i.expectedOrgId) orgIds.add(i.expectedOrgId)
    if (i.expectedDeptId) deptIds.add(i.expectedDeptId)
    if (i.expectedKeeperId) userIds.add(i.expectedKeeperId)
  }
  const [orgs, depts, users] = await Promise.all([
    prisma.org.findMany({ where: { id: { in: [...orgIds] } }, select: { id: true, name: true } }),
    prisma.dept.findMany({ where: { id: { in: [...deptIds] } }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }),
  ])
  const om = new Map(orgs.map((o) => [o.id, o.name]))
  const dm = new Map(depts.map((d) => [d.id, d.name]))
  const um = new Map(users.map((u) => [u.id, u.name]))
  return items.map((i) => ({
    ...i,
    orgName: i.expectedOrgId ? om.get(i.expectedOrgId) || '-' : '-',
    deptName: i.expectedDeptId ? dm.get(i.expectedDeptId) || '-' : '-',
    keeperName: i.expectedKeeperId ? um.get(i.expectedKeeperId) || '-' : '-',
  }))
}
