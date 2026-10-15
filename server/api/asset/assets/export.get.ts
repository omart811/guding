import ExcelJS from 'exceljs'
import { prisma } from '../../../utils/prisma'
import { requireUser, requirePerm } from '../../../utils/rbac'
import { opLog } from '../../../utils/log'
import { ASSET_STATUS, assetInclude, buildAssetWhere, fmtDate } from '../../../utils/asset'

/// 按当前筛选条件导出台账 Excel
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:export')
  const q = getQuery(event)
  const where = await buildAssetWhere(user, q)
  const list = await prisma.asset.findMany({
    where,
    include: assetInclude,
    orderBy: { assetNo: 'asc' },
    take: 5000,
  })

  const wb = new ExcelJS.Workbook()
  wb.creator = '固定资产管理系统'
  const ws = wb.addWorksheet('资产台账')
  ws.columns = [
    { header: '资产编号', key: 'assetNo', width: 18 },
    { header: '资产名称', key: 'name', width: 20 },
    { header: '资产分类', key: 'category', width: 16 },
    { header: '规格型号', key: 'spec', width: 22 },
    { header: '品牌', key: 'brand', width: 12 },
    { header: '状态', key: 'status', width: 10 },
    { header: '所属公司', key: 'org', width: 16 },
    { header: '使用部门', key: 'dept', width: 14 },
    { header: '使用人', key: 'keeper', width: 10 },
    { header: '存放地点', key: 'location', width: 20 },
    { header: '购置日期', key: 'purchaseDate', width: 14 },
    { header: '原值(元)', key: 'originalValue', width: 14 },
    { header: '累计折旧(元)', key: 'accumulated', width: 14 },
    { header: '净值(元)', key: 'netValue', width: 14 },
    { header: '供应商', key: 'supplier', width: 18 },
    { header: '发票号', key: 'invoiceNo', width: 18 },
    { header: '备注', key: 'remark', width: 20 },
  ]

  for (const a of list) {
    ws.addRow({
      assetNo: a.assetNo,
      name: a.name,
      category: a.category?.name || '',
      spec: a.spec || '',
      brand: a.brand || '',
      status: ASSET_STATUS[a.status] || a.status,
      org: a.org?.name || '',
      dept: a.dept?.name || '',
      keeper: a.keeper?.name || '',
      location: a.location || '',
      purchaseDate: fmtDate(a.purchaseDate),
      originalValue: a.originalValue,
      accumulated: a.accumulated,
      netValue: a.netValue,
      supplier: a.supplier || '',
      invoiceNo: a.invoiceNo || '',
      remark: a.remark || '',
    })
  }

  // 表头样式 + 金额格式
  const head = ws.getRow(1)
  head.height = 22
  head.font = { bold: true }
  head.alignment = { vertical: 'middle', horizontal: 'center' }
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F8' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      left: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      bottom: { style: 'thin', color: { argb: 'FFD0D7DE' } },
      right: { style: 'thin', color: { argb: 'FFD0D7DE' } },
    }
  })
  ws.getColumn('originalValue').numFmt = '#,##0.00'
  ws.getColumn('accumulated').numFmt = '#,##0.00'
  ws.getColumn('netValue').numFmt = '#,##0.00'
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const filename = `资产台账_${ymd}.xlsx`
  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  await opLog(event, { module: 'asset', action: `导出台账（${list.length} 条）` })
  return buffer
})
