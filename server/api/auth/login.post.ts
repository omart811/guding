import { prisma } from '../../utils/prisma'
import { getMe } from '../../utils/user'
import { verifyPwd, signJwt } from '../../utils/auth'
import { ok, fail } from '../../utils/resp'
import { opLog } from '../../utils/log'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body || {}
  if (!username || !password) return fail('请输入用户名和密码')
  const row = await prisma.user.findUnique({ where: { username } })
  // 未找到用户与密码错误合并提示，避免暴露「某用户名是否存在」
  if (!row || !verifyPwd(password, row.password)) return fail('用户名或密码错误', 401)
  if (row.status !== 1) return fail('账号已停用，请联系管理员', 401)
  const me = await getMe(row.id)
  const token = await signJwt({ sub: me!.id, username: me!.username })
  setCookie(event, 'fam_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  await opLog(event, { module: 'auth', action: '登录' })
  return ok(me)
})
