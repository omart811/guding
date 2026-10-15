import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PERMS = [
  ['dashboard', '工作台', 'MENU', 'dashboard'],
  // 资产管理（M2 台账）
  ['asset', '资产管理', 'MENU', 'asset'],
  ['asset:ledger', '资产台账', 'MENU', 'asset'],
  ['asset:ledger:add', '新增资产', 'BUTTON', 'asset'],
  ['asset:ledger:edit', '编辑资产', 'BUTTON', 'asset'],
  ['asset:ledger:del', '删除资产', 'BUTTON', 'asset'],
  ['asset:ledger:export', '导出台账', 'BUTTON', 'asset'],
  ['asset:category', '资产分类', 'MENU', 'asset'],
  ['asset:category:add', '新增分类', 'BUTTON', 'asset'],
  ['asset:category:edit', '编辑分类', 'BUTTON', 'asset'],
  ['asset:category:del', '删除分类', 'BUTTON', 'asset'],
  // 资产流转（M3）
  ['asset:flow', '流转记录', 'MENU', 'asset'],
  ['asset:flow:issue', '领用', 'BUTTON', 'asset'],
  ['asset:flow:return', '归还', 'BUTTON', 'asset'],
  ['asset:flow:transfer', '调拨', 'BUTTON', 'asset'],
  // 资产盘点（M4）
  ['asset:inventory', '盘点任务', 'MENU', 'asset'],
  ['asset:inventory:add', '新建盘点', 'BUTTON', 'asset'],
  ['asset:inventory:check', '录入盘点', 'BUTTON', 'asset'],
  ['asset:inventory:finish', '完成盘点', 'BUTTON', 'asset'],
  ['asset:inventory:del', '删除盘点', 'BUTTON', 'asset'],
  ['asset:inventory:export', '导出盘点', 'BUTTON', 'asset'],
  // 系统管理
  ['system', '系统管理', 'MENU', 'system'],
  ['system:user', '用户管理', 'MENU', 'system'],
  ['system:user:add', '新增用户', 'BUTTON', 'system'],
  ['system:user:edit', '编辑用户', 'BUTTON', 'system'],
  ['system:user:del', '删除用户', 'BUTTON', 'system'],
  ['system:user:resetpwd', '重置密码', 'BUTTON', 'system'],
  ['system:role', '角色管理', 'MENU', 'system'],
  ['system:role:add', '新增角色', 'BUTTON', 'system'],
  ['system:role:edit', '编辑角色', 'BUTTON', 'system'],
  ['system:role:del', '删除角色', 'BUTTON', 'system'],
  ['system:org', '组织架构', 'MENU', 'system'],
  ['system:org:add', '新增组织', 'BUTTON', 'system'],
  ['system:org:edit', '编辑组织', 'BUTTON', 'system'],
  ['system:org:del', '删除组织', 'BUTTON', 'system'],
  ['system:log', '操作日志', 'MENU', 'system'],
]

// 资产分类（两级）：[code, name, parentCode, usefulLife(月)]
const CATEGORIES = [
  ['ELEC', '电子设备', null, 36],
  ['ELEC-NB', '笔记本电脑', 'ELEC', 36],
  ['ELEC-PC', '台式电脑', 'ELEC', 48],
  ['ELEC-PR', '打印机', 'ELEC', 48],
  ['ELEC-SV', '服务器', 'ELEC', 60],
  ['FURN', '办公家具', null, 120],
  ['FURN-DS', '办公桌', 'FURN', 120],
  ['FURN-CH', '办公椅', 'FURN', 120],
  ['VEH', '运输工具', null, 120],
  ['VEH-CAR', '轿车', 'VEH', 120],
  ['HOUSE', '房屋建筑物', null, 240],
]

