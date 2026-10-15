import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

export const hashPwd = (pwd: string) => bcrypt.hashSync(pwd, 10)
export const verifyPwd = (pwd: string, hash: string) => bcrypt.compareSync(pwd, hash)

const secret = () => new TextEncoder().encode(useRuntimeConfig().jwtSecret)

export async function signJwt(payload: Record<string, any>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload
  } catch {
    return null
  }
}
