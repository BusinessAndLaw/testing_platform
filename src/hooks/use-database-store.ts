'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { initialStore, parseStore, storageKey, defaultTestMinutes } from '@/lib/model';
import type { Store } from '@/lib/model';

export default function useDatabaseStore(){
 const [data,setData]=useState<Store>(initialStore);const [ready,setReady]=useState(false);const [loadError,setLoadError]=useState('');const [saveError,setSaveError]=useState('');const [conflict,setConflict]=useState(false);const [syncing,setSyncing]=useState(false);const [localData,setLocalData]=useState<Store|null>(null);
 const latest=useRef(data);latest.current=data;const persisted=useRef<Store|null>(null);const revision=useRef(0);const writing=useRef(false);const blocked=useRef(false);
 const reload=useCallback(async()=>{setReady(false);setLoadError('');try{const response=await fetch('/api/state',{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);persisted.current=result.data;revision.current=result.revision;latest.current=result.data;setData(result.data);blocked.current=false;setSaveError('');setConflict(false);setReady(true);}catch(error){setLoadError(error instanceof Error?error.message:'Не удалось загрузить данные из MySQL.');}},[]);
 useEffect(()=>{void reload();try{const value=localStorage.getItem(storageKey);if(value)setLocalData(parseStore(value));}catch{/* Old browser data is left untouched for backup. */}},[reload]);
 const save=useCallback(async()=>{
  if(writing.current||!persisted.current||blocked.current)return;writing.current=true;setSyncing(true);setSaveError('');
  try{while(latest.current!==persisted.current){const snapshot:Store=latest.current;const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:snapshot,revision:revision.current})});const result=await response.json();if(!response.ok){setConflict(response.status===409);throw Error(result.error??'Не удалось сохранить изменения.');}revision.current=result.revision;persisted.current=snapshot;}}
  catch(error){blocked.current=true;setSaveError(error instanceof Error?error.message:'Нет соединения с сервером. Изменения не сохранены.');}
  finally{writing.current=false;setSyncing(false);}
 },[]);
 useEffect(()=>{if(!ready||data===persisted.current||blocked.current)return;const timer=setTimeout(()=>{void save();},350);return()=>clearTimeout(timer);},[data,ready,save]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(ready&&latest.current!==persisted.current){event.preventDefault();}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[ready]);
 const retry=()=>{blocked.current=false;void save();};
 const migrate=()=>{if(!localData)return;const merge=<T extends {id:string}>(server:T[],local:T[])=>[...new Map([...server,...local].map(item=>[item.id,item])).values()];
  setData(current=>({...current,specialties:merge(current.specialties,localData.specialties),groups:merge(current.groups,localData.groups),students:merge(current.students,localData.students),subjects:merge(current.subjects,localData.subjects),users:merge(current.users,localData.users),tests:merge(current.tests,localData.tests).map(t=>({...t,minutes:defaultTestMinutes})),nextUserNumber:Math.max(current.nextUserNumber,localData.nextUserNumber)}));
 };
 return {data,setData,ready,loadError,saveError,conflict,syncing,reload,retry,localData,migrate,pending:ready&&data!==persisted.current};
}
