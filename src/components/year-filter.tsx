'use client';
import CustomSelect from './custom-select';
import type { Group, Store, Subject } from '@/lib/model';
import { graduationYear } from '@/lib/model';
export function YearFilter({groups,value,onChange}:{groups:Group[];value:string;onChange:(year:string)=>void}){
 const years=[...new Set([2024,2025,2026,...groups.map(graduationYear)])].sort((a,b)=>b-a);
 return <section className="panel year-filter"><div><h2>Год выпуска</h2><p>Группы, пользователи и результаты выбранного выпуска</p></div><CustomSelect label="Выпуск" value={value==='all'?'Все годы':`${value} год`} options={['Все годы',...years.map(y=>`${y} год`)]} onChange={label=>onChange(label==='Все годы'?'all':label.slice(0,4))}/></section>;
}
export function SubjectGroups({data,subject,onChange}:{data:Store;subject:Subject;onChange:(ids:string[])=>void}){
 const groups=data.groups.filter(g=>g.specialtyId===subject.specialtyId);const years=[...new Set(groups.map(graduationYear))].sort((a,b)=>b-a);const selected=subject.groupIds??[];
 return <div className="subject-group-picker"><h3>Группы предмета</h3><p>Опубликованные тесты предмета будут доступны всем выбранным группам</p>{years.map(year=><section key={year}><div className="section-heading"><h3>Выпуск {year}</h3><button type="button" className="text-button" onClick={()=>{const ids=groups.filter(g=>graduationYear(g)===year).map(g=>g.id);onChange(ids.every(id=>selected.includes(id))?selected.filter(id=>!ids.includes(id)):[...new Set([...selected,...ids])]);}}>{groups.filter(g=>graduationYear(g)===year).every(g=>selected.includes(g.id))?'Снять выбор':'Выбрать выпуск'}</button></div><div className="assignment-list">{groups.filter(g=>graduationYear(g)===year).map(g=><label className="checkbox" key={g.id}><input type="checkbox" checked={selected.includes(g.id)} onChange={e=>onChange(e.target.checked?[...selected,g.id]:selected.filter(id=>id!==g.id))}/>{g.name}</label>)}</div></section>)}{!groups.length&&<p>Сначала добавьте группу этой специальности</p>}</div>;
}