// 示例资产：[编号, 名称, 分类code, 规格, 品牌, 状态, 组织code, 部门, 使用人username, 存放地点, 购置日期, 原值, 供应商]
const ASSETS = [
  ['ZC20240315001', '笔记本电脑', 'ELEC-NB', 'ThinkPad X1 Carbon', '联想', 'IN_USE', 'ORG-002', '行政部', 'zhangsan', '华北分公司 3F', '2024-03-15', 9800, '联想商城'],
  ['ZC20240315002', '台式电脑', 'ELEC-PC', 'ThinkCentre M720', '联想', 'IN_USE', 'ORG-001', '财务部', 'admin', '集团总部 5F', '2024-03-15', 5200, '京东企业购'],
  ['ZC20240620003', '黑白激光打印机', 'ELEC-PR', 'M437nda', '惠普', 'IN_USE', 'ORG-001', '财务部', 'admin', '集团总部 5F 财务室', '2024-06-20', 3200, '京东企业购'],
  ['ZC20240620004', '机架式服务器', 'ELEC-SV', 'PowerEdge R750', '戴尔', 'IN_USE', 'ORG-001', '财务部', 'admin', '集团总部 机房', '2024-06-20', 86000, '戴尔官网'],
  ['ZC20240910005', '办公桌', 'FURN-DS', '1.6m 实木', '震旦', 'IN_USE', 'ORG-003', '信息技术部', 'lisi', '华南分公司 2F', '2024-09-10', 1500, '震旦办公'],
  ['ZC20240910006', '办公椅', 'FURN-CH', '人体工学椅', '西昊', 'IN_USE', 'ORG-003', '信息技术部', 'lisi', '华南分公司 2F', '2024-09-10', 800, '西昊京东店'],
  ['ZC20231105007', '商务轿车', 'VEH-CAR', '帕萨特 330TSI', '大众', 'IN_USE', 'ORG-001', '财务部', 'admin', '集团总部 停车场', '2023-11-05', 189000, '上汽大众 4S 店'],
  ['ZC20250108008', '笔记本电脑', 'ELEC-NB', 'MateBook 14', '华为', 'IN_STOCK', 'ORG-002', '行政部', null, '华北分公司 库房', '2025-01-08', 6800, '华为商城'],
  ['ZC20250420009', '投影仪', 'ELEC-PR', 'CB-2155W', '爱普生', 'REPAIR', 'ORG-003', '信息技术部', 'lisi', '华南分公司 会议室', '2025-04-20', 4200, '京东企业购'],
  ['ZC20220418010', '壁挂空调', 'HOUSE', 'KFR-35GW', '格力', 'SCRAPPED', 'ORG-001', '财务部', null, '集团总部 仓库', '2022-04-18', 3000, '格力专卖店'],
]

// 直线法折旧：按已使用月数计算累计折旧与净值
function depreciate(original, purchaseDate, usefulLifeMonths) {
  const months = Math.max(0, Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (30.44 * 24 * 3600 * 1000)))
  const used = Math.min(months, usefulLifeMonths)
  const accumulated = Math.round((original * used) / usefulLifeMonths)
  return { accumulated, netValue: original - accumulated }
}

await prisma.rolePerm.deleteMany()
await prisma.userRole.deleteMany()
await prisma.operationLog.deleteMany()
await prisma.assetFlow.deleteMany()
await prisma.inventoryItem.deleteMany()
await prisma.inventory.deleteMany()
await prisma.asset.deleteMany()
await prisma.assetCategory.deleteMany()
await prisma.user.deleteMany()
await prisma.role.deleteMany()
await prisma.permission.deleteMany()
await prisma.dept.deleteMany()
await prisma.org.deleteMany()

const permRecs = {}
for (const [code, name, type, module] of PERMS) {
  permRecs[code] = await prisma.permission.create({ data: { code, name, type, module } })
}

const HQ = await prisma.org.create({ data: { code: 'ORG-001', name: '集团总部' } })
const HB = await prisma.org.create({ data: { code: 'ORG-002', name: '华北分公司', parentId: HQ.id } })
const HN = await prisma.org.create({ data: { code: 'ORG-003', name: '华南分公司', parentId: HQ.id } })
const orgs = { 'ORG-001': HQ, 'ORG-002': HB, 'ORG-003': HN }
const dept1 = await prisma.dept.create({ data: { name: '财务部', orgId: HQ.id } })
const dept2 = await prisma.dept.create({ data: { name: '行政部', orgId: HB.id } })
const dept3 = await prisma.dept.create({ data: { name: '信息技术部', orgId: HN.id } })
const depts = { 财务部: dept1, 行政部: dept2, 信息技术部: dept3 }

