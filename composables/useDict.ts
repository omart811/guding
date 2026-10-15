/// 业务字典（与 server/utils 中的枚举保持一致）
/// 目的：状态中文名与 Element Plus tag 类型集中一处，避免每个页面各写一份导致文案漂移。

export const ASSET_STATUS: Record<string, string> = {
  IN_STOCK: '在库',
  IN_USE: '在用',
  REPAIR: '维修中',
  SCRAPPED: '已报废',
  DISPOSED: '已处置',
}

export const ASSET_STATUS_TAG: Record<string, string> = {
  IN_STOCK: 'info',
  IN_USE: 'success',
  REPAIR: 'warning',
  SCRAPPED: 'danger',
  DISPOSED: 'info',
}

export const FLOW_TYPE: Record<string, string> = {
  IN: '入库',
  ISSUE: '领用',
  RETURN: '归还',
  TRANSFER: '调拨',
}

export const FLOW_TYPE_TAG: Record<string, string> = {
  IN: 'info',
  ISSUE: 'success',
  RETURN: 'warning',
  TRANSFER: 'primary',
}

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

export const INV_RESULT_TAG: Record<string, string> = {
  PENDING: 'info',
  NORMAL: 'success',
  MISSING: 'danger',
  DAMAGED: 'warning',
}

export const DATA_SCOPE: Record<string, string> = {
  ALL: '全部数据',
  ORG: '本组织',
  DEPT: '本部门',
  SELF: '仅本人',
}
