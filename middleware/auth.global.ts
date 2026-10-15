/// 全局路由守卫（服务端 + 客户端均生效，store 已在 plugins/auth.ts 中完成水合）
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (to.path === '/login') {
    if (auth.user) return navigateTo('/')
    return
  }
  if (!auth.user) return navigateTo('/login')
})
