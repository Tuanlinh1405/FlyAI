import readExcelFile from 'read-excel-file/browser'

const compact = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const timeMinutes = value => {
  const [hour, minute] = String(value || '00:00').split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}
const fieldLabels = { orderId: 'Mã đơn hàng', orderDate: 'Thời gian đặt hàng', sku: 'Mã SKU', product: 'Tên sản phẩm', quantity: 'Số lượng', revenue: 'Tổng tiền hàng', processingMinutes: 'Thời gian xử lý', status: 'Trạng thái đơn' }
const aliases = {
  orderId: ['madonhang','orderid','orderno','ordernumber','madon'], orderDate: ['thoigiandathang','ngaydathang','orderdate','createdat','createdtime','orderdatetime'],
  month: ['thang','month'], customer: ['makhachhang','customerid'], channel: ['kenhbanhang','channel','saleschannel','platform','san'],
  region: ['khuvucgiaohang','region','province','city','tinhthanh'], sku: ['masku','sku','skuid','productsku'], product: ['tensanpham','productname','itemname','sanpham'],
  color: ['mausac','color'], size: ['kichco','size'], quantity: ['soluong','quantity','qty'], price: ['dongia','unitprice','price'],
  revenue: ['tongtienhang','thanhtien','doanhthu','revenue','linetotal','totalamount','amount'], confirmDate: ['thoigianxacnhandonhang','confirmationtime','confirmedat'],
  completeDate: ['thoigianhoantatdonhang','completiontime','completedat'], processingMinutes: ['thoigianxulythuctephut','thoigianxuly','processingminutes','processingtime','fulfillmentminutes'],
  status: ['trangthaidon','trangthai','orderstatus','status'],
}

function findHeader(headers, names) {
  const normalized = headers.map(header => ({ header, key: compact(header) }))
  return normalized.find(item => names.includes(item.key))?.header || normalized.find(item => names.some(alias => item.key.includes(alias) || alias.includes(item.key)))?.header
}
export function detectColumns(headers) {
  return Object.fromEntries(Object.entries(aliases).map(([name, names]) => [name, findHeader(headers, names)]))
}
function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400 * 1000))
  const parsed = new Date(String(value ?? '').trim().replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
function tableFromSheet(data) {
  const headerIndex = data.findIndex(row => { const cells = row.map(compact); return cells.some(cell => aliases.orderId.includes(cell)) && cells.some(cell => aliases.sku.includes(cell)) })
  if (headerIndex < 0) return null
  const headers = data[headerIndex].map(value => String(value ?? '').trim())
  const keys = detectColumns(headers)
  const required = ['orderId','orderDate','sku','product','quantity','revenue','processingMinutes','status']
  const missing = required.filter(name => !keys[name])
  if (missing.length) throw new Error(`Thiếu cột bắt buộc: ${missing.map(name => fieldLabels[name]).join(', ')}`)
  const rows = data.slice(headerIndex + 1).filter(row => row.some(cell => cell !== null && cell !== '')).map(row => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]]))
    return Object.fromEntries(Object.entries(keys).map(([name, header]) => [name, header ? record[header] : null]))
  })
  return { rows, mapping: Object.fromEntries(Object.entries(keys).filter(([, value]) => value)) }
}
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0]
  const delimiter = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const rows = []; let row = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export async function analyzeUpload(file) {
  const tables = /\.csv$/i.test(file.name) ? [{ sheet: file.name, data: parseCsv(await file.text()) }] : await readExcelFile(file)
  for (const sheet of tables) {
    const parsed = tableFromSheet(sheet.data)
    if (parsed) return analyzeRows(parsed.rows, file.name, sheet.sheet, parsed.mapping)
  }
  throw new Error('Không tìm thấy bảng chi tiết có Mã đơn hàng và Mã SKU. Hãy kiểm tra tên cột hoặc sheet dữ liệu.')
}

