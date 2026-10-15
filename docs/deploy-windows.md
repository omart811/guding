# Windows 部署指南（单机 · C:\fam · 端口 8001）

固定资产管理系统的**正式生产部署方式**。本文档记录的是 2026-10-15 在
`C:\Users\Administrator\Desktop\固定资产管理系统` 开发机（Windows 10/11）上
**实测跑通**的完整步骤，包括踩过的坑。

## 0. 前置条件

| 项 | 要求 |
|---|---|
| Node.js | 18+（部署机用 `C:\Program Files\nodejs\node.exe`，v24 实测通过） |
| 构建产物 | 本机 `.output/` 自包含（含 `.prisma/client` windows 引擎），**无需在服务器 `npm install`** |
| 数据库 | SQLite：`prisma/dev.db`，随产物一起复制 |
| 密钥 | `ecosystem.env.cjs`（**不入库**，见 `.gitignore`） |
| 端口 | 8001，需同时放行「系统防火墙入站规则」与路由器/安全组（如有） |

## 1. 构建（在开发机）

```powershell
cd C:\Users\Administrator\Desktop\固定资产管理系统
node node_modules\nuxt\bin\nuxt.mjs build
```

> 坑：本仓 `node_modules` 早期是 macOS 安装产物，`npm run build` 会报
> "nuxt: not found"（`.bin` 缺 Windows 垫片）。直接用 `node` 调 nuxt 入口即可。

## 2. 生成密钥（仅一次）

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

把结果写进 `ecosystem.env.cjs`：

```js
module.exports = { JWT_SECRET: '<随机值，至少 32 字节>' }
```

该文件已被 `.gitignore` 排除，**切勿提交**。

## 3. 复制产物到部署目录

```powershell
mkdir C:\fam\prisma
xcopy /E /I /Y .output C:\fam\.output
copy prisma\dev.db C:\fam\prisma\dev.db
copy ecosystem.env.cjs C:\fam\
copy start-prod.cmd C:\fam\
```

## 4. 启动脚本 start-prod.cmd

随仓库提供（纯 ASCII + **CRLF 换行**）。两个历史坑：

- **LF 换行会让 cmd.exe 解析错乱**：`set PORT=8001` 之后的所有行被吞，
  服务静默跑到默认 3000 端口。写入后务必 `unix2dos` 或编辑器存为 CRLF。
- 脚本内**不要写中文注释**：PowerShell 注册计划任务时非 ASCII 会被吞掉，
  导致 `WorkingDirectory` 丢失，相对路径 `file:./dev.db` 解析到
  `C:\Windows\System32\prisma\dev.db`。

脚本要点：`cd /d "%~dp0"` → 读 `ecosystem.env.cjs` 取密钥 →
`node .output\server\index.mjs` 并追加日志到 `logs\prod.log`。

## 5. 注册开机自启计划任务

以 **SYSTEM** 身份 + 最高权限运行（无需交互登录即可拉起），触发器
`AtStartup` + `AtLogOn`，崩溃自动重启 3 次：

```powershell
$action   = New-ScheduledTaskAction -Execute 'C:\fam\start-prod.cmd' -WorkingDirectory 'C:\fam'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
             -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$trigger  = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn))
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'FAM-Asset-Server' -Action $action -Trigger $trigger `
             -Settings $settings -Principal $principal -Force
Start-ScheduledTask -TaskName 'FAM-Asset-Server'
```

> 坑：本环境 **PM2 不可用**——守护进程会在工具调用结束时被子进程树回收
> （`pm2 list` 显示 online 但端口无人监听）。Windows 单机部署请直接用
> 计划任务；`ecosystem.config.cjs` 保留给习惯 PM2 的环境（已把端口改成
> 8001、显式指定 `interpreter`）。

## 6. 防火墙（必须）

```powershell
New-NetFirewallRule -DisplayName 'FAM Asset Server 8001' -Direction Inbound `
  -Protocol TCP -LocalPort 8001 -Action Allow -Profile Any
```

> 坑：**没有这条规则时本机 curl 127.0.0.1:8001 是通的**（走环回路径绕过
> 防火墙），但局域网内其他机器全部连不上，极易误判为「部署没问题」。

## 7. 验证清单

```powershell
# 1. 监听 0.0.0.0:8001（不能是 127.0.0.1，否则外网不可达）
netstat -ano | findstr ":8001"

# 2. 登录页 SSR
curl -s -o NUL -w "%{http_code}" http://localhost:8001/login          # 200

# 3. 登录接口
curl -s -X POST -H "Content-Type: application/json" ^
     -d "{\"username\":\"admin\",\"password\":\"Admin@123\"}" ^
     -c cookie.txt http://localhost:8001/api/auth/login               # 返回 token

# 4. 受保护接口（带 cookie）
curl -s -b cookie.txt "http://localhost:8001/api/asset/assets?size=1"

# 5. 未登录直闯受保护接口 → 401
curl -s -o NUL -w "%{http_code}" http://localhost:8001/api/asset/assets

# 6. 局域网视角（换成自己的 IP）
curl -s -o NUL -w "%{http_code}" http://192.168.x.x:8001/login        # 200
```

预期：1 200 / 2 拿到 token / 3 返回数据 / 4 401 / 5 200。

## 8. 日常运维

| 操作 | 命令 |
|---|---|
| 看日志 | `type C:\fam\logs\prod.log` 或 `Get-Content -Tail 50 -Wait` |
| 重启 | `Restart-ScheduledTask -TaskName 'FAM-Asset-Server'` |
| 停止 | `Stop-ScheduledTask -TaskName 'FAM-Asset-Server'` |
| 换密钥 | 改 `ecosystem.env.cjs` 后 `Restart-ScheduledTask`（会踢掉所有登录会话） |
| 更新部署 | 重新 `build` → 停任务 → 覆盖 `.output` 与 `prisma\dev.db` → 启任务 |

## 9. 已知限制

- SQLite 单文件：并发写性能有限，适合单机/小团队；数据量增长后按
  `schema.prisma` 的 datasource 切换 MySQL 即可。
- 无 HTTPS：局域网可用；若暴露公网，前面请加反向代理（IIS/Caddy）终结 TLS。
- 首次种子账号：`admin / Admin@123`、`zhangsan / Zhang@123`、
  `lisi / Li@1234`。**生产首登后必须改密。**
