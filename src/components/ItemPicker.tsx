
import { useEffect, useRef, useState } from "react";

export interface ItemOption {
  id: number;
  code: string;
  name: string;
  itemGroup: string | null;
}

interface ItemPickerProps {
  selected: ItemOption | null;
  onSelect: (item: ItemOption | null) => void;
  placeholder?: string;
}

export function ItemPicker({ selected, onSelect, placeholder }: ItemPickerProps) {
  const [query, setQuery] = useState(selected ? `${selected.name} (${selected.code})` : "");
  const [options, setOptions] = useState<ItemOption[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(selected ? `${selected.name} (${selected.code})` : "");
    }, 0);
    return () => clearTimeout(timer);
  }, [selected]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      const timer = setTimeout(() => setOptions([]), 0);
      return () => clearTimeout(timer);
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}`);
      if (res.ok) setOptions(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected && e.target.value !== `${selected.name} (${selected.code})`) {
              onSelect(null);
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Ketik nama atau kode item..."}
          className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onSelect(null);
              setOptions([]);
            }}
            aria-label="Hapus pilihan item"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="absolute z-30 mt-1.5 w-full min-w-72 rounded-xl border border-border/80 bg-surface/95 backdrop-blur-md shadow-xl max-h-64 overflow-y-auto py-1 divide-y divide-border/40">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setQuery(`${opt.name} (${opt.code})`);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs hover:bg-surface-hover flex items-center justify-between gap-2 transition-colors"
              >
                <span className="truncate font-medium text-foreground">{opt.name}</span>
                <span className="text-[11px] font-mono text-muted shrink-0 bg-surface-subtle px-1.5 py-0.5 rounded border border-border/50">
                  {opt.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

