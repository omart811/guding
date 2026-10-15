import { getMe } from '../../utils/user'
import { verifyJwt } from '../../utils/auth'
import { ok, fail } from '../../utils/resp'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'fam_token')
  const payload = token ? await verifyJwt(token) : null
  if (!payload) return fail('未登录')
  const me = await getMe(payload.sub as string)
  if (!me || me.status !== 1) return fail('用户不存在或已禁用')
  return ok(me)
})
