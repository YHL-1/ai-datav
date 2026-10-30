/**
 * 内置实时演示数据接口：供「接入 API」数据源测试用，每次请求返回随时间波动的数据。
 */
import type { FastifyInstance } from 'fastify'

const CITIES = ['杭州', '上海', '深圳', '北京', '成都', '广州']
const CHANNELS = ['自然搜索', '信息流', '社交媒体', '邮件营销', '直接访问']

function wobble(base: number, ratio = 0.12): number {
  return Math.round(base * (1 - ratio + Math.random() * ratio * 2))
}

function stamp(): string {
  return new Date().toISOString().slice(11, 19)
}

export async function demoLiveRoutes(app: FastifyInstance): Promise<void> {
  app.get('/demo/live/sales', async () => ({
    _updatedAt: stamp(),
    data: CITIES.map((city, index) => ({
      城市: city,
      销售额: wobble(1280 - index * 140, 0.18),
      订单数: wobble(420 - index * 42, 0.16),
    })),
  }))

  app.get('/demo/live/traffic', async () => ({
    _updatedAt: stamp(),
    data: CHANNELS.map((channel, index) => ({
      渠道: channel,
      访问量: wobble(960 - index * 120, 0.2),
      转化率: `${(2.4 + Math.random() * 2.6).toFixed(1)}%`,
    })),
  }))
}