const superRole = await prisma.role.create({ data: { code: 'SUPER_ADMIN', name: '超级管理员', dataScope: 'ALL', status: 1 } })
const orgRole = await prisma.role.create({ data: { code: 'ORG_ADMIN', name: '分公司管理员', dataScope: 'ORG', status: 1 } })
const empRole = await prisma.role.create({ data: { code: 'EMPLOYEE', name: '普通员工', dataScope: 'SELF', status: 1 } })

await prisma.rolePerm.createMany({
  data: Object.values(permRecs).map((p) => ({ roleId: superRole.id, permId: p.id })),
})

// 分公司管理员：资产管理（增改+导出，不可删除）、用户管理、组织与日志只读
const orgPermCodes = [
  'dashboard',
  'asset', 'asset:ledger', 'asset:ledger:add', 'asset:ledger:edit', 'asset:ledger:export', 'asset:category',
  'asset:flow', 'asset:flow:issue', 'asset:flow:return', 'asset:flow:transfer',
  'asset:inventory', 'asset:inventory:add', 'asset:inventory:check', 'asset:inventory:finish', 'asset:inventory:export',
  'system', 'system:user', 'system:user:add', 'system:user:edit', 'system:user:resetpwd', 'system:role', 'system:org', 'system:log',
]
await prisma.rolePerm.createMany({
  data: orgPermCodes.map((c) => ({ roleId: orgRole.id, permId: permRecs[c].id })),
})

// 普通员工：工作台 + 台账只读 + 本人资产流转/盘点记录只读
const empPermCodes = ['dashboard', 'asset', 'asset:ledger', 'asset:flow', 'asset:inventory']
await prisma.rolePerm.createMany({
  data: empPermCodes.map((c) => ({ roleId: empRole.id, permId: permRecs[c].id })),
})

const admin = await prisma.user.create({
  data: { username: 'admin', password: bcrypt.hashSync('Admin@123', 10), name: '系统管理员', orgId: HQ.id, deptId: dept1.id },
})
await prisma.userRole.create({ data: { userId: admin.id, roleId: superRole.id } })
const zs = await prisma.user.create({
  data: { username: 'zhangsan', password: bcrypt.hashSync('Zhang@123', 10), name: '张三', orgId: HB.id, deptId: dept2.id },
})
await prisma.userRole.create({ data: { userId: zs.id, roleId: orgRole.id } })
const ls = await prisma.user.create({
  data: { username: 'lisi', password: bcrypt.hashSync('Li@1234', 10), name: '李四', orgId: HN.id, deptId: dept3.id },
})
await prisma.userRole.create({ data: { userId: ls.id, roleId: empRole.id } })
const users = { admin, zhangsan: zs, lisi: ls }

// 资产分类
const catRecs = {}
for (const [code, name, parentCode, usefulLife] of CATEGORIES) {
  catRecs[code] = await prisma.assetCategory.create({
    data: { code, name, usefulLife, parentId: parentCode ? catRecs[parentCode].id : null },
  })
}

// 示例资产
const createdAssets = []
for (const [assetNo, name, catCode, spec, brand, status, orgCode, deptName, keeper, location, purchaseDate, originalValue, supplier] of ASSETS) {
  const { accumulated, netValue } = depreciate(originalValue, purchaseDate, catRecs[catCode].usefulLife)
  createdAssets.push(
    await prisma.asset.create({
      data: {
        assetNo,
        name,
        categoryId: catRecs[catCode].id,
        spec,
        brand,
        status,
        orgId: orgs[orgCode].id,
        deptId: depts[deptName].id,
        keeperId: keeper ? users[keeper].id : null,
        location,
        purchaseDate: new Date(purchaseDate),
        originalValue,
        accumulated,
        netValue,
        supplier,
        unit: catCode.startsWith('VEH') ? '辆' : catCode.startsWith('FURN') ? '件' : '台',
      },
    }),
  )
}

