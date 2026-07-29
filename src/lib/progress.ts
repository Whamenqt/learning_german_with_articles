const STORAGE_KEY = 'german-learning.completed-articles'

export function getCompletedArticleIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function isArticleComplete(articleId: string): boolean {
  return getCompletedArticleIds().includes(articleId)
}

export function setArticleComplete(articleId: string, complete: boolean): string[] {
  const current = new Set(getCompletedArticleIds())
  if (complete) current.add(articleId)
  else current.delete(articleId)
  const next = [...current]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('article-progress-change', { detail: next }))
  return next
}
