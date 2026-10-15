/// 统一提取接口错误信息；401 时跳转登录页
export function errMsg(e: any) {
  if (e?.statusCode === 401 || e?.data?.statusCode === 401) {
    if (process.client) navigateTo('/login')
    return '登录已过期，请重新登录'
  }
  return e?.data?.msg || e?.data?.message || e?.statusMessage || e?.message || '操作失败'
}
