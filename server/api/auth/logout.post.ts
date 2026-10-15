import { verifyJwt } from '../../utils/auth'
import { opLog } from '../../utils/log'
import { ok } from '../../utils/resp'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'fam_token')
  if (token) {
    const payload = await verifyJwt(token)
    if (payload) event.context.user = { id: payload.sub as string, username: payload.username as string }
  }
  await opLog(event, { module: 'auth', action: '退出登录' })
  deleteCookie(event, 'fam_token', { path: '/' })
  return ok()
})
