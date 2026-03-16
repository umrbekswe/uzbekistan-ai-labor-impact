// ──────────────────────────────────────────────
// TREEMAP UTILITIES (Pure JS — Vue da ham ishlaydi)
// ──────────────────────────────────────────────

export function getAIFill(score) {
  if (score <= 1) return '#1B3D1B'
  if (score <= 2) return '#24481E'
  if (score <= 3) return '#3D5A1E'
  if (score <= 4) return '#4A5D1A'
  if (score <= 5) return '#5C5A18'
  if (score <= 6) return '#6B4E15'
  if (score <= 7) return '#7A3D12'
  if (score <= 8) return '#8B2D0E'
  if (score <= 9) return '#993318'
  return '#8B1A1A'
}

export function getAIBarColor(score) {
  if (score <= 2) return '#4ADE80'
  if (score <= 4) return '#A3E635'
  if (score <= 6) return '#FBBF24'
  if (score <= 8) return '#FB923C'
  return '#EF4444'
}

export function getLegendColor(score) {
  if (score <= 1) return '#2D6B2D'
  if (score <= 3) return '#4D7C0F'
  if (score <= 5) return '#A16207'
  if (score <= 7) return '#C2410C'
  return '#DC2626'
}

export function formatJobs(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

export function formatPay(n) {
  return new Intl.NumberFormat('uz-UZ').format(n)
}

function worstR(row, rSum, side, total) {
  if (side <= 0 || rSum <= 0) return Infinity
  const rf = rSum / total
  let mx = 0
  for (const it of row) {
    const w2 = side * rf, h2 = side * (it.value / rSum)
    if (h2 <= 0) continue
    mx = Math.max(mx, Math.max(w2 / h2, h2 / w2))
  }
  return mx
}

export function squarify(items, x, y, w, h) {
  if (!items.length || w <= 0 || h <= 0) return []
  const total = items.reduce((s, it) => s + it.value, 0)
  if (total <= 0) return []
  const result = []
  let rem = items.map(it => ({ ...it }))
  let cx = x, cy = y, cw = w, ch = h

  while (rem.length > 0) {
    const remTot = rem.reduce((s, it) => s + it.value, 0)
    const wide = cw >= ch
    const side = wide ? ch : cw
    if (side <= 0 || remTot <= 0) break

    let row = [rem[0]], rSum = rem[0].value
    for (let i = 1; i < rem.length; i++) {
      const ns = rSum + rem[i].value
      const nr = [...row, rem[i]]
      if (worstR(row, rSum, side, remTot) >= worstR(nr, ns, side, remTot)) {
        row = nr; rSum = ns
      } else break
    }

    const frac = rSum / remTot
    const rLen = wide ? cw * frac : ch * frac
    let off = 0
    for (const it of row) {
      const f = it.value / rSum
      const sz = side * f
      wide
        ? result.push({ ...it, rx: cx, ry: cy + off, rw: rLen, rh: sz })
        : result.push({ ...it, rx: cx + off, ry: cy, rw: sz, rh: rLen })
      off += sz
    }
    if (wide) { cx += rLen; cw -= rLen } else { cy += rLen; ch -= rLen }
    rem = rem.slice(row.length)
  }
  return result
}
