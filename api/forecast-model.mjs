import readExcelFile from 'read-excel-file/node'

const compact = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
const aliases = {
  orderId: ['madonhang'], orderDate: ['thoigiandathang'], status: ['trangthaidon'],
}
const isMegaSaleDate = date => date.getDate() === date.getMonth() + 1
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const mean = values => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') return new Date(Math.round((value - 25569) * 86400 * 1000))
  const parsed = new Date(String(value ?? '').replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function rowsFromTable(data) {
  const headerIndex = data.findIndex(row => {
    const cells = row.map(compact)
    return cells.includes('madonhang') && cells.includes('thoigiandathang')
  })
  if (headerIndex < 0) return null
  const headers = data[headerIndex].map(value => String(value ?? '').trim())
  const keys = Object.fromEntries(Object.entries(aliases).map(([name, names]) => [name, headers.find(header => names.includes(compact(header)))]))
  if (!keys.orderId || !keys.orderDate) return null
  return data.slice(headerIndex + 1).filter(row => row.some(cell => cell !== null && cell !== '')).map(row => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index]]))
    return { orderId: record[keys.orderId], orderDate: record[keys.orderDate], status: keys.status ? record[keys.status] : '' }
  })
}

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += char
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export async function extractOrders(buffer, fileName) {
  const tables = fileName.toLowerCase().endsWith('.csv')
    ? [{ sheet: fileName, data: parseCsv(buffer.toString('utf8')) }]
    : await readExcelFile(buffer)
  for (const sheet of tables) {
    const rows = rowsFromTable(sheet.data)
    if (!rows) continue
    const unique = new Map()
    for (const row of rows) {
      const id = String(row.orderId ?? '').trim(); const date = parseDate(row.orderDate)
      if (id && date && String(row.status ?? '').trim() !== 'Đã hủy') unique.set(id, date)
    }
    return { orders: [...unique.values()].sort((a, b) => a - b), sheetName: sheet.sheet }
  }
  throw new Error('Không tìm thấy sheet có cột Mã Đơn Hàng và Thời Gian Đặt Hàng.')
}

function solve(matrix, vector) {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    const divisor = Math.abs(augmented[column][column]) < 1e-10 ? 1e-10 : augmented[column][column]
    for (let cell = column; cell <= size; cell += 1) augmented[column][cell] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let cell = column; cell <= size; cell += 1) augmented[row][cell] -= factor * augmented[column][cell]
    }
  }
  return augmented.map(row => row[size])
}

function fitRidge(rawX, y, lambda = 8) {
  const width = rawX[0].length
  const centers = Array(width).fill(0), scales = Array(width).fill(1)
  for (let column = 1; column < width; column += 1) {
    centers[column] = mean(rawX.map(row => row[column]))
    const variance = mean(rawX.map(row => (row[column] - centers[column]) ** 2))
    scales[column] = Math.sqrt(variance) || 1
  }
  const x = rawX.map(row => row.map((value, column) => column ? (value - centers[column]) / scales[column] : value))
  const gram = Array.from({ length: width }, () => Array(width).fill(0)); const target = Array(width).fill(0)
  for (let row = 0; row < x.length; row += 1) for (let a = 0; a < width; a += 1) {
    target[a] += x[row][a] * y[row]
    for (let b = 0; b < width; b += 1) gram[a][b] += x[row][a] * x[row][b]
  }
  for (let index = 1; index < width; index += 1) gram[index][index] += lambda
  return { coefficients: solve(gram, target), centers, scales }
}

function predict(model, raw) {
  return model.coefficients.reduce((sum, coefficient, index) => sum + coefficient * (index ? (raw[index] - model.centers[index]) / model.scales[index] : raw[index]), 0)
}

function calendarFeatures(date, trend, lags) {
  const hour = date.getHours(), dow = date.getDay()
  return [1, trend, Math.sin(2 * Math.PI * hour / 24), Math.cos(2 * Math.PI * hour / 24), Math.sin(2 * Math.PI * dow / 7), Math.cos(2 * Math.PI * dow / 7), dow === 0 || dow === 6 ? 1 : 0, isMegaSaleDate(date) ? 1 : 0, ...lags]
}

function metrics(actual, predicted) {
  const errors = actual.map((value, index) => value - predicted[index])
  return {
    mae: mean(errors.map(Math.abs)),
    rmse: Math.sqrt(mean(errors.map(value => value ** 2))),
    smape: mean(actual.map((value, index) => Math.abs(value - predicted[index]) / Math.max((Math.abs(value) + Math.abs(predicted[index])) / 2, 1))) * 100,
  }
}

