'use client';

import { useState } from 'react';
import { SquareCheck, X } from 'lucide-react';
import type { Store, Attempt } from '@/lib/model';
import CustomSelect from './custom-select';
import Pagination, { pageOf } from './pagination';
import { groupsForYear, attemptsForYear, attemptGroupId, testGroupIds } from '@/lib/model';

type Bar = {label:string;value:number;grade?:number};
function Bars({title,items,unit='попыток'}:{title:string;items:Bar[];unit?:string}) {
 const maximum=Math.max(1,...items.map(i=>i.value));
 return <section className="panel analytics-chart"><h2>{title}</h2>{items.length?<div className="chart-scroll"><div className="column-chart" role="img" aria-label={`${title}. ${items.map(i=>`${i.label}: ${i.value} ${unit}`).join('; ')}`}>{items.map((item,index)=><div className="chart-column" key={`${item.label}-${index}`}><div className="chart-track"><div className={`chart-bar ${item.grade?`bar-grade-${item.grade}`:''}`} style={{height:`${item.value/maximum*100}%`}}/><strong>{item.value}</strong></div><span>{item.label}</span></div>)}</div></div>:<p className="empty">Нет завершённых попыток по выбранным условиям.</p>}</section>;
}
export default function Analytics({data,year,busy,onRefresh,showGroupProgress}:{
 data:Store;year:string;busy:boolean;onRefresh:()=>void;showGroupProgress:boolean;
}) {
 const [groupId,setGroupId]=useState('');
 const [subjectId,setSubjectId]=useState('');
 const [resultPage,setResultPage]=useState(0);
 const [progressPage,setProgressPage]=useState(0);
 const groups=groupsForYear(data,year);
 const selectedGroup=groups.find(group=>group.id===groupId);
 const subjects=data.subjects.filter(subject=>!selectedGroup||subject.specialtyId===selectedGroup.specialtyId);
 const subjectLabel=(id:string)=>{
  const subject=data.subjects.find(item=>item.id===id);
  const specialty=data.specialties.find(item=>item.id===subject?.specialtyId);
  return `${subject?.name??'Предмет удалён'} · ${specialty?.code??''} · ${specialty?.qualification??''}`;
 };
 const attemptGroup=(attempt:Attempt)=>attemptGroupId(data,attempt);
 const attemptSubject=(attempt:Attempt)=>data.tests.find(test=>test.id===attempt.testId)?.subjectId;
 const attempts=attemptsForYear(data,year)
  .filter(attempt=>attempt.completedAt&&(!groupId||attemptGroup(attempt)===groupId)&&(!subjectId||attemptSubject(attempt)===subjectId))
  .sort((a,b)=>Date.parse(b.completedAt!)-Date.parse(a.completedAt!));
 const resultRows=pageOf(attempts,resultPage);
 const byGroup=groups.filter(group=>!groupId||group.id===groupId)
  .map(group=>({label:group.name,value:attempts.filter(attempt=>attemptGroup(attempt)===group.id).length}));
 const bySubject=subjects.filter(subject=>!subjectId||subject.id===subjectId)
  .map(subject=>({label:subjectLabel(subject.id),value:attempts.filter(attempt=>attemptSubject(attempt)===subject.id).length}))
  .filter(item=>item.value>0||item.label===subjectLabel(subjectId));

 const groupProgress=showGroupProgress&&selectedGroup
  ? buildGroupProgress(data,selectedGroup.id,subjectId,attempts)
  : null;
 const progressRows=pageOf(groupProgress?.students??[],progressPage);

 function resetPages(){
  setResultPage(0);
  setProgressPage(0);
 }

 return <div className="analytics-content">
  <section className="panel analytics-filters">
   <CustomSelect label="Группа" value={selectedGroup?.name??'Все группы'} options={['Все группы',...groups.map(group=>group.name)]}
    onChange={name=>{setGroupId(groups.find(group=>group.name===name)?.id??'');setSubjectId('');resetPages();}}/>
   <CustomSelect label="Предмет" value={subjectId?subjectLabel(subjectId):'Все предметы'} options={['Все предметы',...subjects.map(subject=>subjectLabel(subject.id))]}
    onChange={label=>{setSubjectId(subjects.find(subject=>subjectLabel(subject.id)===label)?.id??'');resetPages();}}/>
   <button className="secondary" disabled={busy} onClick={onRefresh}>Обновить данные</button>
  </section>
  {groupProgress&&<section className="panel">
   <div className="panel-title">
    <div><h2>Прохождение группы {selectedGroup?.name}</h2>
     <p>Завершили: {groupProgress.completed} из {groupProgress.students.length} · {subjectId?'Тесты выбранного предмета':'Все назначенные тесты'}</p>
    </div>
   </div>
   {groupProgress.testCount>0&&groupProgress.students.length>0
    ? <><div className="table-scroll"><table>
      <thead><tr><th>Студент</th><th>Завершено тестов</th><th>Статус</th></tr></thead>
      <tbody>{progressRows.rows.map(student=><tr key={student.id}>
       <td>{student.name}</td><td>{student.finished} / {groupProgress.testCount}</td>
       <td>{student.done
        ? <span className="completion-status is-done"><SquareCheck size={18} aria-hidden="true"/>Завершил</span>
        : <span className="completion-status is-pending"><X size={18} aria-hidden="true"/>Не завершил</span>}</td>
      </tr>)}</tbody>
     </table></div>
     <Pagination page={progressRows.page} pages={progressRows.pages} onChange={setProgressPage}/>
    </>
    : <p className="empty">{groupProgress.students.length?'По выбранным условиям группе не назначены опубликованные тесты.':'В группе пока нет студентов.'}</p>}
  </section>}
  <div className="analytics-summary">
   <section className="panel"><span>Завершённых попыток</span><strong>{attempts.length}</strong></section>
   <section className="panel"><span>Студентов с результатом</span><strong>{new Set(attempts.map(a=>a.studentId)).size}</strong></section>
   <section className="panel"><span>Средняя оценка</span><strong>{attempts.length?(attempts.reduce((n,a)=>n+(a.grade??0),0)/attempts.length).toLocaleString('ru-RU',{maximumFractionDigits:2}):'—'}</strong></section>
  </div>
  <Bars title="Распределение оценок" items={[2,3,4,5].map(grade=>({label:`Оценка ${grade}`,grade,value:attempts.filter(a=>a.grade===grade).length}))}/>
  <Bars title="Завершённые попытки по группам" items={byGroup}/>
  <Bars title="Завершённые попытки по предметам" items={bySubject}/>
  {showGroupProgress&&<section className="panel">
   <div className="panel-title"><h2>Результаты по выбранным условиям · {attempts.length}</h2></div>
   <div className="table-scroll"><table>
    <thead><tr><th>Студент / группа</th><th>Предмет / тест</th><th>Вариант</th><th>Баллы</th><th>Оценка</th><th>Завершено</th></tr></thead>
    <tbody>{resultRows.rows.map(a=><tr key={a.id}>
     <td><strong>{data.students.find(s=>s.id===a.studentId)?.name??'Студент удалён'}</strong><small>{a.groupName??groups.find(g=>g.id===attemptGroup(a))?.name}</small></td>
     <td><strong>{data.subjects.find(s=>s.id===attemptSubject(a))?.name??'Предмет удалён'}</strong><small>{a.testName}</small></td>
     <td>{a.variantName}</td><td>{a.score} / {a.questionCount??a.questions.length}</td>
     <td><strong className={`grade-${a.grade}`}>{a.grade}</strong></td><td>{new Date(a.completedAt!).toLocaleString('ru-RU')}</td>
    </tr>)}</tbody>
   </table>{!attempts.length&&<p className="empty">Результатов по выбранным условиям пока нет.</p>}</div>
   <Pagination page={resultRows.page} pages={resultRows.pages} onChange={setResultPage}/>
  </section>}
 </div>;
}

function buildGroupProgress(data:Store,groupId:string,subjectId:string,attempts:Attempt[]){
 const required=new Set(data.tests.filter(test=>test.published&&(!subjectId||test.subjectId===subjectId)
  &&testGroupIds(data,test).includes(groupId)).map(test=>test.id));
 const completedByStudent=new Map<string,Set<string>>();
 for(const attempt of attempts){
  if(!required.has(attempt.testId))continue;
  const completed=completedByStudent.get(attempt.studentId)??new Set<string>();
  completed.add(attempt.testId);
  completedByStudent.set(attempt.studentId,completed);
 }
 const students=data.students.filter(student=>student.groupId===groupId).map(student=>{
  const finished=completedByStudent.get(student.id)?.size??0;
  return {...student,finished,done:required.size>0&&finished===required.size};
 }).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 return {testCount:required.size,completed:students.filter(student=>student.done).length,students};
}
