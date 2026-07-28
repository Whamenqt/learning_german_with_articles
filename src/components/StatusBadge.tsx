import type { ArticleStatus } from '@/lib/types'

const LABELS: Record<ArticleStatus, string> = {
  new: 'New',
  extracting: 'Extracting',
  generating: 'Generating',
  draft: 'Draft',
  published: 'Published',
  error: 'Error',
  archived: 'Archived',
}

const MODIFIER: Partial<Record<ArticleStatus, string>> = {
  draft: 'badge--draft',
  published: 'badge--published',
  error: 'badge--error',
  archived: 'badge--archived',
}

export function StatusBadge({ status }: { status: ArticleStatus }) {
  return <span className={`badge ${MODIFIER[status] ?? ''}`}>{LABELS[status]}</span>
}