function analyzeRows(rows, fileName, sheetName, mapping = {}) {
  const orders = new Map(), skuMap = new Map(), channels = new Map(), regions = new Map(), months = new Map(), statuses = new Map()
  let grossRevenue = 0, grossUnits = 0, netRevenue = 0, netUnits = 0, invalidDates = 0, missingIds = 0, missingSkus = 0
  for (const row of rows) {
    const orderId = String(row.orderId ?? '').trim(), sku = String(row.sku ?? '').trim()
    if (!orderId) { missingIds += 1; continue }
    if (!sku) missingSkus += 1
    const date = parseDate(row.orderDate); if (!date) invalidDates += 1
    const quantity = Math.max(0, safeNumber(row.quantity)), revenue = Math.max(0, safeNumber(row.revenue)), status = String(row.status ?? '').trim()
    const sellable = status === 'Hoàn thành' || status === 'Đang giao' || /complete|shipping|delivered/i.test(status)
    grossRevenue += revenue; grossUnits += quantity
    if (sellable) { netRevenue += revenue; netUnits += quantity }
    const current = orders.get(orderId) || { id: orderId, date, channel: row.channel, region: row.region, status, processingMinutes: safeNumber(row.processingMinutes), units: 0, revenue: 0 }
    current.units += quantity; current.revenue += revenue; orders.set(orderId, current)
    if (!sku) continue
    const item = skuMap.get(sku) || { sku, name: String(row.product ?? sku), units: 0, revenue: 0, orders: new Set(), datedUnits: [] }
    if (sellable) { item.units += quantity; item.revenue += revenue; item.orders.add(orderId); if (date) item.datedUnits.push({ date, quantity }) }
    skuMap.set(sku, item)
  }
  const orderList = [...orders.values()].filter(order => order.date)
  const validOrders = orderList.filter(order => order.status !== 'Đã hủy' && !/cancel/i.test(order.status))
  for (const order of orderList) {
    const month = `${order.date.getFullYear()}-${String(order.date.getMonth() + 1).padStart(2, '0')}`
    months.set(month, (months.get(month) || 0) + 1)
    channels.set(String(order.channel || 'Không xác định'), (channels.get(String(order.channel || 'Không xác định')) || 0) + 1)
    regions.set(String(order.region || 'Không xác định'), (regions.get(String(order.region || 'Không xác định')) || 0) + 1)
    statuses.set(order.status, (statuses.get(order.status) || 0) + 1)
  }
  const dates = orderList.map(order => order.date).sort((a, b) => a - b), latest = dates.at(-1) || new Date()
  const recentStart = new Date(latest); recentStart.setDate(recentStart.getDate() - 30)
  const priorStart = new Date(latest); priorStart.setDate(priorStart.getDate() - 60)
  const skuItems = [...skuMap.values()].map(item => {
    const recentUnits = item.datedUnits.filter(entry => entry.date > recentStart).reduce((sum, entry) => sum + entry.quantity, 0)
    const priorUnits = item.datedUnits.filter(entry => entry.date > priorStart && entry.date <= recentStart).reduce((sum, entry) => sum + entry.quantity, 0)
    return { sku: item.sku, name: item.name, units: item.units, revenue: item.revenue, orders: item.orders.size, recentUnits, priorUnits, trendFactor: clamp((recentUnits + 3) / (priorUnits + 3), .6, 1.6) }
  }).sort((a, b) => b.units - a.units || b.revenue - a.revenue)
  const processing = orderList.map(order => order.processingMinutes).filter(value => Number.isFinite(value) && value >= 0)
  const daily = new Map()
  for (const order of validOrders) { const key = `${order.date.getFullYear()}-${String(order.date.getMonth() + 1).padStart(2, '0')}-${String(order.date.getDate()).padStart(2, '0')}`; daily.set(key, (daily.get(key) || 0) + 1) }
  const campaigns = [...daily].filter(([key]) => { const date = new Date(`${key}T12:00:00`); return date.getDate() === date.getMonth() + 1 }).map(([date, count]) => ({ date, orders: count, type: 'Mega Sale' })).sort((a, b) => b.date.localeCompare(a.date))
  const issues = [invalidDates && `${invalidDates} dòng sai ngày`, missingIds && `${missingIds} dòng thiếu mã đơn`, missingSkus && `${missingSkus} dòng thiếu SKU`].filter(Boolean)
  return {
    source: { fileName, sheetName, rows: rows.length, orders: orderList.length, skus: skuMap.size, months: months.size, from: dates[0], to: dates.at(-1), uploaded: true, mapping },
    quality: { score: clamp(Math.round((1 - (invalidDates + missingIds + missingSkus) / Math.max(rows.length, 1)) * 100), 0, 100), issues, recognizedColumns: Object.keys(mapping).length },
    summary: { grossRevenue, grossUnits, netRevenue, netUnits, avgProcessingMinutes: processing.reduce((a, b) => a + b, 0) / Math.max(processing.length, 1), avgItemsPerOrder: netUnits / Math.max(validOrders.length, 1), cancelRate: (statuses.get('Đã hủy') || 0) / Math.max(orderList.length, 1), returnRate: (statuses.get('Hoàn hàng') || 0) / Math.max(orderList.length, 1), dailyAverage: validOrders.length / Math.max(daily.size, 1) },
    months: [...months].sort().map(([month, count]) => ({ month, orders: count })), campaigns,
    channels: [...channels].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, orders: count })), regions: [...regions].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, orders: count })),
    statuses: [...statuses].map(([name, count]) => ({ name, orders: count })), skus: skuItems, topSkus: skuItems.slice(0, 12),
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: validOrders.filter(order => order.date.getHours() === hour).length })),
  }
}

