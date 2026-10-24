import type { ReactNode } from 'react'
import { Chart, Footsteps, Gear } from './Icons'

export type Tab = 'today' | 'history' | 'settings'

type Props = {
  tab: Tab
  onChange: (tab: Tab) => void
}

const ITEMS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <Footsteps size={19} /> },
  { id: 'history', label: 'Trail', icon: <Chart size={19} /> },
  { id: 'settings', label: 'Tune', icon: <Gear size={19} /> },
]

export function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Sections">
      <div className="tabbar-inner">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`tab ${tab === item.id ? 'tab--active' : ''}`}
            onClick={() => onChange(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
