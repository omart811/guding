# 固定资产管理系统 · 代码规范

> 适用范围：Nuxt3 + Element Plus + UnoCSS + Pinia + Prisma(SQLite) 一体化仓库。
> 原则：**精简优先、分模块迭代、不引入重型依赖**。新增代码必须与已有模块同构，宁可重复两行，也不要为"优雅"引入新的抽象层。

---

## 1. 目录与命名

| 位置 | 约定 |
| --- | --- |
| 接口 | `server/api/<模块>/<资源>/index.{get,post}.ts`、`[id].{get,put,delete}.ts`、`[id]/<动作>.{post,get}.ts` |
| 服务端工具 | `server/utils/*.ts`，一个领域一个文件（`prisma/rbac/log/resp/auth/user/asset/inventory`） |
| 中间件 | `server/middleware/auth.ts`（服务端 API 鉴权）；`middleware/*.global.ts`（前端路由守卫，后缀必须是 `.global`） |
| 页面 | 列表页 `pages/x/index.vue` + 详情页 `pages/x/[id].vue`，**禁止** `pages/x.vue` 与 `pages/x/[id].vue` 并存 |
| 前端 composable | `composables/useXxx.ts`；全局状态 `stores/*.ts` |
| 常量/枚举 | 服务端放 `server/utils/<领域>.ts`（`ASSET_STATUS`、`FLOW_TYPE`、`INV_RESULT`…），前端如需复用放 `shared/` |

命名：文件 kebab-case，组件/接口变量 camelCase，数据库字段 camelCase，权限 code 全小写冒号分层（`asset:ledger:add`）。

## 2. 服务端接口（强制）

每个 handler 的骨架固定为 **四段式**：

```ts
/// 一句话说明这个接口做什么（/// 注释，非 //）
export default defineEventHandler(async (event) => {
  // 1. 身份 + 权限
  const user = await requireUser(event)
  requirePerm(user, 'asset:ledger:add')

  // 2. 入参读取与校验（不校验就直接落库 = 事故）
  const b = await readBody(event)
  const { name, categoryId } = b || {}
  if (!name || !categoryId) return fail('资产名称和分类必填')

  // 3. 数据范围校验（单条操作必须做，见第 4 节）
  // 4. 业务 + 落库 + 日志
  await opLog(event, { module: 'asset', action: `新增资产 ${assetNo}` })
  return ok({ id })
})
```

硬性规则：

1. **响应统一** `ok(data, msg)` → `{ code: 0, data, msg }`；业务失败用 `fail(msg)`（抛 400）；鉴权 401；越权 403。禁止裸 `return { list }`。
2. **禁止吞异常**：不要写 `try { ... } catch { return ok() }` 掩盖 Prisma 报错；`opLog` 这种旁路逻辑才允许 catch。
3. **事务**：一次请求里多张表写入必须 `prisma.$transaction([...])`；批量流转、明细录入同理。
4. **写操作必记日志**：`await opLog(event, { module, action })`，module 用 `asset` / `system` / `auth`，action 写人话（含单号、条数）。
5. **分页必须封顶**：`const size = Math.min(Number(q.size) || 20, 100)`。导出类接口显式 `take` 上限并在 action 里记录条数。
6. **禁止把前端传来的值直接当 where**：`q.xxx` 只用于筛选字段，权限相关字段（orgId/deptId/keeperId/status）一律以服务端 `user` 为准重算。
7. **金额/日期**：`Number(x) || 0` 之前先判空；日期用 `new Date(str)`，区间结束补 `T23:59:59`。
8. **id 引用校验**：写入 `keeperId/orgId/deptId/categoryId/parentId` 前先查存在性，不存在返回 `fail`，不要让外键抛 500。
9. 服务端代码用 `event.path`，不要用 `getRequestURL()`。

## 3. 数据层（Prisma）

- 查询条件统一走工具函数：资产 `buildAssetWhere(user, q)`、盘点 `buildInventoryWhere(user, q)`、通用 `scopeWhere(user, fields)`。**禁止在各接口里手写 scope 分支**。
- 列表/详情统一用 `assetInclude` / `inventoryInclude`，避免字段散落。
- 关联文本解析用批量工具（`resolveFlowNames` / `resolveItemNames`），**禁止在循环里查库**（N+1）。
- 编号由服务端生成（`genAssetNo()` / `genInventoryCode()`），不接受前端传入。
- 快照类数据（盘点明细的 `assetNo/assetName/categoryName/expected*`）冗余落库后**不再回查资产表**。
- 改 `schema.prisma` 后流程：`prisma generate` → `prisma db push --force-reset` → `node prisma/seed.mjs` → 重启 dev。
- 新增权限点必须同步 `prisma/seed.mjs`（PERMS + 角色分配）与 `composables/useMenus.ts`。

## 4. 权限与数据范围（本项目最容易出错的地方）

三级：菜单（`asset:ledger`）→ 按钮（`asset:ledger:add`）。数据范围：ALL / ORG / DEPT / SELF，取用户所有角色中范围最大的一个。

