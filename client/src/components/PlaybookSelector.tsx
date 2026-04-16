import { useState, useEffect, useRef } from 'react';

import type { PlaybookConfig } from '../types';

interface PlaybookSelectorProps {
  playbooks: PlaybookConfig[];
  onSelect: (playbook: PlaybookConfig) => void;
  onCancel: () => void;
}

function fuzzyMatch(
  pattern: string,
  candidate: string,
): { score: number; matchIndices: number[] } | null {
  if (pattern.length === 0) return { score: 0, matchIndices: [] };
  const pLower = pattern.toLowerCase();
  const cLower = candidate.toLowerCase();
  const matchIndices: number[] = [];
  let ci = 0;
  for (let pi = 0; pi < pLower.length; pi++) {
    const found = cLower.indexOf(pLower[pi], ci);
    if (found === -1) return null;
    matchIndices.push(found);
    ci = found + 1;
  }
  let score = 0;
  for (let i = 0; i < matchIndices.length; i++) {
    score += 1;
    if (matchIndices[i] === 0) score += 5;
    if (i > 0 && matchIndices[i] === matchIndices[i - 1] + 1) score += 4;
    if (i > 0) score -= matchIndices[i] - matchIndices[i - 1] - 1;
  }
  return { score, matchIndices };
}

function HighlightedName({ name, matchIndices }: { name: string; matchIndices: number[] }) {
  if (matchIndices.length === 0) return <span>{name}</span>;
  const indexSet = new Set(matchIndices);
  return (
    <span>
      {[...name].map((char, i) => (
        // oxlint-disable-next-line no-array-index-key
        <span key={i} className={indexSet.has(i) ? 'font-semibold text-blue-400' : ''}>
          {char}
        </span>
      ))}
    </span>
  );
}

export default function PlaybookSelector({ playbooks, onSelect, onCancel }: PlaybookSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query
    ? playbooks
        .map((p) => ({ playbook: p, match: fuzzyMatch(query, p.name) }))
        .filter((r) => r.match !== null)
        // prettier-ignore
        .slice()
        .toSorted((a, b) => b.match!.score - a.match!.score)
        .map((r) => ({ playbook: r.playbook, matchIndices: r.match!.matchIndices }))
    : playbooks.map((p) => ({ playbook: p, matchIndices: [] as number[] }));

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      if (filtered.length > 0) {
        onSelect(filtered[selectedIndex].playbook);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-start justify-center bg-black/60 pt-[20vh]"
      onClick={onCancel}
    >
      <div
        className="w-[500px] rounded-xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <label className="mb-2 block text-sm text-white/50">Select a playbook</label>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 font-mono text-sm text-white/90 outline-none focus:border-blue-400/50"
            placeholder="Search playbooks..."
          />
        </div>

        {filtered.length > 0 && (
          <div className="max-h-60 overflow-y-auto border-t border-white/[0.06]">
            {filtered.map((item, i) => (
              <div
                key={item.playbook.name}
                onClick={() => onSelect(item.playbook)}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === selectedIndex
                    ? 'bg-white/[0.07] text-white/90'
                    : 'text-white/40 hover:bg-white/[0.04]'
                }`}
              >
                <HighlightedName name={item.playbook.name} matchIndices={item.matchIndices} />
                <span className="ml-2 text-[11px] text-white/20">
                  {item.playbook.commands.length} command
                  {item.playbook.commands.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && query && (
          <div className="border-t border-white/[0.06] px-4 py-3 text-sm text-white/25">
            No matching playbooks
          </div>
        )}

        <div className="flex justify-between border-t border-white/[0.06] p-3 text-[11px] text-white/25">
          <span>Enter: select · Esc: cancel</span>
        </div>
      </div>
    </div>
  );
}
