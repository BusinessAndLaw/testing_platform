'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function CustomSelect({ value, options, onChange, label, disabled=false }: { value: string; options: string[]; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) { setMounted(true); return; }
    const timer = setTimeout(() => setMounted(false), 380);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const choose = (option: string | undefined) => { if (!option) return; onChange(option); setOpen(false); trigger.current?.focus(); };
  return <div className="custom-select" ref={root}>
    <span id={`${id}-label`} className="select-label">{label}</span>
    <button ref={trigger} type="button" disabled={disabled} className={`select-trigger ${open ? 'is-open' : ''}`} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={mounted ? id : undefined}
      onClick={() => { setActive(Math.max(0, options.indexOf(value))); setOpen(!open); }}
      onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) event.preventDefault();
        if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { setOpen(true); setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
        if (event.key === 'Home') setActive(0);
        if (event.key === 'End') setActive(options.length - 1);
        if (open && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(options[active]); }
        if (event.key === 'Tab') setOpen(false);
      }} aria-activedescendant={open ? `${id}-${active}` : undefined}>
      <span id={`${id}-value`}>{value}</span><ChevronDown size={16}/>
    </button>
    {mounted && !disabled && <div id={id} className={`select-options ${open ? '' : 'is-closing'}`} role="listbox" aria-labelledby={`${id}-label`} aria-hidden={!open}>
      {options.map((option, index) => <div id={`${id}-${index}`} key={option} role="option" aria-selected={value === option} className={`select-option ${active === index ? 'is-active' : ''}`} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option}{value === option && <Check size={16}/>}</div>)}
    </div>}
  </div>;
}
