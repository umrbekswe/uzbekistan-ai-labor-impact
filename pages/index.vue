<template>
  <div class="dashboard">
    <!-- LEFT SIDEBAR -->
    <aside class="sidebar" :class="{ 'sidebar--closed': !isSidebarOpen }">
      <div class="sidebar__section">
        <h1 class="sidebar__title">O'zbekiston mehnat bozoriga sun'iy intellekt ta'siri</h1>
        <p class="sidebar__desc">
          {{ OCCUPATIONS.length }} kasb · rang = SI ta'siri<br>
          Data from
          <span class="link" @click="isModalOpen = true">Statistika agentligi</span> (2025), scored by<br>
          <span class="link" @click="isModalOpen = true">AI modellari</span> va
          <span class="link" @click="isModalOpen = true">boshqa manbalar</span>
        </p>
      </div>

      <div class="view-toggle">
        <button v-for="v in views" :key="v.k" class="view-btn" :class="{ 'view-btn--active': view === v.k }" @click="view = v.k">{{ v.l }}</button>
      </div>

      <div class="sidebar__section">
        <div class="label">JAMI ISH O'RINLARI</div>
        <div class="big-num">{{ formatJobs(totalJobs) }}</div>
      </div>

      <div class="sidebar__section">
        <div class="label">O'RTACHA TA'SIR</div>
        <div class="big-num" :style="{ color: getAIBarColor(Math.round(weightedAI)) }">{{ weightedAI }}</div>
        <div class="sidebar__subdesc">bandlik bo'yicha, 0–10 shkala</div>
      </div>

      <div class="sidebar__section">
        <div class="label">BANDLIK BO'YICHA TA'SIR</div>
        <div class="histogram">
          <div v-for="(b, i) in buckets" :key="i" class="histogram__bar" :style="{ height: Math.max(4, (b.count / totalJobs) * 100) + '%', background: b.color }" />
        </div>
        <div class="histogram__axis"><span>0</span><span>5</span><span>10</span></div>
      </div>

      <div class="sidebar__section">
        <div class="label">TAHLIL</div>
        <div class="breakdown">
          <div v-for="(b, i) in buckets" :key="i" class="breakdown__row">
            <div class="breakdown__dot" :style="{ background: b.color }" />
            <span class="breakdown__lbl">{{ b.label }}</span>
            <span class="breakdown__val">{{ formatJobs(b.count) }}</span>
            <span class="breakdown__pct">{{ b.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="sidebar__section">
        <div class="label">MAOSH BO'YICHA TA'SIR</div>
        <div class="bands">
          <div v-for="(b, i) in payBands" :key="i" class="bands__row">
            <span class="bands__lbl">{{ b.label }}</span>
            <div class="bands__track"><div class="bands__fill" :style="{ width: b.avgAI * 10 + '%', background: getLegendColor(b.avgAI) }" /></div>
            <span class="bands__val">{{ b.avgAI }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar__section">
        <div class="label">TA'LIM BO'YICHA TA'SIR</div>
        <div class="bands">
          <div v-for="(b, i) in eduBands" :key="i" class="bands__row">
            <span class="bands__lbl bands__lbl--wide">{{ b.label }}</span>
            <div class="bands__track"><div class="bands__fill" :style="{ width: b.avgAI * 10 + '%', background: getLegendColor(b.avgAI) }" /></div>
            <span class="bands__val">{{ b.avgAI }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar__section">
        <div class="label">XAVF OSTIDAGI ISH HAQI</div>
        <div class="big-num big-num--sm">{{ formattedRiskPay }}</div>
        <div class="sidebar__subdesc">yuqori ta'sir darajasidagi kasblar yillik ish haqi (7+)</div>
        <div class="gradient-bar"><span>Past</span><div class="gradient-bar__track" /><span>Yuqori</span></div>
      </div>
    </aside>

    <button class="sidebar-toggle" :style="{ left: isSidebarOpen ? '228px' : '0' }" @click="isSidebarOpen = !isSidebarOpen">
      {{ isSidebarOpen ? '‹' : '›' }}
    </button>

    <!-- MAIN TREEMAP AREA -->
    <main class="treemap-area">
      <!-- Chips/Tabs -->
      <div class="chips" :style="{ top: view === 'tasir' ? '40px' : '16px' }">
        <template v-if="!drillSector">
          <button class="chip" :class="{ 'chip--active': groupBy === 'nested' }" @click="groupBy = 'nested'">Nested</button>
          <button class="chip" :class="{ 'chip--active': groupBy === 'sector' }" @click="groupBy = 'sector'">Sektorlar</button>
          <button class="chip" :class="{ 'chip--active': groupBy === 'all' }" @click="groupBy = 'all'">Barchasi</button>
        </template>
        <button v-else class="chip chip--active" @click="drillSector = null">← Sektorlarga qaytish</button>
      </div>

      <!-- SVG Canvas -->
      <div ref="mapRef" class="map-container" @mousemove="onMouseMove" @mouseleave="hovered = null">
        <svg :width="dims.w" :height="dims.h" style="display:block">
          <!-- Column headers for Ta'sir view -->
          <template v-if="view === 'tasir' && dims.w > 0">
            <text v-for="(col, i) in aiColumnHeaders" :key="'h' + i" :x="col.x" :y="20" :fill="getAIBarColor(col.ai)" font-size="12" font-weight="600" text-anchor="middle" font-family="'IBM Plex Mono'">{{ col.ai }}</text>
          </template>

          <!-- NESTED: Sector borders + inner jobs -->
          <template v-if="groupBy === 'nested' && !drillSector && view === 'xarita'">
            <g v-for="(s, si) in nestedSectors" :key="'s' + si">
              <!-- Sector label -->
              <text v-if="s.rw > 80 && s.rh > 24" :x="s.rx + 12" :y="s.ry + 10" fill="#555" font-size="9.5" font-weight="700" font-family="'IBM Plex Sans'" style="pointer-events:none; text-transform:uppercase; letter-spacing:0.8px;">{{ truncate(s.name, s.rw - 24) }}</text>
              <!-- Inner job rects -->
              <g v-for="(r, ri) in s.children" :key="'j' + ri"
                 @mouseenter="hovered = r"
                 @mouseleave="hovered = null"
              >
                <rect
                  :x="r.rx + 1.5" :y="r.ry + 1.5"
                  :width="Math.max(0, r.rw - 3)"
                  :height="Math.max(0, r.rh - 3)"
                  :fill="getAIFill(r.ai)"
                  :stroke="hovered?.name === r.name ? '#E2B53A' : 'none'"
                  :stroke-width="hovered?.name === r.name ? 2 : 0"
                  rx="1"
                />
                <text v-if="r.rw > 36 && r.rh > 16" :x="r.rx + 5" :y="r.ry + 14" fill="#CCC" :font-size="r.rw > 120 ? 11 : r.rw > 70 ? 9.5 : 8" font-weight="600" font-family="'IBM Plex Sans'" style="pointer-events:none">{{ truncate(r.name, r.rw - 10) }}</text>
                <text v-if="r.rw > 80 && r.rh > 30" :x="r.rx + 5" :y="r.ry + 27" fill="#777" :font-size="r.rw > 100 ? 9 : 7.5" font-family="'IBM Plex Mono'" style="pointer-events:none">{{ r.ai }}/10</text>
              </g>
            </g>
          </template>

          <!-- SECTOR / ALL / DRILL view -->
          <template v-else>
            <g v-for="(r, i) in rects" :key="i"
               :style="{ cursor: r.isSector ? 'pointer' : 'default' }"
               @mouseenter="hovered = r"
               @mouseleave="hovered = null"
               @click="r.isSector && (drillSector = r.name)"
            >
              <rect :x="r.rx + 1.5" :y="r.ry + 1.5" :width="Math.max(0, r.rw - 3)" :height="Math.max(0, r.rh - 3)" :fill="getAIFill(r.ai)" :stroke="hovered?.name === r.name ? '#E2B53A' : '#191919'" :stroke-width="hovered?.name === r.name ? 2.5 : 1" rx="1" />
              <text v-if="r.rw > 48 && r.rh > 20" :x="r.rx + 6" :y="r.ry + 15" :fill="hovered?.name === r.name ? '#fff' : '#D4D4D4'" :font-size="r.rw > 180 ? 12.5 : r.rw > 120 ? 11 : r.rw > 80 ? 9.5 : 8" font-weight="600" font-family="'IBM Plex Sans'" style="pointer-events:none">{{ truncate(r.name, r.rw) }}</text>
              <text v-if="r.rw > 65 && r.rh > 36" :x="r.rx + 6" :y="r.ry + 29" fill="#999" :font-size="r.rw > 140 ? 10 : 8.5" font-family="'IBM Plex Mono'" style="pointer-events:none">{{ r.ai }}/10 · {{ formatJobs(r.jobs) }} ish o'rni</text>
            </g>
          </template>
        </svg>

        <!-- TOOLTIP -->
        <div v-if="hovered" class="tooltip" :style="tooltipStyle">
          <div class="tooltip__header">
            <div class="tooltip__name">{{ hovered.name }}</div>
            <div class="tooltip__ai-row">
              <span :style="{ color: getAIBarColor(hovered.ai) }" class="tooltip__ai-label">SI ta'siri: {{ hovered.ai }}/10</span>
            </div>
            <div class="tooltip__bar-track">
              <div class="tooltip__bar-fill" :style="{ width: hovered.ai * 10 + '%', background: getAIBarColor(hovered.ai) }" />
            </div>
          </div>

          <!-- Sector tooltip -->
          <div v-if="hovered.isSector" class="tooltip__body">
            <div class="tooltip__sector-info">Jami ish o'rinlari: <strong>{{ formatJobs(hovered.jobs) }}</strong></div>
            <div class="tooltip__sector-hint">{{ groupBy !== 'nested' ? 'Ichiga kirib ko\'rish uchun ustiga bosing' : '' }}</div>
          </div>

          <!-- Job tooltip -->
          <template v-else>
            <div class="tooltip__body">
              <table class="tooltip__table">
                <tr v-for="([k, v], i) in jobStats" :key="i">
                  <td class="tooltip__key">{{ k }}</td>
                  <td class="tooltip__val" :style="{ color: getOutlookColor(k, v) }">{{ v }}</td>
                </tr>
              </table>
            </div>
            <!-- Description section -->
            <div class="tooltip__desc-section">
              <p class="tooltip__desc">{{ hovered.desc }}</p>
              <div class="tooltip__reason" :style="{ borderLeftColor: getAIBarColor(hovered.ai) }">
                <span class="tooltip__reason-label" :style="{ color: getAIBarColor(hovered.ai) }">Nima uchun bu zonada?</span>
                <p class="tooltip__reason-text">{{ hovered.reason }}</p>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>

    <!-- SOURCES MODAL -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="modal-overlay" @click="isModalOpen = false">
        <div class="modal-box" @click.stop>
          <div class="modal-box__header">
            <h2>Ma'lumot manbalari</h2>
            <button class="modal-box__close" @click="isModalOpen = false">&times;</button>
          </div>
          <div class="modal-box__body">
            <div class="source-item">
              <strong>1. Bandlik va ish o'rinlari statistikasi:</strong><br>
              O'zbekiston Respublikasi Statistika agentligi (<a href="https://stat.uz/uz/" target="_blank">stat.uz</a>, 2025) hamda ochiq iqtisodiy-bandlik ko'rsatkichlariga ko'ra tahlil qilindi.
            </div>
            <div class="source-item">
              <strong>2. Kasblar va daromadlar taqsimoti:</strong><br>
              Milliy bo'sh ish o'rinlari bazalari (<a href="https://ish.mehnat.uz" target="_blank">ish.mehnat.uz</a>, <a href="https://hh.uz" target="_blank">hh.uz</a>), kasblar klassifikatori (<a href="https://mehnat.uz" target="_blank">mehnat.uz</a>) va vazirliklar hisobotlari.
            </div>
            <div class="source-item">
              <strong>3. Sun'iy Intellekt ta'sirini baholash (AI Score 1–10):</strong><br>
              <a href="https://www.weforum.org/" target="_blank">World Economic Forum (WEF)</a> va <a href="https://www.bls.gov/" target="_blank">Bureau of Labor Statistics (BLS)</a> tadqiqotlariga tayangan holda <a href="https://anthropic.com/claude" target="_blank">Claude AI (Anthropic)</a> ko'magida baholandi.
            </div>
          </div>
          <div class="modal-box__footer">
            <button class="btn-secondary" @click="isModalOpen = false">Yopish</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { OCCUPATIONS } from '~/utils/occupations.js'
import { squarify, getAIFill, getAIBarColor, getLegendColor, formatJobs, formatPay } from '~/utils/treemap.js'

// ── State ──────────────────────────────────────
const mapRef = ref(null)
const dims = ref({ w: 0, h: 0 })
const hovered = ref(null)
const mouse = ref({ x: 0, y: 0 })
const view = ref('xarita')
const isSidebarOpen = ref(true)
const isModalOpen = ref(false)
const drillSector = ref(null)
const groupBy = ref('nested') // 'nested' | 'sector' | 'all'

const views = [
  { k: 'xarita', l: 'Xarita' },
  { k: 'tasir', l: "Ta'sir va O'sish" }
]

// ── ResizeObserver ─────────────────────────────
onMounted(() => {
  const ro = new ResizeObserver(entries => {
    for (const e of entries) dims.value = { w: e.contentRect.width, h: e.contentRect.height }
  })
  if (mapRef.value) ro.observe(mapRef.value)
  onUnmounted(() => ro.disconnect())
})

function onMouseMove(e) {
  const r = mapRef.value?.getBoundingClientRect()
  if (r) mouse.value = { x: e.clientX - r.left, y: e.clientY - r.top }
}

// ── Sorted data ────────────────────────────────
const sorted = computed(() => [...OCCUPATIONS].sort((a, b) => b.jobs - a.jobs))

// ── NESTED treemap ─────────────────────────────
const nestedSectors = computed(() => {
  if (!dims.value.w) return []
  const { w, h } = dims.value
  const LABEL_H = 16 // sector label height

  // 1. Build sector aggregates
  const sectorMap = {}
  sorted.value.forEach(o => {
    if (!sectorMap[o.sector]) sectorMap[o.sector] = { name: o.sector, isSector: true, jobs: 0, aiSum: 0, items: [] }
    sectorMap[o.sector].jobs += o.jobs
    sectorMap[o.sector].aiSum += o.ai * o.jobs
    sectorMap[o.sector].items.push({ ...o, value: o.jobs })
  })
  const sectors = Object.values(sectorMap)
    .map(s => ({ ...s, value: s.jobs, ai: Math.round(s.aiSum / s.jobs) }))
    .sort((a, b) => b.value - a.value)

  // 2. Squarify sectors to get bounding boxes (2px padding from edges)
  const PAD = 2
  const sRects = squarify(sectors, PAD, PAD, w - PAD * 2, h - PAD * 2)

  // 3. For each sector rect, squarify its jobs inside (with label + gap padding)
  return sRects.map(sr => {
    const GAP = 2 // gap between sectors
    const LABEL_H = 12
    const innerX = sr.rx + GAP
    const innerY = sr.ry + LABEL_H + GAP
    const innerW = Math.max(0, sr.rw - GAP * 2)
    const innerH = Math.max(0, sr.rh - LABEL_H - GAP * 2)
    const children = innerH > 4
      ? squarify(sr.items.map(it => ({ ...it, value: it.jobs })), innerX, innerY, innerW, innerH)
      : []
    return { ...sr, children }
  })
})

// ── Flat items for other views ─────────────────
const items = computed(() => {
  if (drillSector.value) {
    return sorted.value.filter(o => o.sector === drillSector.value).map(o => ({ ...o, value: o.jobs }))
  }
  if (groupBy.value === 'all') {
    return sorted.value.map(o => ({ ...o, value: o.jobs }))
  }
  // sector view
  const sectors = {}
  sorted.value.forEach(o => {
    if (!sectors[o.sector]) sectors[o.sector] = { name: o.sector, isSector: true, jobs: 0, aiSum: 0, oCount: 0 }
    sectors[o.sector].jobs += o.jobs
    sectors[o.sector].aiSum += o.ai * o.jobs
    sectors[o.sector].oCount++
  })
  return Object.values(sectors).map(s => ({
    ...s, value: s.jobs, ai: Math.round(s.aiSum / s.jobs),
    desc: `${s.oCount} ta yirik kasb guruhlarini o'z ichiga oladi.`
  })).sort((a, b) => b.value - a.value)
})

// ── Rects for flat views ───────────────────────
const HEADER_H = computed(() => view.value === 'tasir' ? 30 : 0)

const rects = computed(() => {
  if (!dims.value.w || groupBy.value === 'nested') return []
  const { w, h } = dims.value
  const hh = HEADER_H.value
  if (view.value === 'xarita') return squarify(items.value, 0, hh, w, h - hh)

  const sumAll = items.value.reduce((s, it) => s + it.value, 0)
  const result = []
  let currentX = 0
  for (let i = 1; i <= 9; i++) {
    const colItems = i === 9 ? items.value.filter(it => it.ai >= 9) : items.value.filter(it => it.ai === i)
    const colSum = colItems.reduce((s, it) => s + it.value, 0)
    const colW = sumAll > 0 ? (colSum / sumAll) * w : 0
    if (colW > 0) result.push(...squarify(colItems, currentX, hh, colW, h - hh))
    currentX += colW
  }
  return result
})

const aiColumnHeaders = computed(() => {
  if (view.value !== 'tasir' || !dims.value.w) return []
  const { w } = dims.value
  const sumAll = items.value.reduce((s, it) => s + it.value, 0)
  const headers = []
  let currentX = 0
  for (let i = 1; i <= 9; i++) {
    const colItems = i === 9 ? items.value.filter(it => it.ai >= 9) : items.value.filter(it => it.ai === i)
    const colSum = colItems.reduce((s, it) => s + it.value, 0)
    const colW = sumAll > 0 ? (colSum / sumAll) * w : 0
    if (colW > 0) headers.push({ ai: i, x: currentX + colW / 2 })
    currentX += colW
  }
  return headers
})

// ── Sidebar stats ──────────────────────────────
const totalJobs = computed(() => OCCUPATIONS.reduce((s, o) => s + o.jobs, 0))
const weightedAI = computed(() => (OCCUPATIONS.reduce((s, o) => s + o.ai * o.jobs, 0) / totalJobs.value).toFixed(1))
const riskPay = computed(() => OCCUPATIONS.filter(o => o.ai >= 7).reduce((s, o) => s + o.jobs * o.pay, 0))
const formattedRiskPay = computed(() => (riskPay.value / 1_000_000_000).toFixed(1) + ' mlrd')

const levels = [
  { label: 'Minimal (0-1)', color: '#2D6B2D', min: 0, max: 1 },
  { label: 'Past (2-3)', color: '#4D7C0F', min: 2, max: 3 },
  { label: "O'rtacha (4-5)", color: '#A16207', min: 4, max: 5 },
  { label: 'Yuqori (6-7)', color: '#C2410C', min: 6, max: 7 },
  { label: 'Juda yuqori (8-10)', color: '#DC2626', min: 8, max: 10 },
]

const buckets = computed(() => levels.map(lv => {
  const c = OCCUPATIONS.filter(o => o.ai >= lv.min && o.ai <= lv.max).reduce((s, o) => s + o.jobs, 0)
  return { ...lv, count: c, pct: ((c / totalJobs.value) * 100).toFixed(0) }
}))

const payBands = computed(() => [
  { label: '< 3 mln', min: 0, max: 2999999 },
  { label: '3–5 mln', min: 3000000, max: 4999999 },
  { label: '5–8 mln', min: 5000000, max: 7999999 },
  { label: '8–12 mln', min: 8000000, max: 11999999 },
  { label: '12 mln+', min: 12000000, max: Infinity },
].map(b => {
  const m = OCCUPATIONS.filter(o => o.pay >= b.min && o.pay <= b.max)
  const a = m.length ? +(m.reduce((s, o) => s + o.ai * o.jobs, 0) / m.reduce((s, o) => s + o.jobs, 0)).toFixed(1) : 0
  return { ...b, avgAI: a }
}))

const eduBands = computed(() => [
  { label: "O'rta va past", keys: ["Rasmiy ta'lim talab etilmaydi", "O'rta"] },
  { label: "O'rta maxsus", keys: ["O'rta maxsus"] },
  { label: 'Bakalavr', keys: ['Oliy', 'Oliy (bakalavr+)', 'Oliy (tibbiyot instituti)'] },
  { label: 'Magistr', keys: ['Oliy (magistr)'] },
  { label: 'Doktorantura', keys: ['Oliy (magistr+)'] }
].map(b => {
  const m = OCCUPATIONS.filter(o => b.keys.some(k => o.edu.includes(k.replace('+', ''))))
  const a = m.length ? +(m.reduce((s, o) => s + o.ai * o.jobs, 0) / m.reduce((s, o) => s + o.jobs, 0)).toFixed(1) : 0
  return { ...b, avgAI: a }
}))

// ── Tooltip ────────────────────────────────────
const TW = 380
const tooltipStyle = computed(() => {
  if (!hovered.value) return {}
  const { w, h } = dims.value
  let tx = mouse.value.x + 18, ty = mouse.value.y + 12
  if (tx + TW > w) tx = mouse.value.x - TW - 12
  if (ty + 360 > h) ty = Math.max(8, h - 360 - 8)
  return { left: tx + 'px', top: ty + 'px', width: TW + 'px' }
})

const jobStats = computed(() => {
  if (!hovered.value) return []
  return [
    ["O'rtacha maosh", formatPay(hovered.value.pay) + " so'm"],
    ["Ish o'rinlari", formatJobs(hovered.value.jobs)],
    ["O'sish", hovered.value.outlook],
    ["Ta'lim", hovered.value.edu],
  ]
})

function getOutlookColor(key, val) {
  if (key !== "O'sish") return '#fff'
  if (val?.includes('Kamayish')) return '#F87171'
  if (val?.includes('Portlash') || val?.includes('Juda tez')) return '#4ADE80'
  return '#FBBF24'
}

function truncate(name, rw) {
  const n = name || ''
  const maxChars = Math.floor((rw - 12) / 6.5)
  return n.length > maxChars ? n.slice(0, maxChars) + '…' : n
}
</script>

<style scoped>
.dashboard {
  height: 100vh; display: flex;
  background: #191919; color: #ddd; overflow: hidden; position: relative;
}

/* ── Sidebar ── */
.sidebar {
  width: 228px; min-width: 228px; background: #111114;
  border-right: 1px solid #222; padding: 20px 18px;
  overflow-y: auto; overflow-x: hidden; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 24px;
  transition: width .3s ease, min-width .3s ease, padding .3s ease;
}
.sidebar--closed { width: 0; min-width: 0; padding: 0; border-right: none; }

/* Scrollbar */
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: #050507; border-radius: 2px; }
.sidebar::-webkit-scrollbar-thumb { background: #2A2A2E; border-radius: 2px; }
.sidebar::-webkit-scrollbar-thumb:hover { background: #3A3A40; }
.sidebar__title { font-size: 16px; font-weight: 700; margin: 0; line-height: 1.4; color: #eee; }
.sidebar__desc { font-size: 9.5px; color: #999; margin-top: 10px; line-height: 1.5; }
.sidebar__subdesc { font-size: 10.5px; color: #666; margin-top: 4px; }
.sidebar__section { display: flex; flex-direction: column; }

.label { font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 1.2px; }
.big-num { font-size: 36px; font-weight: 700; font-family: 'IBM Plex Mono', monospace; color: #fff; line-height: 1; margin-top: 4px; letter-spacing: -1px; }
.big-num--sm { font-size: 32px; letter-spacing: -0.5px; }
.link { color: #7BA4DB; text-decoration: underline; cursor: pointer; }

.view-toggle { display: flex; gap: 8px; margin-top: 4px; }
.view-btn { flex: 1; padding: 7px 0; font-size: 11px; font-weight: 600; cursor: pointer; background: transparent; color: #888; border: 1px solid #333; border-radius: 4px; transition: all .2s; }
.view-btn--active { background: #2A2A2E; color: #fff; }

.histogram { display: flex; align-items: flex-end; gap: 2px; height: 70px; margin-top: 12px; }
.histogram__bar { flex: 1; border-radius: 1px 1px 0 0; }
.histogram__axis { display: flex; margin-top: 4px; }
.histogram__axis span { font-size: 8.5px; color: #777; flex: 1; }
.histogram__axis span:last-child { text-align: right; flex: 0; }

.breakdown { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
.breakdown__row { display: flex; align-items: center; gap: 6px; font-size: 10px; }
.breakdown__dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.breakdown__lbl { color: #888; flex: 1; font-size: 10.5px; }
.breakdown__val { color: #eee; font-weight: 600; font-family: 'IBM Plex Mono', monospace; font-size: 11px; min-width: 32px; text-align: right; }
.breakdown__pct { color: #777; font-size: 10.5px; min-width: 26px; text-align: right; }

.bands { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
.bands__row { display: flex; align-items: center; gap: 6px; }
.bands__lbl { font-size: 10px; color: #888; width: 48px; text-align: right; flex-shrink: 0; }
.bands__lbl--wide { width: 72px; line-height: 1.2; }
.bands__track { flex: 1; height: 10px; background: #1D1E20; border-radius: 2px; overflow: hidden; }
.bands__fill { height: 100%; border-radius: 2px; }
.bands__val { font-size: 10.5px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; color: #eee; width: 20px; text-align: right; }

.gradient-bar { display: flex; align-items: center; gap: 6px; margin-top: 14px; }
.gradient-bar span { font-size: 9.5px; color: #666; }
.gradient-bar__track { flex: 1; height: 6px; background: linear-gradient(90deg, #4ADE80, #FBBF24, #EF4444); border-radius: 3px; }

.sidebar-toggle {
  position: absolute; bottom: 24px; z-index: 50;
  background: #2A2A2E; color: #ddd; border: 1px solid #333; border-left: none;
  border-radius: 0 4px 4px 0; cursor: pointer;
  width: 24px; height: 48px; display: flex; align-items: center; justify-content: center;
  padding: 0; font-size: 16px; outline: none; transition: left .3s ease;
}

/* ── Treemap ── */
.treemap-area { flex: 1; position: relative; overflow: hidden; }

.chips {
  position: absolute; right: 16px; z-index: 10; display: flex;
  background: rgba(20,20,20,.7); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 4px; border-radius: 10px;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
}
.chip { background: transparent; color: #888; border: none; cursor: pointer; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 400; font-family: 'IBM Plex Sans', sans-serif; transition: all .2s ease; }
.chip--active { background: #2C2C2E; color: #fff; font-weight: 600; }

.map-container { width: 100%; height: 100%; position: absolute; top: 0; left: 0; cursor: default; }

/* ── Tooltip ── */
.tooltip {
  position: absolute; max-height: 420px; overflow-y: auto;
  background: rgba(22, 26, 32, 0.82);
  border: 1px solid rgba(255,255,255,.12); border-radius: 10px;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  pointer-events: none; z-index: 100;
  box-shadow: 0 16px 48px rgba(0,0,0,.7); overflow: hidden;
}
.tooltip__header { padding: 14px 16px 10px; }
.tooltip__name { font-size: 15px; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: 8px; }
.tooltip__ai-label { font-size: 13px; font-weight: 700; }
.tooltip__bar-track { height: 4px; background: rgba(255,255,255,.15); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.tooltip__bar-fill { height: 100%; border-radius: 2px; }
.tooltip__body { padding: 10px 16px 12px; border-top: 1px solid rgba(255,255,255,.08); }
.tooltip__sector-info { font-size: 13px; color: #aaa; }
.tooltip__sector-info strong { color: #fff; font-family: 'IBM Plex Mono', monospace; margin-left: 4px; }
.tooltip__sector-hint { font-size: 12px; color: #4ADE80; margin-top: 6px; font-weight: 600; }
.tooltip__table { width: 100%; border-collapse: collapse; }
.tooltip__table tr td { font-size: 12px; padding: 3px 0; vertical-align: top; }
.tooltip__key { color: #888; }
.tooltip__val { font-weight: 600; text-align: right; color: #fff; }
.tooltip__desc-section { padding: 10px 16px 14px; border-top: 1px solid rgba(255,255,255,.08); }
.tooltip__desc { font-size: 11.5px; color: #999; line-height: 1.55; margin-bottom: 10px; }
.tooltip__reason {
  border-left: 3px solid; padding: 8px 10px;
  background: rgba(255,255,255,.04); border-radius: 0 6px 6px 0;
}
.tooltip__reason-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; display: block; margin-bottom: 4px; }
.tooltip__reason-text { font-size: 11px; color: #ccc; line-height: 1.6; margin: 0; }

/* ── Modal ── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  font-family: 'IBM Plex Sans', sans-serif;
}
.modal-box {
  background: rgba(26, 26, 30, 0.75); border: 1px solid rgba(255,255,255,.15);
  border-radius: 12px; padding: 30px; width: 90%; max-width: 520px;
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 25px 50px -12px rgba(0,0,0,.7); color: #eee;
}
.modal-box__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-box__header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }
.modal-box__close { background: transparent; border: none; color: #888; cursor: pointer; font-size: 24px; line-height: 1; }
.modal-box__body { display: flex; flex-direction: column; gap: 16px; font-size: 13px; color: #bbb; line-height: 1.5; }
.source-item strong { color: #ddd; font-size: 14px; }
.modal-box__footer { margin-top: 24px; text-align: right; }
.btn-secondary { background: #2A2A2E; color: #fff; border: 1px solid #444; padding: 8px 20px; border-radius: 4px; font-weight: 500; cursor: pointer; }
</style>
