import React from 'react';
import { FileText, Home, Settings } from 'lucide-react';

export type View = 'home' | 'logs' | 'settings';

type Props = {
  view: View;
  onSelect: (view: View) => void;
};

type Item = { id: View; label: string; Icon: typeof Home };

const TOP_ITEMS: Item[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'logs', label: 'Logs', Icon: FileText },
];

const BOTTOM_ITEMS: Item[] = [
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function Sidebar({ view, onSelect }: Props): JSX.Element {
  const renderItem = ({ id, label, Icon }: Item) => {
    const active = view === id;
    return (
      <li key={id}>
        <button
          type="button"
          className={`sidebar__btn${active ? ' sidebar__btn--active' : ''}`}
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          <Icon size={16} strokeWidth={1.75} />
          <span>{label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">wardlm</div>
      <ul className="sidebar__list">{TOP_ITEMS.map(renderItem)}</ul>
      <ul className="sidebar__list sidebar__list--bottom">
        {BOTTOM_ITEMS.map(renderItem)}
      </ul>
    </nav>
  );
}
