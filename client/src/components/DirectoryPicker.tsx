import { useState, useEffect, useRef } from 'react';

interface DirectorySuggestion {
  path: string;
  matchIndices: number[];
}

interface DirectoryPickerProps {
  onConfirm: (directory: string) => void;
  onCancel: () => void;
}

function HighlightedName({ path, matchIndices }: DirectorySuggestion) {
  const lastSlash = path.lastIndexOf('/');
  const prefix = path.slice(0, lastSlash + 1);
  const name = path.slice(lastSlash + 1);
  const indexSet = new Set(matchIndices);

  return (
    <span>
      <span className="text-white/30">{prefix}</span>
      {matchIndices.length > 0
        ? [...name].map((char, i) => (
            <span key={i} className={indexSet.has(i) ? 'font-semibold text-blue-400' : ''}>
              {char}
            </span>
          ))
        : name}
    </span>
  );
}

export default function DirectoryPicker({ onConfirm, onCancel }: DirectoryPickerProps) {
  const [input, setInput] = useState('~/');
  const [suggestions, setSuggestions] = useState<DirectorySuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!input) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/directories?prefix=${encodeURIComponent(input)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((dirs: DirectorySuggestion[]) => {
        setSuggestions(dirs);
        setSelectedIndex(0);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      if (input.trim()) onConfirm(input);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setInput(suggestions[selectedIndex].path + '/');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
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
          <label className="mb-2 block text-sm text-white/50">Directory path</label>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 font-mono text-sm text-white/90 outline-none focus:border-blue-400/50"
            placeholder="~/projects/my-app"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="max-h-60 overflow-y-auto border-t border-white/[0.06]">
            {suggestions.map((s, i) => (
              <div
                key={s.path}
                onClick={() => setInput(s.path + '/')}
                className={`cursor-pointer px-4 py-2 font-mono text-sm ${
                  i === selectedIndex
                    ? 'bg-white/[0.07] text-white/90'
                    : 'text-white/40 hover:bg-white/[0.04]'
                }`}
              >
                <HighlightedName path={s.path} matchIndices={s.matchIndices} />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between border-t border-white/[0.06] p-3 text-[11px] text-white/25">
          <span>Tab: accept · Enter: confirm · Esc: cancel</span>
        </div>
      </div>
    </div>
  );
}