export function deriveScenario(data, assumptions) {
  const funnelOrders = Math.max(0, safeNumber(assumptions.traffic) * safeNumber(assumptions.conversion) / 100)
  const baselineOrders = Math.max(1, safeNumber(data.ml?.predictedDailyBaseline, data.summary.dailyAverage || data.source.orders / Math.max(data.source.months * 30, 1)))
  const campaignFactors = { 'Mega Sale': data.ml?.megaSale?.observedUplift || 1.15, Livestream: 1.08, 'Payday Sale': 1.12, 'Seasonal & Festive': 1.18, 'Time & Behavioral': 1.05 }
  const campaignFactor = campaignFactors[assumptions.campaignType] || 1
  const marketingFactor = clamp(1 + safeNumber(assumptions.discount) * .004 + Math.min(safeNumber(assumptions.voucher) / Math.max(safeNumber(assumptions.traffic), 1), .08) + (assumptions.freeship ? .05 : 0) + (assumptions.banner ? .04 : 0) + (assumptions.flashSale ? .06 : 0), .8, 1.6)
  const modelScenario = baselineOrders * campaignFactor * marketingFactor, modelWeight = data.ml ? .35 : 0
  const forecastOrders = Math.max(0, Math.round(funnelOrders * (1 - modelWeight) + modelScenario * modelWeight))
  const hourlyError = safeNumber(data.ml?.validation?.mae, Math.sqrt(Math.max(forecastOrders, 1)) / 24), uncertainty = Math.max(Math.sqrt(Math.max(forecastOrders, 1)), hourlyError * 24 * 1.28)
  const interval = { low: Math.max(0, Math.round(forecastOrders - uncertainty)), high: Math.round(forecastOrders + uncertainty), level: 80 }
  const slotLabels = ['08–10','10–12','12–14','14–16','16–18','18–20','20–22','22–24']
  const learnedWeights = data.ml?.slotWeights
  const rawWeights = Array.isArray(learnedWeights) && learnedWeights.length === slotLabels.length ? learnedWeights : slotLabels.map((_, index) => data.hourly.slice(8 + index * 2, 10 + index * 2).reduce((sum, item) => sum + item.orders, 0))
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0) || 1
  const slots = slotLabels.map((label, index) => ({ label, orders: Math.round(forecastOrders * rawWeights[index] / totalWeight), startHour: 8 + index * 2, duration: 2 }))
  slots.at(-1).orders += forecastOrders - slots.reduce((sum, slot) => sum + slot.orders, 0)
  const skuPool = data.skus?.length ? data.skus : data.topSkus
  const weightedSkuTotal = skuPool.reduce((sum, sku) => sum + Math.max(sku.units, 0) * (sku.trendFactor || 1), 0) || 1
  const expectedUnits = forecastOrders * safeNumber(assumptions.itemsPerOrder, data.summary.avgItemsPerOrder || 1)
  const forecastSkus = skuPool.map(sku => { const weight = sku.units * (sku.trendFactor || 1) / weightedSkuTotal; return { ...sku, forecastUnits: Math.max(0, Math.round(expectedUnits * weight)), share: weight, changePercent: Math.round(((sku.trendFactor || 1) - 1) * 100) } }).sort((a, b) => b.forecastUnits - a.forecastUnits)
  const startMinute = timeMinutes(assumptions.startTime || '20:00'); let cutoffMinute = timeMinutes(assumptions.cutoffTime || '23:30'); if (cutoffMinute <= startMinute) cutoffMinute += 1440
  const availableHours = Math.max(.5, (cutoffMinute - startMinute) / 60), efficiency = clamp(safeNumber(assumptions.efficiency, 85) / 100, .4, 1), workload = forecastOrders + Math.max(0, safeNumber(assumptions.backlog))
  const stageDefinitions = [['confirm','Xác nhận đơn'],['print','In vận đơn'],['picking','Lấy hàng'],['packing','Đóng gói'],['handoff','Bàn giao']]
  const stages = stageDefinitions.map(([key, name]) => { const staff = Math.max(0, safeNumber(assumptions[`${key}Staff`])); const rate = Math.max(1, safeNumber(assumptions[`${key}Rate`], key === 'packing' ? 40 : 60)); const capacity = Math.round(staff * rate * availableHours * efficiency); const requiredStaff = workload ? Math.ceil(workload / (rate * availableHours * efficiency)) : 0; const shortage = Math.max(0, workload - capacity); const utilization = capacity ? workload / capacity : Infinity; return { key, name, workload, staff, rate, capacity, requiredStaff, extraStaff: Math.max(0, requiredStaff - staff), shortage, utilization, status: shortage <= 0 ? 'Ổn định' : utilization > 1.2 ? 'Vượt năng lực' : 'Cảnh báo' } })
  const bottleneck = [...stages].sort((a, b) => b.utilization - a.utilization)[0], capacity = Math.min(...stages.map(stage => stage.capacity)), shortage = Math.max(0, workload - capacity)
  const currentStaff = stages.reduce((sum, stage) => sum + stage.staff, 0), requiredStaff = stages.reduce((sum, stage) => sum + stage.requiredStaff, 0), extraStaff = stages.reduce((sum, stage) => sum + stage.extraStaff, 0)
  const slotStaffFactor = [.45,.5,.55,.65,.75,.9,1,.7], eventSlot = Math.max(0, slots.findIndex(item => item.startHour >= Math.floor(startMinute / 60))), backlog = safeNumber(assumptions.backlog)
  const backlogAllocation = slots.map((_, index) => index === Math.max(0,eventSlot-1) ? Math.round(backlog*.25) : index === eventSlot ? Math.round(backlog*.5) : index === Math.min(slots.length-1,eventSlot+1) ? backlog-Math.round(backlog*.75) : 0)
  const staffBySlot = slots.map((slot, index) => { const slotWorkload = slot.orders + backlogAllocation[index]; const required = stages.reduce((sum, stage) => sum + Math.ceil(slotWorkload / Math.max(stage.rate * slot.duration * efficiency, 1)), 0); const current = Math.round(currentStaff * slotStaffFactor[index]); return { label: slot.label, demand: slot.orders, backlog: backlogAllocation[index], workload: slotWorkload, current, recommended: Math.max(current, required), extra: Math.max(0, required - current), overloadRate: current ? Math.max(0, (required - current) / current * 100) : 100 } })
  const overloadedSlot = [...staffBySlot].sort((a, b) => b.overloadRate - a.overloadRate)[0]
  const materialSpecs = [['bags','Túi đóng gói',1],['cartons','Hộp carton',safeNumber(assumptions.cartonRate, 35) / 100],['tape','Cuộn băng keo',1 / Math.max(1, safeNumber(assumptions.ordersPerTape, 25))],['labels','Phiếu vận đơn',1]]
  const materials = materialSpecs.map(([key, name, perOrder]) => { const need = Math.ceil(forecastOrders * perOrder * 1.05), available = Math.max(0, safeNumber(assumptions[key])), difference = available - need; return { key, name, need, available, difference, readiness: need ? clamp(available / need, 0, 1) : 1, status: difference >= 0 ? 'Đủ dùng' : available >= need * .8 ? 'Cần bổ sung' : 'Thiếu hàng' } })
  const productReadiness = clamp(safeNumber(assumptions.availableToPromise) / Math.max(expectedUnits, 1), 0, 1), staffingReadiness = clamp(currentStaff / Math.max(requiredStaff, 1), 0, 1), materialReadiness = materials.reduce((sum, item) => sum + item.readiness, 0) / materials.length, capacityReadiness = clamp(capacity / Math.max(workload, 1), 0, 1), stagingReadiness = clamp(safeNumber(assumptions.staging) / Math.max(forecastOrders, 1), 0, 1)
  const readiness = Math.round((productReadiness * .25 + staffingReadiness * .25 + materialReadiness * .2 + capacityReadiness * .2 + stagingReadiness * .1) * 100)
  const risk = shortage > capacity * .2 || overloadedSlot.overloadRate > 30 ? 'Cao' : shortage > 0 || overloadedSlot.overloadRate > 0 ? 'Trung bình' : 'Thấp'
  return { forecastOrders, funnelOrders: Math.round(funnelOrders), modelBaseline: Math.round(baselineOrders), modelScenario: Math.round(modelScenario), campaignFactor, marketingFactor, interval, expectedUnits: Math.round(expectedUnits), workload, availableHours, slots, topSkus: forecastSkus.slice(0, 5), forecastSkus, stages, bottleneck, capacity, shortage, delayedOrders: shortage, currentStaff, requiredStaff, extraStaff, staffBySlot, overloadedSlot, materials, materialReadiness: Math.round(materialReadiness * 100), productReadiness: Math.round(productReadiness * 100), staffingReadiness: Math.round(staffingReadiness * 100), capacityReadiness: Math.round(capacityReadiness * 100), stagingReadiness: Math.round(stagingReadiness * 100), risk, readiness, cutoffReadiness: Math.round(capacityReadiness * 100) }
}

export const DEFAULT_ANALYSIS = {
  source: { fileName: '', sheetName: '', rows: 0, orders: 0, skus: 0, months: 0, from: null, to: null, uploaded: false, mapping: {} },
  quality: null,
  summary: { grossRevenue: 0, grossUnits: 0, netRevenue: 0, netUnits: 0, avgProcessingMinutes: 0, avgItemsPerOrder: 0, cancelRate: 0, returnRate: 0, dailyAverage: 0 },
  months: [], campaigns: [], channels: [], regions: [], statuses: [], topSkus: [], skus: [],
  hourly: Array.from({length:24},(_,hour)=>({hour,orders:0})),
}
