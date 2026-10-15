export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as null | {
      id: string
      username: string
      name: string
      scope: string
      org?: { name: string } | null
      roles: { id: string; code: string; name: string }[]
    },
    perms: [] as string[],
  }),
  getters: {
    isSuper: (s) => !!s.user?.roles?.some((r) => r.code === 'SUPER_ADMIN'),
  },
  actions: {
    async login(username: string, password: string) {
      const res: any = await $fetch('/api/auth/login', { method: 'POST', body: { username, password } })
      this.user = res.data
      this.perms = res.data.perms
      // 换账号后字典缓存（组织/部门/用户范围）必须失效
      useDictionaries().reset()
    },
    /// 服务端渲染时用 useRequestFetch 透传 Cookie；客户端等价于 $fetch
    async fetchMe() {
      try {
        const res: any = await useRequestFetch()('/api/auth/me')
        this.user = res.data
        this.perms = res.data.perms
      } catch {
        this.user = null
        this.perms = []
      }
    },
    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // ignore
      }
      this.user = null
      this.perms = []
      useDictionaries().reset()
    },
    can(code: string) {
      if (this.isSuper) return true
      return this.perms.includes(code)
    },
  },
})
