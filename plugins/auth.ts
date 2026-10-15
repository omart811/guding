/// 服务端与客户端均执行：SSR 时带上请求 Cookie 拉取登录态，
/// 保证首屏渲染即有菜单与用户信息，避免未登录进入后台。
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (!auth.user) await auth.fetchMe()
})
