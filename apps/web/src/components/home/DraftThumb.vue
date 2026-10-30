<script setup lang="ts">
defineProps<{ variant: number; label: string; time: string }>()
</script>

<template>
  <div class="draft-thumb">
    <div class="thumb-grid" />
    <div class="thumb-ui">
      <div class="thumb-head"><span class="lb">{{ label }}</span><span class="time">{{ time }}</span></div>
      <div class="thumb-body">
        <div class="thumb-kpis">
          <div class="thumb-kpi" style="--tc: #5ef2c2"><i /><b /></div>
          <div class="thumb-kpi" style="--tc: #54c8e8"><i /><b /></div>
          <div class="thumb-kpi" style="--tc: #f6c37a"><i /><b /></div>
          <div class="thumb-kpi" style="--tc: #a78bfa"><i /><b /></div>
        </div>
        <div class="thumb-main" :style="variant === 3 ? 'grid-template-columns:1fr 1.1fr' : ''">
          <div class="thumb-panel">
            <svg v-if="variant === 1" class="thumb-svg" viewBox="0 0 180 92" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mapFill1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#12313a" /><stop offset="1" stop-color="#0a1b23" />
                </linearGradient>
              </defs>
              <path d="M28 42 L38 29 L52 32 L58 24 L71 27 L78 20 L92 25 L100 21 L112 30 L125 28 L135 38 L149 40 L154 52 L146 61 L137 62 L132 74 L118 70 L108 78 L97 70 L84 74 L74 67 L61 70 L52 61 L40 62 L33 54 Z" fill="url(#mapFill1)" stroke="#2d6267" stroke-width=".9" />
              <path d="M72 62 L84 56 L97 59 L106 48 L120 51" stroke="#5ef2c2" stroke-width=".7" opacity=".5" fill="none" />
              <g fill="#5ef2c2">
                <circle cx="103" cy="52" r="2.6" /><circle cx="103" cy="52" r="5" fill="none" opacity=".35" />
                <circle cx="84" cy="47" r="1.8" /><circle cx="121" cy="45" r="1.8" />
                <circle cx="62" cy="51" r="1.5" /><circle cx="96" cy="66" r="1.5" />
              </g>
              <g stroke="rgba(94,242,194,.22)" stroke-width=".5"><path d="M28 18h44M28 23h28M125 74h30M125 79h18" /></g>
            </svg>

            <svg v-else-if="variant === 2" class="thumb-svg" viewBox="0 0 180 92" preserveAspectRatio="none">
              <g stroke="rgba(255,255,255,.045)" stroke-width=".6"><path d="M0 18h180M0 38h180M0 58h180M0 78h180" /><path d="M30 0v92M60 0v92M90 0v92M120 0v92M150 0v92" /></g>
              <path d="M12 72 C36 66, 38 42, 62 48 S91 24, 112 31 S144 15, 168 18" fill="none" stroke="#54c8e8" stroke-width="1.5" />
              <path d="M12 72 C36 66, 38 42, 62 48 S91 24, 112 31 S144 15, 168 18 L168 88 L12 88 Z" fill="rgba(84,200,232,.07)" />
              <path d="M12 78 C32 76, 46 62, 64 65 S95 52, 118 57 S145 42, 168 48" fill="none" stroke="#5ef2c2" stroke-width=".7" stroke-dasharray="2 2" opacity=".7" />
              <g fill="rgba(255,255,255,.18)"><rect x="12" y="6" width="32" height="2" /><rect x="12" y="11" width="20" height="2" /></g>
            </svg>

            <svg v-else-if="variant === 3" class="thumb-svg" viewBox="0 0 90 70">
              <g>
                <rect x="8" y="36" width="10" height="26" rx="1" fill="#f6c37a" opacity=".85" />
                <rect x="23" y="26" width="10" height="36" rx="1" fill="#f6c37a" opacity=".65" />
                <rect x="38" y="31" width="10" height="31" rx="1" fill="#f6c37a" opacity=".5" />
                <rect x="53" y="16" width="10" height="46" rx="1" fill="#5ef2c2" opacity=".8" />
                <rect x="68" y="22" width="10" height="40" rx="1" fill="#5ef2c2" opacity=".55" />
              </g>
              <path d="M6 20 C26 18, 39 9, 55 12 S76 5, 86 6" fill="none" stroke="#eaf2f8" stroke-width=".7" opacity=".6" />
            </svg>

            <svg v-else class="thumb-svg" viewBox="0 0 180 92" preserveAspectRatio="none">
              <path d="M20 50 L38 30 L55 36 L70 25 L88 29 L100 20 L115 27 L130 25 L143 36 L153 37 L157 50 L148 60 L137 58 L130 70 L118 66 L108 75 L96 67 L83 72 L72 64 L58 68 L49 59 L34 60 Z" fill="#0b1d24" stroke="#27585d" stroke-width=".8" />
              <g fill="none" stroke="rgba(94,242,194,.22)" stroke-width=".6">
                <path d="M37 47 C60 34, 88 50, 111 34 S143 36, 151 45" /><path d="M47 58 C70 48, 91 62, 113 51 S142 52, 149 56" />
              </g>
              <g fill="#5ef2c2"><circle cx="57" cy="43" r="1.6" /><circle cx="86" cy="36" r="1.6" /><circle cx="113" cy="47" r="1.6" /><circle cx="134" cy="41" r="1.6" /><circle cx="146" cy="53" r="1.6" /></g>
              <g fill="#54c8e8"><circle cx="57" cy="43" r="4" fill="none" opacity=".3" /><circle cx="113" cy="47" r="4" fill="none" opacity=".3" /></g>
            </svg>
          </div>

          <div class="thumb-side">
            <div class="thumb-panel">
              <svg v-if="variant === 1" class="thumb-svg" viewBox="0 0 90 36" preserveAspectRatio="none">
                <path d="M3 29 C14 26, 16 19, 26 21 S40 12, 50 15 S68 8, 78 10 S85 4, 88 4" fill="none" stroke="#5ef2c2" stroke-width="1.2" />
                <path d="M3 29 C14 26, 16 19, 26 21 S40 12, 50 15 S68 8, 78 10 S85 4, 88 4 L88 34 L3 34 Z" fill="rgba(94,242,194,.08)" />
                <path d="M3 24 C16 22, 23 17, 34 19 S50 12, 62 14 S78 10, 88 8" fill="none" stroke="#54c8e8" stroke-width=".7" stroke-dasharray="2 2" opacity=".7" />
              </svg>
              <svg v-else-if="variant === 2" class="thumb-svg" viewBox="0 0 90 36">
                <g fill="#5ef2c2" opacity=".85">
                  <rect x="8" y="20" width="5" height="12" rx="1" /><rect x="18" y="16" width="5" height="16" rx="1" /><rect x="28" y="22" width="5" height="10" rx="1" /><rect x="38" y="10" width="5" height="22" rx="1" /><rect x="48" y="15" width="5" height="17" rx="1" /><rect x="58" y="7" width="5" height="25" rx="1" /><rect x="68" y="12" width="5" height="20" rx="1" /><rect x="78" y="4" width="5" height="28" rx="1" />
                </g>
              </svg>
              <svg v-else-if="variant === 3" class="thumb-svg" viewBox="0 0 110 36">
                <g fill="none" stroke-width="3">
                  <circle cx="26" cy="18" r="11" stroke="#14343a" />
                  <circle cx="26" cy="18" r="11" stroke="#f6c37a" stroke-dasharray="27 70" transform="rotate(-90 26 18)" />
                  <circle cx="26" cy="18" r="11" stroke="#5ef2c2" stroke-dasharray="18 70" stroke-dashoffset="-27" transform="rotate(-90 26 18)" />
                  <circle cx="26" cy="18" r="11" stroke="#54c8e8" stroke-dasharray="10 70" stroke-dashoffset="-45" transform="rotate(-90 26 18)" />
                </g>
                <g fill="rgba(255,255,255,.2)"><rect x="48" y="8" width="36" height="2" rx="1" /><rect x="48" y="14" width="26" height="2" rx="1" /><rect x="48" y="20" width="42" height="2" rx="1" /><rect x="48" y="26" width="20" height="2" rx="1" /></g>
              </svg>
              <svg v-else class="thumb-svg" viewBox="0 0 90 36">
                <g fill="none" stroke="#a78bfa" stroke-width="1.3"><path d="M4 30 C18 27, 25 18, 39 22 S58 12, 72 15 S84 7, 88 8" /></g>
                <path d="M4 30 C18 27, 25 18, 39 22 S58 12, 72 15 S84 7, 88 8 L88 34 L4 34 Z" fill="rgba(167,139,250,.08)" />
              </svg>
            </div>
            <div class="thumb-panel">
              <svg v-if="variant === 3" class="thumb-svg" viewBox="0 0 110 36">
                <g fill="rgba(255,255,255,.2)">
                  <rect x="10" y="7" width="26" height="2" rx="1" /><rect x="42" y="7" width="32" height="2" rx="1" /><rect x="80" y="7" width="18" height="2" rx="1" />
                  <rect x="10" y="14" width="20" height="2" rx="1" /><rect x="42" y="14" width="28" height="2" rx="1" /><rect x="80" y="14" width="14" height="2" rx="1" />
                  <rect x="10" y="21" width="24" height="2" rx="1" /><rect x="42" y="21" width="22" height="2" rx="1" /><rect x="80" y="21" width="16" height="2" rx="1" />
                </g>
                <path d="M10 29h88" stroke="rgba(255,255,255,.06)" />
              </svg>
              <svg v-else class="thumb-svg" viewBox="0 0 90 32">
                <circle cx="27" cy="16" r="9" fill="none" stroke="#17353b" stroke-width="4" />
                <circle cx="27" cy="16" r="9" fill="none" stroke="#5ef2c2" stroke-width="4" stroke-dasharray="32 57" transform="rotate(-90 27 16)" />
                <circle cx="27" cy="16" r="9" fill="none" stroke="#54c8e8" stroke-width="4" stroke-dasharray="15 57" stroke-dashoffset="-32" transform="rotate(-90 27 16)" />
                <text x="27" y="18.5" font-size="6" fill="#bdeae0" text-anchor="middle" font-family="Bahnschrift">46%</text>
                <g fill="rgba(255,255,255,.22)"><rect x="45" y="8" width="30" height="2" rx="1" /><rect x="45" y="14" width="22" height="2" rx="1" /><rect x="45" y="20" width="27" height="2" rx="1" /></g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
    <span v-if="variant === 1" class="thumb-tag">LIVE PREVIEW</span>
  </div>
</template>
