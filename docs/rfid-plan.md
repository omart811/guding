# RFID 扫描枪 / 标签对接方案（讨论稿）

> 状态：**方案待评审**，代码未改动。等扫描枪厂商接口文档到位后再进入设计与实现。
> 目标场景：固定资产「批量盘点 → 领用/归还/调拨确认 → 标签绑定与打印」。

---

## 1. 先明确：两种落地形态

| | 方案 A：USB HID 扫枪 | 方案 B（推荐用于盘点）：蓝牙/2.4G 主动读卡器 |
| --- | --- | --- |
| 接入方式 | 即插即用，模拟键盘，页面聚焦输入框后自动输入 | 厂商 JS SDK / 本地 WebSocket 或 HTTP 服务 |
| 多标签连读 | 不支持，一条一回车，逐支刷 | 支持，一发多收，按一下连续采集 |
| 盘点效率 | 低（几百支枪扫半天） | 高（走过货架即完成） |
| 改造量 | 极小：一个受控输入框 | 中：设备接入层 + 连续扫描面板 |
| 依赖 | 无 | 需要厂商 Windows 驱动 / SDK / 本地服务 |

**M6 阶段建议**：数据层 + 标签绑定/打印先按「通用标签抽象」做（UHF RFID 与二维码共用一张表），扫描接入层按 A 做通（零依赖、当天可用），拿到 SDK 后再把盘点页升级成 B。

## 2. 数据层设计

核心思想：**EPC 与业务解耦**。EPC 是标签厂随机码，不与资产编号编进同一字段，用映射表关联；标签防换绑/错绑靠唯一约束与绑定校验。

```prisma
/// 资产标签（UHF RFID / 二维码共用）
model AssetTag {
  id        String    @id @default(cuid())
  assetId   String    // 关联资产
  epc       String    @unique // UHF EPC，大写十六进制；二维码传 TOKEN
  tid       String?   // UHF TID 只读码（防复制，可选）
  tagType   String    @default("UHF") // UHF / QR
  status    String    @default("ACTIVE") // ACTIVE 在用 / RETIRED 已换签
  printedAt DateTime? // 打印时间
  boundAt   DateTime  @default(now())
  boundBy   String?
  retiredAt DateTime? // 换签时间
  remark    String?
  asset     Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@index([assetId])
  @@map("asset_tags")
}
```

要点：
- `epc` 全局唯一：**防止同一标签绑到两个资产**，也防止一张卡走天下。
- `RETIRED` + `retiredAt`：换签保留历史，满足审计（哪张旧标签贴过这个资产）。
- 入库前由前一次绑定人写入 EPC，本系统只校验 EPC 唯一性 + 归属；不负责写芯片，避免和厂商写入流程耦合。
- 开关流程：`获取/打印新标签 → 系统登记 epc（未绑定）→ 贴到资产 → 扫描"绑定"`，未绑定的 EPC 扫描时报「新手标签」并引导绑定页。
- 盘点匹配用 `assetId`，**不用 assetNo**：资产编号快照在创建盘点单时冗余，换签后 EPC→assetId 仍准确，避免串盘。

预期新增权限点与菜单：

- 权限：`asset:tag:bind`（绑定/换签）、`asset:tag:print`（打印）、`asset:inventory:scan`（扫描盘点）
- 菜单：资产管理 →「标签管理」`/asset/tags`
- 同步：`prisma/seed.mjs` 的 PERMS + 角色分配；`composables/useMenus.ts` 与 `layouts/default.vue` 图标映射

## 3. 接口设计（前期，等厂商文档后校准）

```text
POST /api/asset/tags/scan/decode        { epcs: ["E200...", ...] }
  → { matched: [{epc, no: "ZC2024...", name, org, dept, keeper, status}],
      unbound: ["..."],               // 未绑定的新手标签
      retired: ["..."] }              // 已换签历史标签

POST /api/asset/tags/bind               { epc, assetId }
POST /api/asset/tags/unbind             { id }          // 换签：旧标签 RETIRED
GET  /api/asset/tags                    (标签台账，反查某资产的标签/打印记录)
POST /api/asset/tags/print              { ids: [] }     // 标记已打印 / 下发打印数据

POST /api/asset/inventories/:id/scan    { epcs: [...], scanner: "型号/工号" }
  → { stats, crossInventory: [...], duplicated: [...] }
  // 核心：按 epc → assetId → 该 item 置 result=NORMAL, checked=true, checkerId=当前用户
  // crossInventory：扫到的资产属于别的在途盘点单（防串盘）
  // unbound/notInScope：未绑定或不在本单范围，提示但不落库
```

关键业务规则（写进实现，先评审）：