export function trainTimeSeries(orders, forecastDate) {
  if (orders.length < 30) throw new Error('Cần tối thiểu 30 đơn hàng hợp lệ để huấn luyện mô hình.')
  const start = new Date(orders[0]); start.setMinutes(0, 0, 0)
  const end = new Date(orders.at(-1)); end.setMinutes(0, 0, 0)
  const points = Math.round((end - start) / 3600000) + 1
  const series = Array(points).fill(0)
  for (const order of orders) {
    const index = Math.floor((order - start) / 3600000)
    if (index >= 0 && index < series.length) series[index] += 1
  }
  const x = [], y = []
  for (let index = 168; index < series.length; index += 1) {
    const date = new Date(start.getTime() + index * 3600000)
    const lags = [series[index - 1], series[index - 24], series[index - 168], mean(series.slice(index - 24, index)), mean(series.slice(index - 168, index))]
    x.push(calendarFeatures(date, index / Math.max(series.length - 1, 1), lags)); y.push(series[index])
  }
  if (x.length < 72) throw new Error('Dữ liệu cần phủ ít nhất 10 ngày để tạo đặc trưng lag theo tuần.')
  const validationSize = Math.min(14 * 24, Math.max(48, Math.floor(x.length * .2)))
  const split = x.length - validationSize
  const validationModel = fitRidge(x.slice(0, split), y.slice(0, split))
  const validationPredictions = x.slice(split).map(row => Math.max(0, predict(validationModel, row)))
  const validation = metrics(y.slice(split), validationPredictions)
  const naive = metrics(y.slice(split), y.slice(split).map((_, index) => y[Math.max(0, split + index - 168)]))
  const model = fitRidge(x, y)

  const byHour = Array.from({ length: 24 }, (_, hour) => mean(series.filter((_, index) => new Date(start.getTime() + index * 3600000).getHours() === hour)))
  const byDowHour = Array.from({ length: 7 }, (_, dow) => Array.from({ length: 24 }, (_, hour) => {
    const values = series.filter((_, index) => { const date = new Date(start.getTime() + index * 3600000); return date.getDay() === dow && date.getHours() === hour })
    return mean(values)
  }))
  const recent24 = mean(series.slice(-24)), recent168 = mean(series.slice(-168)), last = series.at(-1)
  const target = new Date(`${forecastDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) throw new Error('Ngày dự báo không hợp lệ.')
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const date = new Date(target); date.setHours(hour)
    const lags = [last, byHour[hour], byDowHour[date.getDay()][hour], recent24, recent168]
    return Math.max(.01, predict(model, calendarFeatures(date, 1, lags)))
  })
  const slotWeights = Array.from({ length: 8 }, (_, index) => hourly.slice(8 + index * 2, 10 + index * 2).reduce((sum, value) => sum + value, 0))
  const slotTotal = slotWeights.reduce((sum, value) => sum + value, 0) || 1

  const daily = new Map()
  for (const order of orders) daily.set(dayKey(order), (daily.get(dayKey(order)) || 0) + 1)
  const megaValues = [], regularValues = []
  for (const [key, count] of daily) (isMegaSaleDate(new Date(`${key}T12:00:00`)) ? megaValues : regularValues).push(count)
  const rawUplift = mean(megaValues) / Math.max(mean(regularValues), 1)
  const shrunkUplift = clamp(1 + (rawUplift - 1) * megaValues.length / (megaValues.length + 5), .8, 2.5)
  return {
    modelName: 'Ridge Regression chuỗi thời gian',
    target: 'Số đơn theo giờ',
    trainingPoints: x.length,
    trainingOrders: orders.length,
    validation: { mae: +validation.mae.toFixed(3), rmse: +validation.rmse.toFixed(3), smape: +validation.smape.toFixed(1), seasonalNaiveMae: +naive.mae.toFixed(3) },
    features: ['Giờ', 'Thứ trong tuần', 'Cuối tuần', 'Mega Sale', 'Lag 1h', 'Lag 24h', 'Lag 168h', 'TB trượt 24h', 'TB trượt 168h'],
    megaSale: { isMegaSale: isMegaSaleDate(target), historicDays: megaValues.length, observedUplift: +shrunkUplift.toFixed(3), observedChangePercent: +((shrunkUplift - 1) * 100).toFixed(1), rule: 'Ngày có số ngày trùng số tháng: 6/6, 7/7, 8/8, …' },
    forecastDate,
    predictedDailyBaseline: +hourly.reduce((sum, value) => sum + value, 0).toFixed(1),
    hourlyWeights: hourly.map(value => +value.toFixed(6)),
    slotWeights: slotWeights.map(value => +(value / slotTotal).toFixed(6)),
  }
}
