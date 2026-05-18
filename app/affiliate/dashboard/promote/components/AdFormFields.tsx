"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { INPUT } from "../constants";

const COUNTRIES: { code: string; name: string }[] = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "NZ", name: "New Zealand" },
  { code: "CA", name: "Canada" },
  { code: "IE", name: "Ireland" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

export function CountryMultiSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (csv: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => value.split(",").map((s) => s.trim()).filter(Boolean), [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (code: string) => {
    const set = new Set(selected);
    set.has(code) ? set.delete(code) : set.add(code);
    onChange(Array.from(set).join(","));
  };

  const remove = (code: string) => {
    const set = new Set(selected);
    set.delete(code);
    onChange(Array.from(set).join(","));
  };

  const filtered = COUNTRIES.filter(
    (c) =>
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`${INPUT} flex items-center gap-2 min-h-[42px] text-left`}
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => (
              <span key={code} className="text-[11px] px-2 py-1 rounded-full border border-[#2a2a2a] bg-[#121212]">
                {code}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(code);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(code);
                    }
                  }}
                  className="ml-1 text-gray-400 hover:text-white cursor-pointer select-none"
                  aria-label={`Remove ${code}`}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500">Select countries…</span>
        )}
        <span className="ml-auto text-[11px] text-gray-500">{open ? "Close" : "Open"}</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] shadow-xl">
          <div className="p-2 border-b border-[#1f1f1f]">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country"
              className={`${INPUT} mt-0`}
            />
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {filtered.map((c) => {
              const isSel = selected.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggle(c.code)}
                  className={`w-full px-3 py-2 text-sm flex items-center justify-between hover:bg-[#141414] ${isSel ? 'text-[#00C2CB]' : 'text-gray-200'}`}
                >
                  <span>{c.name}</span>
                  <span className="text-[11px] opacity-70">{c.code}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-500">No matches</div>
            )}
          </div>
          <div className="px-3 py-2 border-t border-[#1f1f1f] text-right">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // 'YYYY-MM-DDTHH:mm' or ''
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement | null>(null);

  const sel = value ? new Date(value) : null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const toLocalInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const startWeekday = (y: number, m: number) => new Date(y, m, 1).getDay();

  const y = view.getFullYear();
  const m = view.getMonth();
  const dim = daysInMonth(y, m);
  const start = startWeekday(y, m);

  const today = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  })();

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  const isPM = sel ? sel.getHours() >= 12 : true;
  const hour12 = sel ? (sel.getHours() % 12 || 12) : 12;
  const minuteStr = sel ? pad(sel.getMinutes() - (sel.getMinutes() % 5)) : '00';

  const setPart = (part: 'hour' | 'minute' | 'ampm', val: number | 'am' | 'pm') => {
    const base = sel ? new Date(sel) : new Date();
    let h = base.getHours();
    if (part === 'hour') {
      const as24 = ((val as number) % 12) + (h >= 12 ? 12 : 0);
      base.setHours(as24);
    } else if (part === 'minute') {
      base.setMinutes(val as number);
    } else {
      const wasPM = h >= 12;
      if (val === 'pm' && !wasPM) base.setHours(h + 12);
      if (val === 'am' && wasPM) base.setHours(h - 12);
    }
    onChange(toLocalInput(base));
  };

  const selectDay = (d: number) => {
    const base = sel ? new Date(sel) : new Date();
    base.setFullYear(y);
    base.setMonth(m);
    base.setDate(d);
    onChange(toLocalInput(base));
  };

  const clear = () => onChange('');
  const setToday = () => onChange(toLocalInput(new Date()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`${INPUT} text-left flex items-center gap-2`}
        onClick={() => setOpen((o) => !o)}
      >
        {value ? (
          new Date(value).toLocaleString()
        ) : (
          <span className="text-gray-500">dd/mm/yyyy, --:-- --</span>
        )}
        <span className="ml-auto text-[11px] text-gray-500">
          {open ? 'Close' : 'Open'}
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-[320px] rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] shadow-2xl">
          <div className="flex items-center justify-between p-3 border-b border-[#1f1f1f]">
            <div className="text-sm font-semibold">
              {view.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-7 w-7 grid place-items-center rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
                onClick={() => setView(new Date(y, m - 1, 1))}
              >
                ←
              </button>
              <button
                type="button"
                className="h-7 w-7 grid place-items-center rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
                onClick={() => setView(new Date(y, m + 1, 1))}
              >
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 p-3 text-center">
            {[...'SMTWTFS'].map((c, i) => (
              <div key={i} className="text-[11px] text-gray-400">
                {c}
              </div>
            ))}
            {Array.from({ length: start || 0 }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: dim }).map((_, i) => {
              const d = i + 1;
              const cellDate = new Date(y, m, d);
              cellDate.setHours(0, 0, 0, 0);
              const isPast = cellDate < today;

              const isSel =
                sel &&
                sel.getFullYear() === y &&
                sel.getMonth() === m &&
                sel.getDate() === d;

              const classes = [
                'h-8 rounded-md border text-sm',
                isSel
                  ? 'border-[#00C2CB] text-white bg-[#0b1f20]'
                  : 'border-transparent hover:border-[#2a2a2a] hover:bg-[#141414]',
                isPast ? 'opacity-40 cursor-not-allowed hover:border-transparent hover:bg-transparent' : '',
              ].join(' ');

              return (
                <button
                  key={d}
                  type="button"
                  disabled={isPast}
                  onClick={() => {
                    if (isPast) return;
                    selectDay(d);
                  }}
                  className={classes}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 px-3 pb-3">
            <select
              className={`${INPUT} mt-0 w-20`}
              value={hour12}
              onChange={(e) => setPart('hour', Number(e.target.value))}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <select
              className={`${INPUT} mt-0 w-20`}
              value={Number(minuteStr)}
              onChange={(e) => setPart('minute', Number(e.target.value))}
            >
              {minutes.map((mn) => (
                <option key={mn} value={Number(mn)}>{mn}</option>
              ))}
            </select>
            <select
              className={`${INPUT} mt-0 w-24`}
              value={isPM ? 'pm' : 'am'}
              onChange={(e) => setPart('ampm', e.target.value as any)}
            >
              <option value="am">AM</option>
              <option value="pm">PM</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={clear}
                className="px-2 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={setToday}
                className="px-2 py-1 rounded-md border border-[#2a2a2a] hover:bg-[#151515]"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded-full border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
    >
      {children}
    </button>
  );
}

export function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#232323] rounded-xl overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#121212] hover:bg-[#151515] cursor-pointer"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span
          className={`inline-block text-[#00C2CB] transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          aria-hidden
        >
          ▾
        </span>
      </div>
      {open && (
        <div className="px-4 py-3 bg-[#0f0f0f] text-[13px] text-gray-300 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
