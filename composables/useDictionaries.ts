type DictKey = 'orgs' | 'depts' | 'users' | 'categories'

/// 组织 / 部门 / 用户 / 分类字典：一次拉取后在会话内共享。
/// 原先 4 个页面各自 onMounted 请求同一批下拉数据（每页 3–4 个重复请求），
/// 这里用 useState 缓存，导航切换不再重复请求；登录/登出时清空。
export function useDictionaries() {
  const orgTree = useState<any[]>('dict:orgs', () => [])
  const depts = useState<any[]>('dict:depts', () => [])
  const users = useState<any[]>('dict:users', () => [])
  const categories = useState<any[]>('dict:categories', () => [])
  const loaded = useState<Partial<Record<DictKey, boolean>>>('dict:loaded', () => ({}))

  const request = useRequestFetch()

  async function ensure(keys: DictKey[] = ['orgs', 'depts', 'users', 'categories']) {
    const tasks: Promise<unknown>[] = []
    if (keys.includes('orgs') && !loaded.value.orgs) {
      tasks.push(
        request<any>('/api/system/orgs')
          .then((r: any) => {
            orgTree.value = r?.data || []
            loaded.value.orgs = true
          })
          .catch(() => {}),
      )
    }
    if (keys.includes('depts') && !loaded.value.depts) {
      tasks.push(
        request<any>('/api/system/depts')
          .then((r: any) => {
            depts.value = r?.data || []
            loaded.value.depts = true
          })
          .catch(() => {}),
      )
    }
    if (keys.includes('users') && !loaded.value.users) {
      tasks.push(
        request<any>('/api/system/users/options')
          .then((r: any) => {
            users.value = r?.data || []
            loaded.value.users = true
          })
          .catch(() => {}),
      )
    }
    if (keys.includes('categories') && !loaded.value.categories) {
      tasks.push(
        request<any>('/api/asset/categories')
          .then((r: any) => {
            categories.value = r?.data || []
            loaded.value.categories = true
          })
          .catch(() => {}),
      )
    }
    await Promise.all(tasks)
  }

  function reset() {
    loaded.value = {}
  }

  /// 扁平化的组织列表（树 → 一维，供下拉选择）
  const flatOrgs = computed(() => {
    const out: any[] = []
    const walk = (arr: any[]) =>
      arr.forEach((o) => {
        out.push(o)
        walk(o.children || [])
      })
    walk(orgTree.value)
    return out
  })

  return { orgTree, depts, users, categories, flatOrgs, ensure, reset }
}
