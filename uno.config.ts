import { defineConfig, presetWind } from 'unocss'

export default defineConfig({
  presets: [presetWind()],
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    // card-base 定义在 assets/css/main.css（含边框、圆角、阴影），此处不再重复
  },
  // 让工具类具备最高优先级：Element Plus 的组件样式（如 .el-input{width:100%}）
  // 优先级与工具类相同但加载更晚，会把 w-[220px] 这类宽度覆盖掉。
  postprocess: (util) => {
    util.entries.forEach((e) => {
      const v = e[1]
      if (typeof v === 'string' && !v.includes('!important')) e[1] = `${v} !important`
    })
  },
})
