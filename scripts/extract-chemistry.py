from pathlib import Path
from docx import Document
import json,re,hashlib
root=Path('C:/Users/Hector/Downloads/0. Тесты по орг. химии Ф3')
text=Path('tmp/chem-criteria-full.txt').read_text(encoding='utf-8');cells=[x.strip() for x in text.split(' | ')]
start=next(i for i,c in enumerate(cells) if c=='Вар. 6')+1;rows=[]
for c in cells[start:]:
 if c:rows.append(c)
assert len(rows)==140,len(rows)
keys=[]
for n in range(20):assert rows[n*7]==str(n+1);keys.append(rows[n*7+1:n*7+7])
result={'id':'pharmacy-organic-3','name':'Органическая химия · 3 курс','subjectId':'subject-pharmacy-organic','minutes':20,'published':False,'groupIds':[f'g-pharmacy-{i}' for i in range(7)],'variants':[]};audit=[]
for vi,path in enumerate(sorted(root.glob('*.docx')),1):
 doc=Document(path);questions=[];q=None
 for p in doc.paragraphs:
  for line in p.text.splitlines():
   line=line.strip()
   if not line:continue
   m=re.match(r'^(\d+)\.\s*(.*)',line)
   if m:
    q={'number':int(m[1]),'text':m[2],'options':[]};questions.append(q);continue
   if q is None:continue
   m=re.match(r'^([1-4абвгАБВГ])\)\.?\s*(.*)',line)
   if m:q['options'].append({'label':m[1].upper(),'text':m[2]});continue
   if len(q['options'])==4:
    q={'number':len(questions)+1,'text':line,'options':[]};questions.append(q)
   elif q['options']:q['options'][-1]['text']+='\n'+line
   else:q['text']+='\n'+line
 assert [q['number'] for q in questions]==list(range(1,21)),(vi,[(q['number'],q['text'][:20],len(q['options'])) for q in questions])
 v={'id':f'pharmacy-organic-v{vi}','name':f'Вариант {vi}','questions':[]}
 for qi,q in enumerate(questions,1):
  assert len(q['options'])==4,(vi,qi,q)
  labels=[o['label'] for o in q['options']];key=keys[qi-1][vi-1].upper();assert labels.count(key)==1,(vi,qi,key,labels)
  qid=f'{v["id"]}-q{qi}';v['questions'].append({'id':qid,'text':q['text'],'options':[{'id':f'{qid}-o{i+1}','text':o['text']} for i,o in enumerate(q['options'])],'correctId':f'{qid}-o{labels.index(key)+1}'})
  audit.append({'variant':vi,'question':qi,'key':key,'optionLabels':labels})
 result['variants'].append(v)
Path('seed/organic-chemistry.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
report={'sources':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(root.iterdir()) if p.is_file()],'keys':audit,'notes':['Ключи извлечены из таблицы Показатели оценки результатов тестов.doc.','Вариант 6, вопрос 19: номер отсутствует в исходнике, восстановлен по порядку.'],'minutes':20,'published':False}
Path('seed/organic-chemistry-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Organic chemistry: 6 variants, 120 questions, 120 matched keys')
