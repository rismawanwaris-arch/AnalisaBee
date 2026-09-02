"use client";

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
    setQuery(selected ? `${selected.name} (${selected.code})` : "");
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
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/items?q=${encodeURIComponent(query)}`);
      if (res.ok) setOptions(await res.json());
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div ref={boxRef} className="relative">
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
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {open && options.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full min-w-64 rounded-md border border-border bg-surface shadow-lg max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setQuery(`${opt.name} (${opt.code})`);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-background flex justify-between gap-2"
              >
                <span className="truncate">{opt.name}</span>
                <span className="text-muted shrink-0">{opt.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
