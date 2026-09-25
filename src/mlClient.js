function toBase64(buffer) {
  const bytes = new Uint8Array(buffer); const chunkSize = 0x8000; let binary = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}

export async function runMlForecast(file, assumptions) {
  const response = await fetch('/api/ml/forecast', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, fileBase64: toBase64(await file.arrayBuffer()), assumptions }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Backend ML không phản hồi.')
  return payload
}
