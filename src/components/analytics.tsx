'use client';

import { useEffect, useState } from 'react';
import type { Store, Attempt } from '@/lib/model';
import CustomSelect from './custom-select';
import { groupsForYear, attemptsForYear, attemptGroupId } from '@/lib/model';

type Bar = {label:string;value:number;grade?:number};
function Bars({title,items,unit='попыток'}:{title:string;items:Bar[];unit?:string}) {
 const maximum=Math.max(1,...items.map(i=>i.value));
 return <section className="panel analytics-chart"><h2>{title}</h2>{items.length?<div className="chart-scroll"><div className="column-chart" role="img" aria-label={`${title}. ${items.map(i=>`${i.label}: ${i.value} ${unit}`).join('; ')}`}>{items.map((item,index)=><div className="chart-column" key={`${item.label}-${index}`}><div className="chart-track"><div className={`chart-bar ${item.grade?`bar-grade-${item.grade}`:''}`} style={{height:`${item.value/maximum*100}%`}}/><strong>{item.value}</strong></div><span>{item.label}</span></div>)}</div></div>:<p className="empty">Нет завершённых попыток по выбранным условиям.</p>}</section>;
}
export default function Analytics({data,year,busy,onRefresh}:{data:Store;year:string;busy:boolean;onRefresh:()=>void}) {
 const [groupId,setGroupId]=useState('');const [subjectId,setSubjectId]=useState('');
 useEffect(()=>{setGroupId('');setSubjectId('');},[year]);
 const groups=groupsForYear(data,year);
 const subjects=data.subjects.filter(s=>!groupId||s.specialtyId===groups.find(g=>g.id===groupId)?.specialtyId);
 const subjectLabel=(id:string)=>{const s=data.subjects.find(s=>s.id===id);const specialty=data.specialties.find(sp=>sp.id===s?.specialtyId);return `${s?.name??'Предмет удалён'} · ${specialty?.code??''} · ${specialty?.qualification??''}`;};
 const attemptGroup=(a:Attempt)=>attemptGroupId(data,a);
 const attemptSubject=(a:Attempt)=>data.tests.find(t=>t.id===a.testId)?.subjectId;
 const attempts=attemptsForYear(data,year).filter(a=>a.completedAt&&(!groupId||attemptGroup(a)===groupId)&&(!subjectId||attemptSubject(a)===subjectId)).sort((a,b)=>Date.parse(b.completedAt!)-Date.parse(a.completedAt!));
 const byGroup=groups.filter(g=>!groupId||g.id===groupId).map(g=>({label:g.name,value:attempts.filter(a=>attemptGroup(a)===g.id).length}));
 const bySubject=subjects.filter(s=>!subjectId||s.id===subjectId).map(s=>({label:subjectLabel(s.id),value:attempts.filter(a=>attemptSubject(a)===s.id).length})).filter(s=>s.value>0||s.label===subjectLabel(subjectId));
 return <div className="analytics-content"><section className="panel analytics-filters"><CustomSelect label="Группа" value={groups.find(g=>g.id===groupId)?.name??'Все группы'} options={['Все группы',...groups.map(g=>g.name)]} onChange={name=>{setGroupId(groups.find(g=>g.name===name)?.id??'');setSubjectId('');}}/><CustomSelect label="Предмет" value={subjectId?subjectLabel(subjectId):'Все предметы'} options={['Все предметы',...subjects.map(s=>subjectLabel(s.id))]} onChange={label=>setSubjectId(subjects.find(s=>subjectLabel(s.id)===label)?.id??'')}/><button className="secondary" disabled={busy} onClick={onRefresh}>Обновить данные</button></section><div className="analytics-summary"><section className="panel"><span>Завершённых попыток</span><strong>{attempts.length}</strong></section><section className="panel"><span>Студентов с результатом</span><strong>{new Set(attempts.map(a=>a.studentId)).size}</strong></section><section className="panel"><span>Средняя оценка</span><strong>{attempts.length?(attempts.reduce((n,a)=>n+(a.grade??0),0)/attempts.length).toLocaleString('ru-RU',{maximumFractionDigits:2}):'—'}</strong></section></div><Bars title="Распределение оценок" items={[2,3,4,5].map(grade=>({label:`Оценка ${grade}`,grade,value:attempts.filter(a=>a.grade===grade).length}))}/><Bars title="Завершённые попытки по группам" items={byGroup}/><Bars title="Завершённые попытки по предметам" items={bySubject}/><section className="panel"><div className="panel-title"><h2>Результаты по выбранным условиям</h2></div><div className="table-scroll"><table><thead><tr><th>Студент / группа</th><th>Предмет / тест</th><th>Вариант</th><th>Баллы</th><th>Оценка</th><th>Завершено</th></tr></thead><tbody>{attempts.map(a=><tr key={a.id}><td><strong>{data.students.find(s=>s.id===a.studentId)?.name??'Студент удалён'}</strong><small>{groups.find(g=>g.id===attemptGroup(a))?.name}</small></td><td><strong>{data.subjects.find(s=>s.id===attemptSubject(a))?.name??'Предмет удалён'}</strong><small>{a.testName}</small></td><td>{a.variantName}</td><td>{a.score} / {a.questions.length}</td><td><strong className={`grade-${a.grade}`}>{a.grade}</strong></td><td>{new Date(a.completedAt!).toLocaleString('ru-RU')}</td></tr>)}</tbody></table>{!attempts.length&&<p className="empty">Результатов по выбранным условиям пока нет.</p>}</div></section></div>;
}
