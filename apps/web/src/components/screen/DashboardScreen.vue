<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EChart from '@/components/screen/EChart.vue'
import Icon from '@/components/ui/Icon.vue'
import { C, donutOption, mapOption, sparkOption, trendOption } from '@/lib/chartOptions'

const now = ref(new Date())
let timer = 0

const pad = (n: number) => String(n).padStart(2, '0')
const timeMain = computed(() => `${pad(now.value.getHours())}:${pad(now.value.getMinutes())}`)
const timeSeconds = computed(() => pad(now.value.getSeconds()))
const dateLabel = computed(() => {
  const d = now.value
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${week}`
})

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))

const sparkA = sparkOption([18, 24, 22, 31, 29, 38, 36, 48, 45, 53, 51, 62], C.mint)
const sparkB = sparkOption([14, 20, 16, 25, 23, 31, 29, 37, 42, 40, 47, 52], C.cyan)
const sparkC = sparkOption([30, 28, 33, 31, 36, 34, 40, 38, 44, 46, 45, 49], C.amber)
const sparkD = sparkOption([12, 18, 16, 24, 22, 30, 28, 35, 38, 42, 47, 51], C.violet)
const trend = trendOption()
const donut = donutOption()
const map = mapOption()
</script>

<template>
  <div class="dash-screen">
    <div class="dash-frame">
      <header class="dash-header">
        <div class="dash-brand">
          <span class="dash-mark">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 19V5l14 14V5"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path d="M5 5h3.5M15.5 19H19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </span>
          <div>
            <b>NEXA</b>
            <span>EAST CHINA · OPERATIONS</span>
          </div>
        </div>
        <div class="dash-title">
          <span class="dash-kicker">REAL-TIME COCKPIT</span>
          <h1>华东区域 · 实时经营驾驶舱</h1>
        </div>
        <div class="dash-clock">
          <div class="dash-time">{{ timeMain }}<span>:</span>{{ timeSeconds }}</div>
          <div class="dash-date">
            {{ dateLabel }}
            <span class="dash-live"><i class="dot dot--live" /> 实时接入</span>
          </div>
        </div>
      </header>

      <main class="dash-body">
        <section class="dash-col">
          <div class="kpi-grid">
            <article class="dash-kpi" style="--kc: #5ef2c2">
              <div class="dash-kpi-label">今日交易额 <span class="kpi-ic"><Icon name="chart-line" :size="16" /></span></div>
              <div class="dash-kpi-value">2,846<small>万</small></div>
              <div class="dash-kpi-foot">
                <span><span class="dash-kpi-delta">+18.6%</span> 较昨日</span>
                <div class="dash-kpi-spark"><EChart :option="sparkA" /></div>
              </div>
            </article>
            <article class="dash-kpi" style="--kc: #54c8e8">
              <div class="dash-kpi-label">订单总量 <span class="kpi-ic"><Icon name="chart-bar" :size="16" /></span></div>
              <div class="dash-kpi-value">18,420<small>单</small></div>
              <div class="dash-kpi-foot">
                <span><span class="dash-kpi-delta">+12.4%</span> 较昨日</span>
                <div class="dash-kpi-spark"><EChart :option="sparkB" /></div>
              </div>
            </article>
            <article class="dash-kpi" style="--kc: #f6c37a">
              <div class="dash-kpi-label">客单价 <span class="kpi-ic"><Icon name="zap" :size="16" /></span></div>
              <div class="dash-kpi-value">1,546<small>元</small></div>
              <div class="dash-kpi-foot">
                <span><span class="dash-kpi-delta">+5.2%</span> 较昨日</span>
                <div class="dash-kpi-spark"><EChart :option="sparkC" /></div>
              </div>
            </article>
            <article class="dash-kpi" style="--kc: #a78bfa">
              <div class="dash-kpi-label">同比增长 <span class="kpi-ic"><Icon name="sparkles" :size="16" /></span></div>
              <div class="dash-kpi-value">23.8<small>%</small></div>
              <div class="dash-kpi-foot">
                <span><span class="dash-kpi-delta">连续 6 周</span> 上升</span>
                <div class="dash-kpi-spark"><EChart :option="sparkD" /></div>
              </div>
            </article>
          </div>

          <section class="dash-panel rank-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">区域销售排行</div>
              <span class="dash-panel-tag">TOP 05 / GMV</span>
            </div>
            <div class="rank-list">
              <div class="rank-row"><span class="rank-no">01</span><span class="rank-name">上海</span><span class="rank-bar"><i style="width: 96%" /></span><span class="rank-val">9,682</span></div>
              <div class="rank-row"><span class="rank-no">02</span><span class="rank-name">杭州</span><span class="rank-bar"><i style="width: 88%" /></span><span class="rank-val">8,840</span></div>
              <div class="rank-row"><span class="rank-no">03</span><span class="rank-name">苏州</span><span class="rank-bar"><i style="width: 82%" /></span><span class="rank-val">7,426</span></div>
              <div class="rank-row"><span class="rank-no">04</span><span class="rank-name">南京</span><span class="rank-bar"><i style="width: 76%" /></span><span class="rank-val">6,918</span></div>
              <div class="rank-row"><span class="rank-no">05</span><span class="rank-name">宁波</span><span class="rank-bar"><i style="width: 71%" /></span><span class="rank-val">5,642</span></div>
            </div>
          </section>

          <section class="dash-panel event-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">实时事件</div>
              <span class="dash-panel-tag"><b>04</b> 条 / 直播</span>
            </div>
            <div class="event-list">
              <div class="event-item">
                <span class="event-time">14:31</span>
                <div class="event-body">
                  <div class="event-text">上海静安店 <b>交易额突破 120 万</b>，环比 +26%</div>
                  <div class="event-meta"><i class="event-dot" /> 门店 · 静安嘉里中心</div>
                </div>
              </div>
              <div class="event-item">
                <span class="event-time">14:28</span>
                <div class="event-body">
                  <div class="event-text">杭州区域 <b>订单量达成本周峰值</b>，当前 2,846 单</div>
                  <div class="event-meta"><i class="event-dot" style="--ec: #54c8e8" /> 区域 · 杭州</div>
                </div>
              </div>
              <div class="event-item">
                <span class="event-time">14:24</span>
                <div class="event-body">
                  <div class="event-text">宁波江北店 <b>客流异常回落</b>，低于预测值 18%</div>
                  <div class="event-meta"><i class="event-dot" style="--ec: #f6c37a" /> 预警 · 待关注</div>
                </div>
              </div>
              <div class="event-item">
                <span class="event-time">14:19</span>
                <div class="event-body">
                  <div class="event-text"><b>线上商城渠道</b> 占比提升至 46%，创本月新高</div>
                  <div class="event-meta"><i class="event-dot" style="--ec: #a78bfa" /> 渠道 · 线上商城</div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <section class="dash-col">
          <section class="dash-panel map-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">区域经营热力分布</div>
              <span class="dash-panel-tag">GEO / PROVINCE · <b>34</b> 省级</span>
            </div>
            <div class="map-toolbar">
              <span class="map-tool is-on">热力</span>
              <span class="map-tool">点位</span>
              <span class="map-tool">流向</span>
            </div>
            <div class="dash-map"><EChart :option="map" /></div>
            <div class="map-legend">
              <span class="lg"><i /> 高活跃</span>
              <span class="lg"><i /> 增长节点</span>
              <span class="lg" style="color: #4e686e">数据更新 14:32:06</span>
            </div>
            <div class="map-scale">1 : 18,000,000</div>
          </section>

          <section class="dash-panel insight-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">经营洞察</div>
              <span class="dash-panel-tag">AI GENERATED · 3 INSIGHTS</span>
            </div>
            <div class="insight-body">
              <div class="insight">
                <div class="insight-label">峰值时段</div>
                <div class="insight-value">14:00–15:00<small>UTC+8</small></div>
                <div class="insight-sub"><span class="dot dot--live" /> 当前仍处于高位</div>
              </div>
              <div class="insight">
                <div class="insight-label">华东贡献占比</div>
                <div class="insight-value">68.4<small>%</small></div>
                <div class="insight-sub"><span class="dot" style="background: #54c8e8" /> 较上周 +2.6%</div>
              </div>
              <div class="insight">
                <div class="insight-label">异常门店</div>
                <div class="insight-value">02<small>家</small></div>
                <div class="insight-sub"><span class="dot" style="background: #f6c37a" /> 建议 30 分钟内复核</div>
              </div>
            </div>
          </section>
        </section>

        <section class="dash-col">
          <section class="dash-panel trend-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">交易趋势</div>
              <span class="dash-panel-tag">24H · <b>1H</b> 粒度</span>
            </div>
            <div class="trend-chart"><EChart :option="trend" /></div>
          </section>

          <section class="dash-panel donut-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">渠道构成</div>
              <span class="dash-panel-tag">SHARE / %</span>
            </div>
            <div class="donut-chart"><EChart :option="donut" /></div>
            <div class="donut-legend">
              <div class="legend-row"><i style="--lc: #5ef2c2" /> 线上商城 <b>46%</b></div>
              <div class="legend-row"><i style="--lc: #54c8e8" /> 门店零售 <b>28%</b></div>
              <div class="legend-row"><i style="--lc: #a78bfa" /> 企业采购 <b>16%</b></div>
              <div class="legend-row"><i style="--lc: #f6c37a" /> 其他渠道 <b>10%</b></div>
            </div>
            <div class="donut-foot"><span>线上渠道同比</span><b>+12.8% ↗</b></div>
          </section>

          <section class="dash-panel table-panel">
            <div class="dash-panel-head">
              <div class="dash-panel-title">门店实时明细</div>
              <span class="dash-panel-tag"><b>TOP 04</b></span>
            </div>
            <div class="dash-table">
              <div class="dash-tr head"><span>门店</span><span>交易额</span><span>环比</span><span>状态</span></div>
              <div class="dash-tr"><span class="name"><i /> 静安嘉里</span><span class="v">1,284,600</span><span class="up">+26.4%</span><span class="tag">活跃</span></div>
              <div class="dash-tr"><span class="name"><i /> 杭州湖滨</span><span class="v">986,200</span><span class="up">+18.2%</span><span class="tag">活跃</span></div>
              <div class="dash-tr"><span class="name"><i /> 苏州中心</span><span class="v">842,900</span><span class="up">+9.6%</span><span class="tag">稳定</span></div>
              <div class="dash-tr"><span class="name"><i /> 宁波江北</span><span class="v">621,400</span><span class="down">-4.8%</span><span class="tag" style="color: #c59a68; background: rgba(246,195,122,.06)">关注</span></div>
            </div>
          </section>
        </section>
      </main>

      <span class="dash-corner tl" />
      <span class="dash-corner tr" />
      <span class="dash-corner bl" />
      <span class="dash-corner br" />
    </div>
  </div>
</template>
