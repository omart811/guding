/// 二维码生成：把文本渲染为 SVG data URL
///
/// 设计要点：
/// 1. 动态 import —— `qrcode` 不进首屏 bundle，只在真正要出码时才加载；
/// 2. SVG 是矢量 —— 打印任意尺寸都不糊，因此生成时的 width 只是标称值，
///    实际显示尺寸一律由 CSS 控制（见 main.css 的 .asset-label__qr）；
/// 3. 结果按「文本@标称尺寸」缓存 —— 同一资产反复出码不重复计算。

let loader: Promise<any> | null = null
const cache = new Map<string, string>()

function lib() {
  if (!loader) {
    loader = import('qrcode').then((m: any) => m?.default ?? m)
  }
  return loader
}

export function useQrcode() {
  async function svg(text: string, nominal = 240): Promise<string> {
    const key = `${text}@${nominal}`
    const hit = cache.get(key)
    if (hit) return hit
    const QRCode = await lib()
    const raw: string = await QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: nominal,
      errorCorrectionLevel: 'M',
    })
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`
    cache.set(key, url)
    return url
  }

  return { svg }
}

/// 二维码载荷：直接编码**资产编号**（如 ZC202610150001）。
///
/// 为什么不用 URL：本系统内网部署，扫码枪键入编号即可在台账搜索框直接定位，
/// 不依赖域名、端口与登录态，断网也能人工核对。
/// 将来若要「手机扫码直达资产详情」，只需把这里改成返回
/// `${location.origin}/asset/a/${assetNo}`，并在 pages/asset 下补一个详情路由即可。
export function qrPayload(a: { assetNo?: string } | null | undefined): string {
  return String(a?.assetNo || '')
}
