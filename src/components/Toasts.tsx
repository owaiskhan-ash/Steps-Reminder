import { useEffect } from 'react'
import { Bell, Close } from './Icons'

export type ToastItem = {
  id: number
  title: string
  body: string
}

type Props = {
  items: ToastItem[]
  onDismiss: (id: number) => void
}

export function Toasts({ items, onDismiss }: Props) {
  return (
    <div className="toast-wrap" aria-live="polite">
      {items.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => onDismiss(item.id), 6200)
    return () => window.clearTimeout(id)
  }, [item.id, onDismiss])

  return (
    <div className="toast" role="status">
      <span className="toast-icon">
        <Bell size={17} />
      </span>
      <div style={{ flex: 1 }}>
        <div className="toast-title">{item.title}</div>
        <div className="toast-body">{item.body}</div>
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        style={{ color: 'var(--cream-faint)', padding: 2 }}
      >
        <Close size={15} />
      </button>
    </div>
  )
}
