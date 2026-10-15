import { PrismaClient } from '@prisma/client'
import { resolve } from 'node:path'

/// Prisma 客户端运行时的相对路径按进程 cwd 解析，而 CLI 按 schema 目录（prisma/）解析，
/// 这里把相对 SQLite 路径统一指向 prisma/ 下的库文件，保证 CLI 与运行时打开同一个库。
const envUrl = process.env.DATABASE_URL || 'file:./dev.db'
const dbUrl =
  envUrl.startsWith('file:') && !envUrl.startsWith('file:/')
    ? `file:${resolve(process.cwd(), 'prisma', envUrl.slice('file:'.length))}`
    : envUrl

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(dbUrl === envUrl ? undefined : { datasources: { db: { url: dbUrl } } })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
