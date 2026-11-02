'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, title, children, onClose, wide = false }: {open:boolean;title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const [mounted,setMounted]=useState(open);
  const panel=useRef<HTMLElement>(null);
  const startedOnBackdrop=useRef(false);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{if(open){setMounted(true);return;}const timer=setTimeout(()=>setMounted(false),380);return()=>clearTimeout(timer);},[open]);
  useEffect(()=>{
    if(!open||!mounted)return;
    const previous=document.activeElement as HTMLElement|null;
    const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const focusable=()=>Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea,select,[tabindex="0"]')??[]);
    focusable()[0]?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeRef.current();}
      if(event.key==='Tab'){const items=focusable();const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.removeEventListener('keydown',keyboard);document.body.style.overflow=oldOverflow;previous?.focus();};
  },[open,mounted]);
  if(!mounted)return null;
  return <div className={`modal-backdrop ${open?'':'is-closing'}`} onPointerDown={e=>{startedOnBackdrop.current=e.button===0&&e.target===e.currentTarget;}} onPointerCancel={()=>{startedOnBackdrop.current=false;}} onClick={e=>{if(e.target===e.currentTarget&&startedOnBackdrop.current)onClose();startedOnBackdrop.current=false;}}><section ref={panel} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Закрыть окно" onClick={onClose}><X size={20}/></button></div>{children}</section></div>;
}
