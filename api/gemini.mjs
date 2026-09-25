const fallbackInsight = model => ({
  enabled: false,
  headline: 'Gemini chưa được cấu hình',
  summary: 'Mô hình ML vẫn hoạt động độc lập. Cấu hình khóa Gemini tương ứng ở backend để nhận phần giải thích tự động.',
  actions: [],
})

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function requestGemini(url, options) {
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(35000) })
      if (response.ok) return response
      const payload = await response.json().catch(() => ({}))
      const providerMessage = payload?.error?.message
      const error = new Error(providerMessage ? `Gemini ${response.status}: ${providerMessage}` : `Gemini ${response.status}`)
      error.status = response.status
      error.retryable = response.status === 429 || response.status >= 500
      throw error
    } catch (error) {
      lastError = error
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError'
      if (attempt === 1 || (!timedOut && !error.retryable)) throw error
      await wait(800)
    }
  }
  throw lastError
}

export async function explainWithGemini(model, business, purpose = 'forecast') {
  const apiKey = purpose === 'planning'
    ? process.env.GEMINI_PLANNING_API_KEY
    : process.env.GEMINI_FORECAST_API_KEY
  if (!apiKey) return fallbackInsight(model)
  const modelIds = [...new Set([
    process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite',
  ])]
  const role = purpose === 'planning' ? 'lập kế hoạch nhân sự, hàng hóa và vật tư' : 'phân tích dự báo nhu cầu'
  const prompt = `Bạn là chuyên gia ${role} cho thương mại điện tử. Hãy trả lời ngắn gọn bằng tiếng Việt, không tự tạo số liệu.\nMô hình ML: ${JSON.stringify(model)}\nGiả định và phép tính kinh doanh đã xác nhận: ${JSON.stringify(business)}\nQuy tắc bắt buộc: gọi observedUplift là "hệ số Mega Sale", không gọi là phần trăm tăng trưởng; dùng observedChangePercent để nói tăng hay giảm. Đơn dự báo nhu cầu là computed.forecastOrders, còn khối lượng vận hành gồm backlog là computed.workload. Nếu computed.hasEnoughCapacity=true thì tuyệt đối không nói quá tải hoặc thiếu công suất. Nêu rõ tác động Mega Sale và tối đa 3 hành động phù hợp với vai trò của bạn.`
  const schema = {
    type: 'OBJECT', properties: {
      headline: { type: 'STRING' }, summary: { type: 'STRING' },
      actions: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 3 },
    }, required: ['headline', 'summary', 'actions'],
  }
  const failures = []
  for (const modelId of modelIds) {
    try {
      const response = await requestGemini(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: .2 } }),
      })
      const payload = await response.json()
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
      return { enabled: true, providerModel: modelId, ...JSON.parse(text) }
    } catch (error) {
      failures.push(`${modelId}: ${error.message}`)
    }
  }
  return { ...fallbackInsight(model), headline: 'Gemini tạm thời không khả dụng', summary: `${failures.join(' | ') || 'Không có phản hồi'}. Kết quả ML vẫn được giữ nguyên.` }
}
