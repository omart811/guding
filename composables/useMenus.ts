export interface MenuItem {
  code: string
  name: string
  path?: string
  icon?: string
  children?: MenuItem[]
}

/// 菜单与权限 code 一一对应；icon 取值见 layouts/default.vue 的 icons 映射
export const allMenus: MenuItem[] = [
  { code: 'dashboard', name: '工作台', path: '/', icon: 'Odometer' },
  {
    code: 'asset',
    name: '资产管理',
    icon: 'Box',
    children: [
      { code: 'asset:ledger', name: '资产台账', path: '/asset/ledger', icon: 'Notebook' },
      { code: 'asset:flow', name: '流转记录', path: '/asset/flows', icon: 'Switch' },
      { code: 'asset:inventory', name: '盘点任务', path: '/asset/inventories', icon: 'Checked' },
      { code: 'asset:category', name: '资产分类', path: '/asset/categories', icon: 'FolderOpened' },
    ],
  },
  {
    code: 'system',
    name: '系统管理',
    icon: 'Setting',
    children: [
      { code: 'system:user', name: '用户管理', path: '/system/users', icon: 'User' },
      { code: 'system:role', name: '角色管理', path: '/system/roles', icon: 'Avatar' },
      { code: 'system:org', name: '组织架构', path: '/system/orgs', icon: 'OfficeBuilding' },
      { code: 'system:log', name: '操作日志', path: '/system/logs', icon: 'Document' },
    ],
  },
]
