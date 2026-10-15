# 代码审查报告 · 2026-10-14

**范围**：全量代码（server 51 个 TS、pages 11 个 Vue、composables/stores/layouts、prisma schema + seed、构建配置）
**代码量**：约 4.5k 行（不含 node_modules）
**结论**：整体结构清晰、分层一致（utils 复用、四段式 handler、数据范围集中处理），M1–M4 的模块约定执行到位。**但有 2 处真实越权漏洞（已修复）+ 4 项安全配置风险需上线前处理**。

---

## 一、已修复（本次直接改动）

| # | 级别 | 位置 | 问题 | 处理 |
| --- | --- | --- | --- | --- |
| 1 | **P0** | `server/api/asset/inventories/[id].get.ts` | 盘点单详情只校验了功能权限，**未做数据范围校验**。同模块 `check/put/delete` 都用 `buildInventoryWhere` 校验，唯独详情没有 → 分公司管理员可凭 id 读取其他分公司盘点单的全部资产明细（IDOR） | 补 `buildInventoryWhere` 可见性校验 |
| 2 | **P0** | `server/api/asset/inventories/[id]/export.get.ts` | 同上，导出接口可直接导出他组织盘点明细（数据外泄面更大） | 同上 |

> 修复方式与同模块既有写法完全一致，仅新增 2 行查询，无副作用。

## 二、待处理（建议上线前）

### P0 · 安全
3. **JWT 密钥弱值**：`nuxt.config.ts` 默认 `dev-secret-change-me`，`ecosystem.config.cjs` 写死 `change-me-in-production`。任何人可用已知密钥伪造 token（且超管权限）。→ 生产用 `.env` 注入强随机值，并在 `server/middleware/auth.ts` 启动时校验 `NODE_ENV=production && jwtSecret 为默认值` 则直接抛错退出。
4. **登录无限流**：`auth/login.post.ts` 无失败计数/锁定/验证码，可暴力撞库。→ 加同 IP + 用户名失败计数（内存计数或日志表统计），5 次失败锁定 10 分钟。
5. **Cookie 未设 secure**：`sameSite=lax`、`httpOnly` 已有，但缺 `secure`，HTTPS 部署下会被降级。→ 按 `NODE_ENV` 追加 `secure: true`。
6. **seed 默认密码入库**：`Admin@123 / Zhang@123 / Li@1234` 写死在 `seed.mjs`，若不改即上生产等于公开口令。→ 部署脚本强制改密或首次登录强制修改。

### P1 · 正确性与健壮性
7. **资产详情漏 DEPT 数据范围**：`assets/[id].get.ts` 只判了 `ORG` 与 `SELF`，**DEPT 范围用户可查看任意部门的资产详情**（与列表口径不一致，列表走 `buildAssetWhere`）→ 补 DEPT 分支或改用 `buildAssetWhere` count。
8. **分页无上限**：`assets/index.get.ts`、`system/users/index.get.ts`、`system/logs.get.ts`、`flows/index.get.ts` 均为 `Number(q.size) || 20`，传 `size=100000` 可拖垮内存 → `Math.min(..., 100)`。
9. **关联 id 不校验**：`keeperId/orgId/deptId/toKeeperId/parentId` 均直接写入，传不存在的 id 会由外键抛 500 而非 400（如 `assets/index.post.ts`、`flows/index.post.ts`、`orgs/index.put.ts`）。
10. **金额可被改坏**：`assets/[id].put.ts` 允许 `originalValue` 传负数、`netValue` 与 `accumulated` 各自独立赋值，可出现「净值 > 原值」「累计折旧为负」→ 加非负校验与 `netValue = originalValue - accumulated` 一致性校验。
11. **状态可绕过状态机**：资产编辑接口接受任意 `status`，可直接改成 `SCRAPPED`，M5 的报废/折旧流程会被绕过 → 编辑接口白名单化（只允许改基础信息），状态变更走专用接口。
12. **树结构可成环**：`orgs/[id].put.ts`、`categories/[id].put.ts` 未校验 `parentId` 指向自身或子孙 → 保存前查子树，禁止自引用。
13. **盘点明细 take 硬编码**：`inventories/[id].get.ts` 明细 `take: 2000` 且无分页，大范围盘点单会截断/卡顿 → 明细分页或提示。
14. **权限 code 语义混用**：`inventories/[id].put.ts` 的「编辑」分支复用 `asset:inventory:add`，用户只有新增权限即可改盘点单 → 拆 `asset:inventory:edit`（需同步 seed + 菜单）。
15. **未登录返回码错误**：`auth/me.get.ts` 用 `fail()` 抛 400，语义应为 401；前端 `errMsg` 已按 401 处理跳转，此处会导致登录过期时提示不友好。

### P2 · 可维护性
16. **状态字典重复定义**：`ASSET_STATUS` 在 `server/utils/asset.ts`，但 `pages/asset/ledger.vue`、`pages/asset/inventories/[id].vue` 各写了一份映射（含 tag 类型）→ 抽到 `shared/constants.ts` 前后端共用。
17. **`any` 泛滥**：`requireUser/requirePerm/scopeWhere` 的 `user: any`、`opLog(event: any)`、`buildAssetWhere` 返回 `any` → 定义 `MeUser` 类型（`server/utils/user.ts` 返回值即事实标准），where 用 `Prisma.AssetWhereInput`。
18. **深层相对导入**：`../../../../utils/prisma` 满屏，易错且难重构 → 改用 Nuxt 的 `#server/utils/*` 别名。
19. **工具函数风格不一致**：`resolveFlowNames` 返回 `{ text }`，`resolveItemNames` 返回数组，同类需求两种形态 → 统一为「传入数组、返回增强数组」。
20. **同步 bcrypt**：`hashPwd = bcrypt.hashSync(..., 10)` 阻塞事件循环，注册/重置密码时约 60–100ms → 改 `bcrypt.hash` 异步版。
21. **SQLite 库文件入库**：`prisma/dev.db` 随仓库走，且生产仍是 `file:./dev.db` → 生产切 MySQL（改 datasource）前至少把 db 加入 `.gitignore` 并做定时备份。
22. **验证脚本未纳入工程**：`verify-*.mjs` / `smoke.mjs` 散落且默认端口不统一 → 归入 `scripts/` 并在 `package.json` 暴露 `npm run verify`。
23. **前端单文件偏大**：`pages/asset/ledger.vue`、`inventories/[id].vue` 逻辑与视图混杂近 400+ 行 → 拆筛选栏/表格/表单子组件。

## 三、做得好的地方（保持）

- 数据范围集中：`scopeWhere` / `buildAssetWhere` / `buildInventoryWhere` 三处统一出口，列表与导出复用同一 where。
- 盘点明细用创建时快照 + 冗余字段，执行期资产变动不影响盘点口径，设计正确。
- 批量解析（`resolveFlowNames`/`resolveItemNames`）避免了 N+1。
- 事务使用到位：流转、盘点录入、角色权限重分配都在 `$transaction` 内。
- 内置账号/角色保护、自删除保护、超管角色分配保护都已实现。
- 框架踩坑已固化（`.global.ts` 路由守卫、plugins 水合、`#important` postprocess 等）。

## 四、建议的修复顺序

1. 本次已修的 2 处越权 → 回归测试（分公司账号访问他组织盘点单详情/导出应 400）
2. P0 第 3–6 项（密钥、限流、secure、默认密码）——**上线阻塞项**
3. P1 第 7、8 项（DEPT 越权、分页封顶）——风险/成本比最高
4. 其余 P1 随 M5（报废+折旧）一并处理，P2 登记技术债