1. **扫描只做 NORMAL 确认，不自动判 MISSING**。RFID 有漏读，未扫到的由人工复核后人工判盘亏，避免设备漏读直接产生盘亏差异（M4 已有 DONE 前全部已盘的规则，此策略与其兼容）。
2. **幂等**：同一 EPC 在一轮提交里重复出现只算一次；同资产在盘点明细里只有一条，重复扫描记 `duplicated` 不报错。
3. **换签即失效**：EPC 状态必须 ACTIVE 才算数，RETIRED 扫描结果进历史查询，不进盘点。
4. 盘点提交与 M4 现有 `check.post.ts` 归一：最终都是改 `InventoryItem.result/checked/checker`，复用同一套事务与 opLog。
5. 打印与绑定解耦：可先打印后绑定（现场贴标），绑定动作落在扫码后。

## 4. 前端交互

新增 `composables/useScanner.ts`（设备接入抽象，隔离 HID 与 SDK 两种来源）：

- **HID 模式**：受控 `<input>`，监听 Enter 提交一条；清洗大小写/空格/全角字符（中文输入法陷阱）；失焦自动保护，扫码间隔做 50–80ms 去抖；页面顶部显示「扫描枪就绪/忙碌」。
- **SDK 模式**：按厂商接口订阅扫描流（WebSocket 或轮询本地 HTTP），暂停/恢复、电量、蜂鸣控制（若支持）。

页面改动：

| 页面 | 新增 |
| --- | --- |
| 盘点详情 `/asset/inventories/[id]` | 「RFID 扫描」面板：开始/暂停、实时已扫数、差异提示（crossInventory/unbound）、按 epc 补搜 |
| 资产台账（新增/编辑） | 列表显示"已绑标签"，详情页「绑定/换签/打印」 |
| 标签管理 `/asset/tags` | 反查（扫 EPC 定位资产；输资产编号看标签历史/打印次数） |
| 工作台 | 扫码快速查资产弹窗（手持枪直接扫） |

## 5. 标签与打印

- 内容：EPC（人眼小字）+ 资产编号 ZC 码（大字/二维码）+ 名称/部门。
- 二维码部分用现成的 `qrcode`（package.json 已有）走 canvas 生成；**二维码 + RFID 混编可覆盖"近场无枪/手持 PDA 摄像头"场景**，作为无 RFID 设备时的兜底。
- 打印两条路线：浏览器定位打印模板（普通打印机，MVP）；ZPL/EPL 指令下发（Zebra/TSC 工业打印机，需要打印机型号与指令集）。
- 打印时校验：`epc` 已登记且 epc 与资产绑定关系一致；换签旧标签重新打印需提示。

## 6. 部署与现场

- Windows 单机 + PM2 不变；BLE/主动读卡器与浏览器同机；手机 H5 走局域网 IP（192.168.10.169 已验证可达）。
- 若接固定式读写器（入库门禁/自动盘点），再评估本地服务或 USB 直连方案，本方案暂不包含。

## 7. 需要你提供的信息（决定 MVP 工作量）

1. **扫描枪型号/通信方式**：USB HID？蓝牙 BLE？2.4G 接收器？手持 PDA（Android，自带 SDK）？
2. **厂商接口文档**：SDK 形式（JS SDK / 本地服务 / HTTP / WebSocket / 串口）、鉴权、Windows 驱动要求。
3. **数据格式**：EPC 输出（十六进制位数、大小写）、是否带 RSSI/天线/时间戳、连续模式、去重、蜂鸣控制。
4. **标签芯片**：Impinj Monza / NXP UCODE 系列/国产；TID 是否要求校验；User 区是否可写；封装（抗金属 ABS / 软标签 / PVC）。
5. **打印机型号与指令集**：ZPL / EPL / TSPL / ESC-POS，或只用普通 A4/标签打印机。
6. **是否需要出入库闸口/固定式读写器联动**。
7. **部署环境**：金属密集程度、最远扫描距离、每仓资产量级（决定标签选型）。

## 8. 风险与对策

| 风险 | 对策 |
| --- | --- |
| HID 扫枪无法多标签连读 | MVP 可接受；盘点量上来后升级 SDK 模式 |
| 输入法/前台焦点抢输入 | 受控输入框 + 字符清洗 + 焦点守护 |
| 漏读导致误判 | 扫描只确认存在；差异人工复核；允许扫多轮 |
| 换签后旧 EPC 扫到 | RETIRED 状态隔离 + 换签提示 |
| EPC 被复制 | 绑定/换签时校验 TID（若芯片支持） |
| 金属货架扫描失败 | 标签选型建议由你方提供现场照片后确认 |

---

## 9. 实施顺序（等你确认接口后再排期）

1. **M6a 数据层 + HID 扫描**：AssetTag 表、扫描解析、绑定/换签、标签台账、二维码兜底扫查。
2. **M6b 批量扫描盘点**：SDK 模式接入、盘点页 RFID 面板、串盘防护。
3. **M6c 标签打印与批量绑定**：打印模板/指令下发、批量换签工具、出入库防错确认。

评审重点：数据建模是否认可、扫描落地形态选 A 还是直接 B、「扫描不自动判 MISSING」的盘点策略是否可接受。等接口文档到了，我按第二节接口表给出最终字段与错误码。
