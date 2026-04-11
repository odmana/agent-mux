import { useState, useEffect, useRef } from 'react';

interface DirectoryPickerProps {
  onConfirm: (directory: string) => void;
  onCancel: () => void;
}

export default function DirectoryPicker({ onConfirm, onCancel }: DirectoryPickerProps) {
  const [input, setInput] = useState('~/');
  const [suggestions, setSuggestions] = useState<string[]>([]);
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
      .then((dirs: string[]) => {
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
      onConfirm(input);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setInput(suggestions[selectedIndex] + '/');
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
    <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-[20vh] z-10" onClick={onCancel}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-xl w-[500px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <label className="text-sm text-white/50 mb-2 block">Directory path</label>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:border-blue-400/50 font-mono"
            placeholder="~/projects/my-app"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="border-t border-white/[0.06] max-h-60 overflow-y-auto">
            {suggestions.map((dir, i) => (
              <div
                key={dir}
                onClick={() => setInput(dir + '/')}
                className={`px-4 py-2 text-sm cursor-pointer font-mono ${
                  i === selectedIndex
                    ? 'bg-white/[0.07] text-white/90'
                    : 'text-white/40 hover:bg-white/[0.04]'
                }`}
              >
                {dir}
              </div>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-white/[0.06] flex justify-between text-[11px] text-white/25">
          <span>Tab: accept · Enter: confirm · Esc: cancel</span>
        </div>
      </div>
    </div>
  );
}
