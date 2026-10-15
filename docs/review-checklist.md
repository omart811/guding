# Code Review 检查清单

> 提交PR前自查 / Reviewer逐项核对。**P0 项任一未过 → 直接打回**；P1 需给出理由或跟进单；P2 可留作技术债登记。
> 配套规范见 `docs/code-standards.md`。

---

## P0 · 安全与越权（阻塞合并）

- [ ] **单条查询有数据范围校验**：`[id].get/put/delete`、以及该 id 下的子动作（录入、导出），要么用 `buildXxxWhere` count 一次，要么取出实体后比对 `orgId/deptId/keeperId`。
- [ ] **功能权限与数据范围同时校验**：只有 `requirePerm()` 没有 scope 判断 = 越权。
- [ ] **未把前端传入的值当作权限依据**：`orgId/deptId/keeperId/status` 以服务端 `user` 重算，不接受 body/query 直接落库。
- [ ] **写操作落在事务里**：多表写入（资产 + 流水、盘点 + 明细）必须 `$transaction`。
- [ ] **密码/密钥处理**：不明文落库、不出现在响应与日志；列表接口已剔除 `password`。
- [ ] **不吞异常**：无 `catch {}` 空实现（旁路日志除外），Prisma 报错不得被转成 `ok()`。
- [ ] 内置保护：`admin` 账号、`SUPER_ADMIN` 角色不可被非超管增删改；非超管不可给自己/他人分配超管角色。

## P1 · 正确性与健壮性

- [ ] **入参校验完整**：必填判空、枚举值校验（状态/类型/结果）、数组非空、`Number()` 前判空、日期解析合法。
- [ ] **关联 id 存在性**：`categoryId/orgId/deptId/keeperId/parentId` 写入前查库，不存在返回 `fail` 而非 500。
- [ ] **状态机未被绕过**：资产状态只能通过流转/报废接口变更；盘点 `DONE` 后禁止录入/编辑/删除，完成前必须全部已盘。
- [ ] **分页/导出有上限**：`size` 封顶（≤100），导出显式 `take` 上限。
- [ ] **无 N+1**：循环里没有 `findUnique/findMany`；批量解析走 `resolveFlowNames` / `resolveItemNames`。
- [ ] **写入即日志**：新增/编辑/删除/流转/盘点/导出都调用了 `opLog`，action 含单号与条数。
- [ ] **响应格式统一** `ok()` / `fail()`，前端统一 `errMsg()` 提示。
- [ ] 新增权限点已同步：`prisma/seed.mjs`（PERMS + 角色分配） + `composables/useMenus.ts` + `layouts/default.vue` 图标映射。
- [ ] 改了 schema：`generate` → `db push` → `seed` → 重启验证过；列表/导出/详情三处字段一致。
- [ ] **树形选择器必须写 `node-key`**：`<el-tree-select :data="tree" :props="{label:'name',children:'children'}" node-key="id" />`。EP 的取值键是 `nodeKey \|\| valueKey \|\| 'value'`，业务数据只有 `id` 时若漏写 `node-key`，**每个节点取值恒为 `undefined`，点选无任何反应且不报错**（静默失效）。改完必须实际点一次节点验证，不能只看渲染。

## P2 · 可维护性与风格

- [ ] 复用既有工具：查询条件不用手写 scope 分支；编号用 `genXxx()`；字典常量不重复定义（页面里不再各写一份 `IN_STOCK:'在库'`）。
- [ ] 服务端 handler 保持四段式（鉴权 → 校验 → 范围 → 业务+日志），函数体超过 ~80 行考虑拆到 `server/utils/`。
- [ ] 无 `console.log` / `debugger` / 注释掉的代码；无 `TODO` 不写明责任与期限。
- [ ] 类型尽量收敛：`any` 只出现在 where 构造等必要处，用户对象建议统一类型而非 `user: any`。
- [ ] 前端：新增菜单两处登记、路由目录为 `pages/x/index.vue` + `pages/x/[id].vue`、样式走 `:root` 令牌、无死色值。
- [ ] 依赖未越红线：`prisma/@prisma/client ^5.22.0`、`@unocss/nuxt`+`unocss` 66.8.0 未被动过。
- [ ] 单文件 >400 行的页面已考虑拆子组件。

## 模块专项

**资产台账**
- [ ] 列表 / 统计 / 导出三处使用同一个 `buildAssetWhere`
- [ ] 新增资产同时写入 `IN` 流水
- [ ] 金额非负；净值 = 原值 - 累计折旧（编辑时校验不被改坏）

**流转**
- [ ] 批量 + 单事务；`ISSUE` 只在 `IN_STOCK`；`RETURN` 只在 `IN_USE` 且清空 keeper
- [ ] 跨公司调拨仅超管，且清空 dept/keeper
- [ ] 状态与 keeper 强一致（无 keeper 不停 `IN_USE`，有 keeper 不停 `IN_STOCK`）

**盘点**
- [ ] 明细是创建时的账面快照，执行期资产变动不影响盘点口径
- [ ] 已报废/处置资产不纳入范围
- [ ] 录入接口两种形态（逐条 / 批量）都校验明细归属本单
- [ ] `result = PENDING` 等价于撤销盘点（清空盘点人与时间）

## 提 PR 模板

```
变更内容：
影响模块：asset / system / auth
自查：P0 全过 ☐    P1 全过 ☐    已跑 db push + seed ☐    已本地起服务验证 ☐
验证方式：（接口名 + 预期结果，或截图）
```
