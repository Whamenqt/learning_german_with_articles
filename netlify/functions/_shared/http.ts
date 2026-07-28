export const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  }
}

export function errorResponse(statusCode: number, code: string, message: string) {
  return jsonResponse(statusCode, { error: { code, message } })
}

const MAX_SOURCE_TEXT_LENGTH = 40_000 // guardrail: "maximum source-text size" (spec section 15)

export function clampText(text: string, max = MAX_SOURCE_TEXT_LENGTH): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[...truncated, article exceeded ${max} characters...]`
}
