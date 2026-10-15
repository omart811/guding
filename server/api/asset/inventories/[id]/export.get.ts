import ExcelJS from 'exceljs'
import { prisma } from '../../../../utils/prisma'
import { requireUser, requirePerm } from '../../../../utils/rbac'
import { opLog } from '../../../../utils/log'
import { ASSET_STATUS, fmtDate } from '../../../../utils/asset'
import { INV_RESULT, buildInventoryWhere, resolveItemNames, summarize } from '../../../../utils/inventory'

/// 导出盘点明细 Excel
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  requirePerm(user, 'asset:inventory:export')
  const id = getRouterParam(event, 'id') as string

  // 数据范围校验：导出与详情/录入同口径，避免越权导出他组织盘点数据
  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) throw createError({ statusCode: 400, message: '盘点单不存在或无权操作' })

  const inv = await prisma.inventory.findUnique({ where: { id } })
  if (!inv) throw createError({ statusCode: 400, message: '盘点单不存在' })

  const items = await prisma.inventoryItem.findMany({ where: { inventoryId: id }, orderBy: { assetNo: 'asc' } })
  const rows = await resolveItemNames(items)
  const stats = summarize(items)

  const wb = new ExcelJS.Workbook()
  wb.creator = '固定资产管理系统'
  const ws = wb.addWorksheet('盘点明细')
  ws.columns = [
    { header: '资产编号', key: 'assetNo', width: 18 },
    { header: '资产名称', key: 'assetName', width: 20 },
    { header: '资产分类', key: 'categoryName', width: 16 },
    { header: '账面状态', key: 'expectedStatus', width: 12 },
    { header: '所属公司', key: 'orgName', width: 16 },
    { header: '使用部门', key: 'deptName', width: 14 },
    { header: '使用人', key: 'keeperName', width: 12 },
    { header: '账面存放地点', key: 'expectedLocation', width: 22 },
    { header: '盘点结果', key: 'result', width: 12 },
    { header: '盘点人', key: 'checkerName', width: 12 },
    { header: '盘点时间', key: 'checkedAt', width: 14 },
    { header: '盘点备注', key: 'remark', width: 24 },
  ]
  for (const r of rows) {
    ws.addRow({
      assetNo: r.assetNo,
      assetName: r.assetName,
      categoryName: r.categoryName || '',
      expectedStatus: ASSET_STATUS[r.expectedStatus] || r.expectedStatus || '',
      orgName: r.orgName,
      deptName: r.deptName,
      keeperName: r.keeperName,
      expectedLocation: r.expectedLocation || '',
      result: INV_RESULT[r.result] || r.result,
      checkerName: r.checkerName || '',
      checkedAt: r.checkedAt ? fmtDate(r.checkedAt) : '',
      remark: r.remark || '',
    })
  }

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
  // 盘亏标红
  ws.eachRow((row, idx) => {
    if (idx === 1) return
    const cell = row.getCell('result')
    if (cell.value === INV_RESULT.MISSING) cell.font = { color: { argb: 'FFD03050' }, bold: true }
    if (cell.value === INV_RESULT.DAMAGED) cell.font = { color: { argb: 'FFE6A23C' }, bold: true }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `盘点明细_${inv.code}.xlsx`
  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  await opLog(event, {
    module: 'asset',
    action: `导出盘点明细 ${inv.code}（${stats.total} 项，盘亏 ${stats.missing}）`,
  })
  return buffer
})
