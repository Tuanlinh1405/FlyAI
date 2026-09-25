import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { trainTimeSeries } from './forecast-model.mjs'

const script = fileURLToPath(new URL('./boosting_model.py', import.meta.url))
const localTimestamp = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}`

export async function trainBestTimeSeries(orders, forecastDate) {
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.env.PYTHON_BIN || 'python', [script], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
      let stdout = '', stderr = ''
      const timer = setTimeout(() => { child.kill(); reject(new Error('Huấn luyện XGBoost quá thời gian 60 giây.')) }, 60000)
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => {
        clearTimeout(timer)
        if (code !== 0) {
          try { return reject(new Error(JSON.parse(stdout).error || stderr.trim() || 'Python ML thất bại.')) }
          catch { return reject(new Error(stderr.trim() || stdout.trim() || 'Python ML thất bại.')) }
        }
        try { resolve(JSON.parse(stdout)) } catch { reject(new Error('Python ML trả về dữ liệu không hợp lệ.')) }
      })
      child.stdin.end(JSON.stringify({ orders: orders.map(localTimestamp), forecastDate }))
    })
    if (result.error) throw new Error(result.error)
    return result
  } catch (error) {
    const fallback = trainTimeSeries(orders, forecastDate)
    return { ...fallback, selectedModel: 'Ridge Regression', candidates: [{ name: 'Ridge Regression', ...fallback.validation }], selectionReason: 'Fallback Ridge vì XGBoost chưa khả dụng', fallbackReason: error.message, xgboostAvailable: false }
  }
}