- `requirePerm(user, code)` 只做功能权限，**不替代数据范围判断**。
- **列表**用 where 过滤；**单条（详情/编辑/删除/录入/导出）必须先校验可见性**，两种写法二选一：
  ```ts
  // A. 复用范围构造器（盘点单）
  const visible = await prisma.inventory.count({ where: { id, ...buildInventoryWhere(user, {}) } })
  if (!visible) return fail('盘点单不存在或无权操作')
  // B. 取出实体后比对归属字段（资产）
  if (!user.isSuper && user.scope === 'ORG' && asset.orgId !== user.orgId) return fail('无权操作该资产')
  ```
- 状态机与业务规则集中在服务端：流转只走 `flows/index.post.ts`，盘点状态流转只走 `inventories/[id].put.ts`，**禁止**在资产编辑接口里直接改 `status`。
- 状态与使用人强一致：无 keeper 不得停在 `IN_USE`，有 keeper 不得停在 `IN_STOCK`。

## 5. 前端规范

- 页面骨架：`toolbar`（筛选条，`card-base p-3 mb-3`）+ `card-base` 表格 + 分页。筛选条内控件显式给宽度。
- 请求统一 `$fetch`，错误统一 `errMsg(e)` + `ElMessage.error`，禁止 `catch {}` 空吞。
- 权限控制：`auth.can('asset:ledger:add')` 控制按钮/显隐，菜单由 `useMenus.ts` + `layouts/default.vue` 的 icons 映射登记（**新增菜单要同时改两处**）。
- 样式令牌一律用 `assets/css/main.css` 的 `:root` 变量（`--brand` / `--g-*` / `--border`），禁止写死新颜色；圆角 6/8/12，组件高 36px。
- UnoCSS 工具类已被 `postprocess` 追加 `!important`，不要再手动写 `!important`；改 `uno.config.ts` 后必须重启 dev。
- 登录态水合在 `plugins/auth.ts`，不要在页面里各自 `fetchMe`。
- 单文件超过 ~400 行就该拆子组件；状态字典不要在每个页面重复定义，移到 `shared/`。
- **树形选择器（`el-tree-select`）必须显式声明 `node-key`**：

  ```vue
  <el-tree-select
    v-model="form.categoryId"
    :data="categories"
    :props="{ label: 'name', children: 'children' }"
    node-key="id"
    check-strictly
    class="w-full"
  />
  ```

  原因：EP 内部取值键为 `nodeKey || valueKey || 'value'`（`tree-select/src/tree-select.vue` 的 `key` computed）。业务树节点只有 `id`，漏写 `node-key` 时所有节点取值都是 `undefined`，**点选后 `v-model` 拿不到值、界面无任何反应，且控制台不报错**。这类问题不会在渲染阶段暴露，必须实际点一次节点验证。
- 表单控件走 `el-form` + `prop` 校验；`el-select` 的 `:value` 一律绑 `id`（`<el-option :value="o.id">`），不要绑对象。
- **自定义全屏浮层打开期间必须自己吃掉 Esc**：否则 Esc 会冒泡到底层 `el-dialog` 的 overlay（EP `closeOnPressEscape` 默认 true），把表单弹窗一起关掉。写法：window 上用**捕获阶段**监听并 `stopPropagation()`，且只在浮层打开时拦截。
- **EP 默认 message/通知配色不达 WCAG**（成功字 2.07:1）：全局已在 `assets/css/main.css` 覆盖为语义深色；新增提示不要直接自设 EP 默认 type 配色。
- 无障碍基线（详见 `docs/ui-audit-2026-10-15.md`）：文字对比度 ≥4.5:1、非文本（边框/焦点环）≥3:1；`aria-label` 必须包含可见文本；EP 样式覆盖一律加 `html:root` 前缀（否则被运行时注入的 EP 样式盖掉）。

## 6. 安全红线

- `JWT_SECRET` 生产必须设置强随机值，**禁止**沿用 `dev-secret-change-me` / `change-me-in-production`。
- Cookie：httpOnly + sameSite=lax，HTTPS 环境加 `secure`。
- 密码：`hashPwd`（bcrypt cost 10），不明文落库、不写日志、接口不返回 `password` 字段（列表已用解构剔除，新增接口也要遵守）。
- 内置账号/角色保护：`admin`、`SUPER_ADMIN` 不可被非超管修改/删除/分配。
- 越权=事故：任何新增的"按 id 查一条"的接口，Review 时第一个问题永远是"数据范围校验在哪"。

## 7. 提交与 Review

- 一个模块一次提交，提交信息：`feat(asset): 新增盘点录入`、`fix(inventory): 详情接口补数据范围校验`。
- 提 PR 前按 `docs/review-checklist.md` 自查并勾选，未通过 P0 项的 PR 直接打回。
- 版本红线：`prisma/@prisma/client ^5.22.0`、`@unocss/nuxt` 与 `unocss` 锁 `66.8.0`，不得随手升级。
