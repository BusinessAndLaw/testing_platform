'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Dashboard from './dashboard';
import StudentPortal from './student-portal';
import { toast } from 'sonner';
type SessionUser={id:string;name:string;login:string;role:string};
export default function AdminAccess(){
 const loginPending=useRef(false);
 const [passwordVisible,setPasswordVisible]=useState(false);
 const revealTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(revealTimer.current),[]);
 function hidePassword(){
  clearTimeout(revealTimer.current);
  setPasswordVisible(false);
 }
 function togglePassword(){
  if(passwordVisible){hidePassword();return;}
  setPasswordVisible(true);
  revealTimer.current=setTimeout(()=>setPasswordVisible(false),2000);
 }
 const [user,setUser]=useState<SessionUser|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function check(){setLoading(true);try{const response=await fetch('/api/session',{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);setUser(result.user);}catch(error){setError(error instanceof Error?error.message:'Не удалось связаться с сервером.');}finally{setLoading(false);}}
 useEffect(()=>{void check();},[]);
 async function login(event:FormEvent<HTMLFormElement>){event.preventDefault();hidePassword();if(loginPending.current)return;const fields=new FormData(event.currentTarget);loginPending.current=true;setBusy(true);setError('');try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:fields.get('login'),password:fields.get('password')})});const result=await response.json();if(!response.ok)throw Error(result.error);setUser(result.user);}catch(error){setError(error instanceof Error?error.message:'Не удалось войти.');}finally{loginPending.current=false;setBusy(false);}}
 async function logout(){try{const response=await fetch('/api/session',{method:'DELETE'});if(!response.ok)throw Error();setUser(null);}catch{toast.error('Не удалось завершить сеанс. Повторите попытку.');throw new Error('Не удалось завершить сеанс.');}}
 if(loading)return <main className="loading">Подключение…</main>;
 if(user?.role==='student')return <StudentPortal login={user.login} onLogout={logout}/>;
 if(user?.role==='admin'||user?.role==='analyst')return <Dashboard administrator={user.name} readOnly={user.role==='analyst'} onLogout={logout}/>;
 return <main className="login-page"><section className="panel login-panel"><h1>Вход в систему</h1><p>Введите выданные вам логин и пароль.</p><form onSubmit={login}><label>Логин<input name="login" placeholder="Введите логин" autoComplete="username" required maxLength={64}/></label><div className="login-password"><label htmlFor="login-password">Пароль</label><div className="login-password-field"><input id="login-password" name="password" type={passwordVisible?'text':'password'} placeholder="Введите пароль" autoComplete="current-password" maxLength={256} required onChange={hidePassword}/><button type="button" className="icon-button" aria-label={passwordVisible?'Скрыть пароль':'Показать пароль'} onClick={togglePassword}>{passwordVisible?<EyeOff size={20} aria-hidden="true"/>:<Eye size={20} aria-hidden="true"/>}</button></div></div>{error&&<div className="form-error" role="alert">{error}</div>}<button type="submit" className="primary" disabled={busy}>{busy?'Входим…':'Войти'}</button></form></section></main>;
}
