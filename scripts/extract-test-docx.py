"""Extract question text and supplied answer keys; never execute document content."""
import argparse, hashlib, json, re
from pathlib import Path
from docx import Document

p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--id',required=True);p.add_argument('--name',required=True);p.add_argument('--subject',required=True);p.add_argument('--groups',required=True);p.add_argument('--output',required=True);args=p.parse_args()
source=Path(args.source);doc=Document(source)
key_table=doc.tables[0]
keys={}
if len(key_table.rows)==7 and len(key_table.columns)==21:
 for row in key_table.rows[1:]:
  number=int(re.search(r'\d+',row.cells[0].text)[0]);keys[number]=[c.text.strip().upper() for c in row.cells[1:]]
elif len(key_table.rows)==21 and len(key_table.columns)==7:
 for number in range(1,7):keys[number]=[r.cells[number].text.strip().upper() for r in key_table.rows[1:]]
else:raise ValueError('Unrecognized answer table')
assert sorted(keys)==list(range(1,7)) and all(len(k)==20 for k in keys.values())
variants=[];current=None;question=None
option_re=re.compile(r'(?<!\w)([АБВГабвг])\)\s*')
for paragraph in doc.paragraphs:
 text=paragraph.text.strip()
 if not text:continue
 if text.lower() in ['ответы','критерии оценивания','критерии оценки'] and current is not None:break
 heading=re.fullmatch(r'Вариант\s*№?\s*(\d+)',text,re.I)
 if heading:
  current={'id':f'{args.id}-v{heading[1]}','name':f'Вариант {heading[1]}','questions':[],'number':int(heading[1])};variants.append(current);question=None;continue
 if current is None:continue
 # Economics documents keep each whole question in a single paragraph.
 if len(key_table.rows)==7:
  matches=list(option_re.finditer(text));assert len(matches)>=2,(current['number'],text)
  stem=text[:matches[0].start()].strip()
  options=[{'letter':m[1].upper(),'text':text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip()} for i,m in enumerate(matches)]
  current['questions'].append({'text':stem,'options':options,'number':len(current['questions'])+1})
 else:
  for line in text.splitlines():
   line=line.strip()
   if not line:continue
   numbered=re.match(r'^(\d+)\.\s*(.*)',line)
   if numbered:
    question={'number':int(numbered[1]),'text':numbered[2],'options':[]};current['questions'].append(question);continue
   option=re.match(r'^([АБВГабвг])(?:\)|\.|\s)\s*(.*)',line)
   if option and question:question['options'].append({'letter':option[1].upper(),'text':option[2]});continue
   assert question is not None,line
   if question['options']:question['options'][-1]['text']+='\n'+line
   else:question['text']+='\n'+line
assert [v['number'] for v in variants]==list(range(1,7))
counts={};audit=[]
for variant in variants:
 number=variant.pop('number');assert [q['number'] for q in variant['questions']]==list(range(1,21)),number
 for question in variant['questions']:
  n=question.pop('number');qid=f'{variant["id"]}-q{n}';assert question['text'] and 2<=len(question['options'])<=8
  labels=[o['letter'] for o in question['options']];assert len(labels)==len(set(labels)),(number,n,labels)
  answer=keys[number][n-1];assert answer in labels,(number,n,answer,labels)
  assert all(o['text'] for o in question['options'])
  audit.append({'variant':number,'question':n,'key':answer,'optionLabels':labels})
  question.update(id=qid,correctId=f'{qid}-o{labels.index(answer)+1}')
  question['options']=[{'id':f'{qid}-o{i+1}','text':o['text']} for i,o in enumerate(question['options'])]
  counts[len(labels)]=counts.get(len(labels),0)+1
result={'id':args.id,'name':args.name,'subjectId':args.subject,'minutes':20,'published':False,'groupIds':args.groups.split(','),'variants':variants}
output=Path(args.output);output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
report={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'variants':6,'questions':120,'optionCounts':counts,'keys':audit,'minutes':20,'published':False,'notes':['Тексты и ключи сохранены из источника.','20 минут по умолчанию, тест оставлен черновиком.']}
output.with_name(output.stem+'-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{output.name}: 6 variants, 120 questions, 120 keys; option counts: {counts}')
