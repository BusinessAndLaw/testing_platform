'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Dashboard from './dashboard';
import StudentPortal from './student-portal';
import { toast } from 'sonner';
type SessionUser={id:string;name:string;login:string;role:string};
export default function AdminAccess(){
 const loginPending=useRef(false);
 const [user,setUser]=useState<SessionUser|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function check(){setLoading(true);try{const response=await fetch('/api/session',{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);setUser(result.user);}catch(error){setError(error instanceof Error?error.message:'Не удалось связаться с сервером.');}finally{setLoading(false);}}
 useEffect(()=>{void check();},[]);
 async function login(event:FormEvent<HTMLFormElement>){event.preventDefault();if(loginPending.current)return;const fields=new FormData(event.currentTarget);loginPending.current=true;setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:fields.get('login'),password:fields.get('password')})});const result=await response.json();if(!response.ok)throw Error(result.error);setUser(result.user);}catch(error){setError(error instanceof Error?error.message:'Не удалось войти.');}finally{loginPending.current=false;setBusy(false);}}
 async function logout(){try{const response=await fetch('/api/session',{method:'DELETE'});if(!response.ok)throw Error();setUser(null);}catch{toast.error('Не удалось завершить сеанс. Повторите попытку.');throw new Error('Не удалось завершить сеанс.');}}
 if(loading)return <main className="loading">Подключение…</main>;
 if(user?.role==='student')return <StudentPortal name={user.name} onLogout={logout}/>;
 if(user?.role==='admin'||user?.role==='analyst')return <Dashboard administrator={user.name} readOnly={user.role==='analyst'} onLogout={logout}/>;
 return <main className="login-page"><section className="panel login-panel"><h1>Вход в систему</h1><p>Введите выданные вам логин и пароль.</p><form onSubmit={login}><label>Логин<input name="login" placeholder="Введите логин" autoComplete="username" required maxLength={64}/></label><label>Пароль<input name="password" type="password" placeholder="Введите пароль" autoComplete="current-password" required maxLength={256}/></label>{error&&<div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy?'Входим…':'Войти'}</button></form></section></main>;
}
