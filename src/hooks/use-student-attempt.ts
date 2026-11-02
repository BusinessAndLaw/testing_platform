'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { toast } from 'sonner';
import type { StudentAttemptView } from '@/lib/attempts';
import { studentJson,StudentApiError } from '@/lib/student-api';
export type AttemptResponse={attempt:StudentAttemptView;serverNow:string};
export default function useStudentAttempt(initial:AttemptResponse){
 const [attempt,setAttempt]=useState(initial.attempt);const current=useRef(initial.attempt);const pending=useRef<Record<string,string>>({});const [pendingCount,setPendingCount]=useState(0);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [finishing,setFinishing]=useState(false);
 const anchor=useRef({server:Date.parse(initial.serverNow),at:performance.now()});const [remaining,setRemaining]=useState(Math.max(0,Date.parse(initial.attempt.deadline)-Date.parse(initial.serverNow)));
 const savePromise=useRef<Promise<void>|null>(null);const debounce=useRef<ReturnType<typeof setTimeout>|null>(null);const cacheKey=`testing-pending-${initial.attempt.id}`;
 const cache=useCallback(()=>{setPendingCount(Object.keys(pending.current).length);try{if(Object.keys(pending.current).length)sessionStorage.setItem(cacheKey,JSON.stringify(pending.current));else sessionStorage.removeItem(cacheKey);}catch{/* Unsaved changes still stay in memory and prevent accidental reload. */}},[cacheKey]);
 const apply=useCallback((result:AttemptResponse)=>{
  if(result.attempt.revision<current.current.revision)return;
  anchor.current={server:Date.parse(result.serverNow),at:performance.now()};
  if(result.attempt.status==='completed')pending.current={};
  const next={...result.attempt,answers:{...result.attempt.answers,...pending.current}};current.current=next;setAttempt(next);cache();setRemaining(Math.max(0,Date.parse(next.deadline)-Date.parse(result.serverNow)));
 },[cache]);
 const flush=useCallback(()=>{
  if(savePromise.current)return savePromise.current;
  const work=async()=>{
   if(current.current.status==='completed')return;setSaving(true);let conflicts=0;
   try{while(Object.keys(pending.current).length&&current.current.status==='active'){
    const batch={...pending.current};
    try{const result=await studentJson<AttemptResponse>(`/api/student/attempts/${initial.attempt.id}`,'PATCH',{revision:current.current.revision,answers:batch});for(const [key,value] of Object.entries(batch))if(pending.current[key]===value)delete pending.current[key];apply(result);setError('');}
    catch(error){if(error instanceof StudentApiError&&error.status===409&&error.data.attempt){apply(error.data as unknown as AttemptResponse);if(++conflicts<4)continue;}throw error;}
   }}catch(error){setError(error instanceof Error?error.message:'Не удалось сохранить ответы.');throw error;}finally{setSaving(false);cache();}
  };
  const promise=work();savePromise.current=promise;void promise.finally(()=>{savePromise.current=null;}).catch(()=>{});return promise;
 },[apply,cache,initial.attempt.id]);
 const refresh=useCallback(async()=>{if(savePromise.current||current.current.status==='completed')return;try{const result=await studentJson<AttemptResponse>(`/api/student/attempts/${initial.attempt.id}`);apply(result);if(!Object.keys(pending.current).length)setError('');}catch(error){setError(error instanceof Error?error.message:'Не удалось обновить попытку.');}},[apply,initial.attempt.id]);
 useEffect(()=>{
  try{const value=sessionStorage.getItem(cacheKey);if(value&&initial.attempt.status==='active'){const stored=JSON.parse(value);for(const [key,value] of Object.entries(stored)){if(typeof value==='string'&&initial.attempt.questions.find(q=>q.id===key)?.options.some(o=>o.id===value)&&initial.attempt.answers[key]!==value)pending.current[key]=value;}cache();const next={...initial.attempt,answers:{...initial.attempt.answers,...pending.current}};current.current=next;setAttempt(next);void flush().catch(()=>{});}else if(initial.attempt.status==='completed')sessionStorage.removeItem(cacheKey);}catch{/* Invalid local cache is ignored; server answers remain authoritative. */}
 },[cacheKey,cache,flush,initial.attempt]);
 useEffect(()=>{
  const tick=setInterval(()=>{if(current.current.status==='active')setRemaining(Math.max(0,Date.parse(current.current.deadline)-(anchor.current.server+performance.now()-anchor.current.at)));},500);
  const sync=setInterval(()=>{if(current.current.status==='completed')return;if(Object.keys(pending.current).length)void flush().catch(()=>{});else void refresh();},5000);
  const online=()=>{void flush().then(refresh).catch(()=>{});};const warn=(event:BeforeUnloadEvent)=>{if(Object.keys(pending.current).length)event.preventDefault();};window.addEventListener('online',online);window.addEventListener('beforeunload',warn);
  return()=>{clearInterval(tick);clearInterval(sync);if(debounce.current)clearTimeout(debounce.current);window.removeEventListener('online',online);window.removeEventListener('beforeunload',warn);};
 },[flush,refresh]);
 useEffect(()=>{if(remaining===0&&attempt.status==='active')void refresh();},[remaining,attempt.status,refresh]);
 function choose(questionId:string,optionId:string){if(remaining<=0||current.current.status==='completed'||finishing)return;pending.current[questionId]=optionId;cache();const next={...current.current,answers:{...current.current.answers,[questionId]:optionId}};current.current=next;setAttempt(next);if(debounce.current)clearTimeout(debounce.current);debounce.current=setTimeout(()=>{void flush().catch(()=>{});},300);}
 async function finish(){if(finishing)return;setFinishing(true);try{await flush();if(current.current.status==='completed')return;const result=await studentJson<AttemptResponse>(`/api/student/attempts/${initial.attempt.id}/finish`,'POST',{revision:current.current.revision});apply(result);setError('');toast.success('Тестирование завершено.');}catch(error){if(error instanceof StudentApiError&&error.status===409&&error.data.attempt)apply(error.data as unknown as AttemptResponse);const message=error instanceof Error?error.message:'Не удалось завершить тестирование.';setError(message);toast.error(message);}finally{setFinishing(false);}}
 return {attempt,remaining,choose,flush,finish,refresh,saving,error,pendingCount,finishing};
}