// 流转记录：每件资产一条采购入库；ZC20240315001 额外演示「总部 → 华北」调拨；有使用人的补一条领用
const day = 24 * 3600 * 1000
for (const a of createdAssets) {
  const demoTransfer = a.assetNo === 'ZC20240315001'
  await prisma.assetFlow.create({
    data: {
      type: 'IN',
      assetId: a.id,
      toOrgId: demoTransfer ? HQ.id : a.orgId,
      toDeptId: demoTransfer ? dept1.id : a.deptId,
      flowDate: a.purchaseDate,
      operatorId: admin.id,
      operatorName: admin.name,
      remark: '采购入库',
    },
  })
  if (demoTransfer) {
    await prisma.assetFlow.create({
      data: {
        type: 'TRANSFER',
        assetId: a.id,
        fromOrgId: HQ.id,
        fromDeptId: dept1.id,
        toOrgId: a.orgId,
        toDeptId: a.deptId,
        flowDate: new Date('2024-03-20'),
        operatorId: admin.id,
        operatorName: admin.name,
        remark: '调拨至华北分公司',
      },
    })
  }
  if (a.keeperId) {
    await prisma.assetFlow.create({
      data: {
        type: 'ISSUE',
        assetId: a.id,
        fromOrgId: a.orgId,
        fromDeptId: a.deptId,
        toOrgId: a.orgId,
        toDeptId: a.deptId,
        toKeeperId: a.keeperId,
        flowDate: new Date(new Date(a.purchaseDate).getTime() + day),
        operatorId: admin.id,
        operatorName: admin.name,
        remark: '领用登记',
      },
    })
  }
}

// 盘点单（M4）：按组织范围生成明细快照
const assetMeta = new Map(createdAssets.map((a, i) => [a.id, ASSETS[i]]))
function snapshot(a, over = {}) {
  const meta = assetMeta.get(a.id) || []
  return {
    assetId: a.id,
    assetNo: a.assetNo,
    assetName: a.name,
    categoryName: catRecs[meta[2]]?.name || null,
    expectedStatus: a.status,
    expectedOrgId: a.orgId,
    expectedDeptId: a.deptId,
    expectedKeeperId: a.keeperId,
    expectedLocation: a.location,
    ...over,
  }
}
const hqAssets = createdAssets.filter((a) => a.orgId === HQ.id)
const hbAssets = createdAssets.filter((a) => a.orgId === HB.id)

// 已完成的盘点：集团总部全量，含 1 条盘亏、1 条损坏
await prisma.inventory.create({
  data: {
    code: 'PD202409300001',
    name: '2024 年三季度集团总部资产盘点',
    orgId: HQ.id,
    status: 'DONE',
    startDate: new Date('2024-09-25'),
    endDate: new Date('2024-09-30'),
    ownerId: admin.id,
    ownerName: admin.name,
    createdById: admin.id,
    createdBy: admin.name,
    remark: '季度例行盘点，覆盖集团总部全部资产',
    items: {
      create: hqAssets.map((a) =>
        snapshot(a, {
          result: a.status === 'SCRAPPED' ? 'MISSING' : a.status === 'REPAIR' ? 'DAMAGED' : 'NORMAL',
          checked: true,
          checkedAt: new Date('2024-09-28'),
          checkerId: admin.id,
          checkerName: admin.name,
          remark: a.status === 'SCRAPPED' ? '实物已报废清理，账面未同步' : null,
        }),
      ),
    },
  },
})

// 进行中的盘点：华北分公司，部分已盘
const hbItems = hbAssets.map((a, i) =>
  snapshot(a, i === 0
    ? { result: 'NORMAL', checked: true, checkedAt: new Date('2024-10-08'), checkerId: zs.id, checkerName: zs.name }
    : {}),
)
await prisma.inventory.create({
  data: {
    code: 'PD202410080002',
    name: '华北分公司 10 月资产盘点',
    orgId: HB.id,
    status: 'DOING',
    startDate: new Date('2024-10-08'),
    ownerId: zs.id,
    ownerName: zs.name,
    createdById: admin.id,
    createdBy: admin.name,
    remark: '行政部先行盘点，其余部门待录入',
    items: { create: hbItems },
  },
})

console.log(`seed done: users=${Object.keys(users).length} categories=${CATEGORIES.length} assets=${ASSETS.length} flows=${await prisma.assetFlow.count()} inventories=${await prisma.inventory.count()}`)
