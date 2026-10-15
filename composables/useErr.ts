/// 统一提取接口错误信息；受保护接口的 401 视为会话过期并跳登录页
export function errMsg(e: any) {
  const status = e?.statusCode ?? e?.data?.statusCode
  const serverMsg = e?.data?.msg || e?.data?.message
  // h3 错误体带 url；登录/登出接口自身的 401 是「凭据错误」，不是会话过期：
  // 既不跳转、也不改写成「登录已过期」，否则用户看不到真正原因
  const url = String(e?.data?.url || e?.response?.url || '')
  const fromAuthApi = url.includes('/api/auth/')
  if (status === 401 && !fromAuthApi) {
    if (process.client) {
      // 会话已失效：必须清掉本地登录态，否则路由守卫会把「已登录」用户从 /login 弹回首页，
      // 用户会困在一个所有请求都失败的页面上
      const auth = useAuthStore()
      auth.user = null
      auth.perms = []
      useDictionaries().reset()
      navigateTo('/login')
    }
    return '登录已过期，请重新登录'
  }
  return serverMsg || e?.statusMessage || e?.message || '操作失败'
}
