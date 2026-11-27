import React from 'react';
import { Plus } from 'lucide-react';

interface TopBarProps {
  activeSection: 'workspace' | 'guide';
  onChangeSection: (section: 'workspace' | 'guide') => void;
  onAddNew: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onChangeSection,
  onAddNew,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onChangeSection('workspace');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Katalog EAN-13
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => onChangeSection('workspace')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeSection === 'workspace'
                ? 'border-blue-700 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Stanowisko robocze
          </button>
          <button
            type="button"
            onClick={() => onChangeSection('guide')}
            className={`cursor-pointer transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
              activeSection === 'guide'
                ? 'border-blue-700 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Instrukcja i skrypty GitHub
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Dodaj opakowanie
          </button>
        </div>
      </div>
    </header>
  );
};
