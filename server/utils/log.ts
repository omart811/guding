import { getRequestIP } from 'h3'
import { prisma } from './prisma'

/// 记录操作日志，失败不影响业务
export async function opLog(event: any, data: { module: string; action: string }) {
  try {
    const u = event.context?.user
    await prisma.operationLog.create({
      data: {
        userId: u?.id,
        userName: u?.username,
        module: data.module,
        action: data.action,
        method: event.method,
        path: event.path,
        ip: getRequestIP(event, { xForwardedFor: true }) || '',
      },
    })
  } catch {
    // ignore
  }
}
