import http from 'node:http'
import { extractOrders } from './forecast-model.mjs'
import { trainBestTimeSeries } from './boosting.mjs'
import { explainWithGemini } from './gemini.mjs'

const port = Number(process.env.API_PORT || 8787)
const host = process.env.API_HOST || '127.0.0.1'
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const minutes = value => { const [hour, minute] = String(value || '00:00').split(':').map(Number); return number(hour) * 60 + number(minute) }
const send = (response, status, payload) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
  response.end(JSON.stringify(payload))
}
const readJson = request => new Promise((resolve, reject) => {
  const chunks = []; let size = 0
  request.on('data', chunk => { size += chunk.length; if (size > 30 * 1024 * 1024) reject(new Error('File vượt quá giới hạn 30 MB.')); else chunks.push(chunk) })
  request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new Error('Payload JSON không hợp lệ.')) } })
  request.on('error', reject)
})

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {})
  if (request.method === 'GET' && request.url === '/api/health') return send(response, 200, { ok: true, forecastGeminiConfigured: Boolean(process.env.GEMINI_FORECAST_API_KEY), planningGeminiConfigured: Boolean(process.env.GEMINI_PLANNING_API_KEY) })
  if (request.method !== 'POST' || request.url !== '/api/ml/forecast') return send(response, 404, { error: 'Không tìm thấy API.' })
  try {
    const body = await readJson(request)
    if (!body.fileBase64 || !body.fileName) throw new Error('Thiếu file dữ liệu.')
    const { orders, sheetName } = await extractOrders(Buffer.from(body.fileBase64, 'base64'), body.fileName)
    const forecastDate = body.assumptions?.eventDate || new Date().toISOString().slice(0, 10)
    const model = await trainBestTimeSeries(orders, forecastDate)
    const assumptions = body.assumptions || {}
    const funnelOrders = number(assumptions.traffic) * number(assumptions.conversion) / 100
    const campaignFactors = { 'Mega Sale': model.megaSale?.observedUplift || 1.15, Livestream: 1.08, 'Payday Sale': 1.12, 'Seasonal & Festive': 1.18, 'Time & Behavioral': 1.05 }
    const campaignFactor = campaignFactors[assumptions.campaignType] || 1
    const marketingFactor = Math.min(1.6, Math.max(.8, 1 + number(assumptions.discount) * .004 + Math.min(number(assumptions.voucher) / Math.max(number(assumptions.traffic), 1), .08) + (assumptions.freeship ? .05 : 0) + (assumptions.banner ? .04 : 0) + (assumptions.flashSale ? .06 : 0)))
    const modelScenario = number(model.predictedDailyBaseline, 1) * campaignFactor * marketingFactor
    const forecastOrders = Math.round(funnelOrders * .65 + modelScenario * .35)
    const startMinute = minutes(assumptions.startTime || '20:00'); let cutoffMinute = minutes(assumptions.cutoffTime || '23:30'); if (cutoffMinute <= startMinute) cutoffMinute += 1440
    const availableHours = Math.max(.5, (cutoffMinute - startMinute) / 60), efficiency = Math.min(1, Math.max(.4, number(assumptions.efficiency, 85) / 100))
    const stageKeys = ['confirm','print','picking','packing','handoff']
    const stageCapacities = stageKeys.map(key => Math.round(number(assumptions[`${key}Staff`]) * Math.max(1, number(assumptions[`${key}Rate`], 60)) * availableHours * efficiency))
    const capacity = Math.min(...stageCapacities)
    const workload = forecastOrders + number(assumptions.backlog)
    const business = { ...assumptions, computed: { funnelOrders: Math.round(funnelOrders), modelBaseline: model.predictedDailyBaseline, campaignFactor, marketingFactor, forecastOrders, workload, capacity, shortage: Math.max(0, workload - capacity), hasEnoughCapacity: capacity >= workload, availableHours } }
    const [gemini, planning] = await Promise.all([
      explainWithGemini(model, business, 'forecast'),
      explainWithGemini(model, business, 'planning'),
    ])
    send(response, 200, { model, gemini, planning, sheetName })
  } catch (error) {
    console.error(error)
    send(response, 400, { error: error.message || 'Không thể huấn luyện mô hình.' })
  }
})

server.listen(port, host, () => console.log(`Forecast API: http://${host}:${port}`))
