"""Import education tests from explicit answer tables or bold-marked answers."""
import argparse,hashlib,json,re
from pathlib import Path
from collections import defaultdict
from docx import Document
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--id',required=True);p.add_argument('--name',required=True);p.add_argument('--subject',required=True);p.add_argument('--groups',required=True);p.add_argument('--output',required=True);p.add_argument('--allow-missing-keys',action='store_true');a=p.parse_args()
source=Path(a.source);doc=Document(source);keys=None
if doc.tables:
 table=doc.tables[0];assert len(table.rows)==21 and len(table.columns)==7
 keys={i:[r.cells[i].text.strip().upper() for r in table.rows[1:]] for i in range(1,7)}
option_re=re.compile(r'(?<!\w)([АБВГабвг])\)\s*');heading_re=re.compile(r'^(?:Вариант|Тест)\s*№?\s*(\d+)(?:\.|\s*\(.*\))?$',re.I)
variants=[];current=None;audit=[];compare=defaultdict(list);missing=[];label_warnings=[]
for pi,paragraph in enumerate(doc.paragraphs):
 text=paragraph.text
 heading=heading_re.fullmatch(text.strip())
 if heading:
  number=int(heading[1]);current={'id':f'{a.id}-v{number}','name':f'Вариант {number}','questions':[],'number':number};variants.append(current);continue
 if current is None or not text.strip():continue
 matches=list(option_re.finditer(text))
 if not matches:continue
 assert len(matches)==4,(pi,len(matches),text)
 labels=[m[1].upper() for m in matches]
 if labels!=list('АБВГ'):label_warnings.append({'paragraph':pi,'labels':labels,'text':text})
 stem=text[:matches[0].start()].strip();assert stem
 options=[];spans=[]
 for i,m in enumerate(matches):
  end=matches[i+1].start() if i+1<len(matches) else len(text);value=text[m.end():end].strip();assert value
  options.append(value);spans.append((m.end(),end))
 qi=len(current['questions'])+1;vid=current['number'];qid=f'{current["id"]}-q{qi}'
 if keys is not None:key=keys[vid][qi-1];method='table'
 else:
  assert ''.join(r.text for r in paragraph.runs)==text,(pi,'Run text differs from paragraph')
  mask=[]
  for run in paragraph.runs:mask.extend([run.bold is True]*len(run.text))
  selected=[i for i,(start,end) in enumerate(spans) if any(mask[j] and text[j].isalnum() for j in range(start,end))]
  assert len(selected)==1 or (not selected and a.allow_missing_keys),(pi,selected,text)
  key=labels[selected[0]] if selected else '';method='bold' if selected else 'unconfirmed'
  if not selected:missing.append({'variant':vid,'question':qi,'text':stem})
 assert not key or labels.count(key)==1,(pi,key,labels)
 question={'id':qid,'text':stem,'options':[{'id':f'{qid}-o{i+1}','text':value} for i,value in enumerate(options)],'correctId':f'{qid}-o{labels.index(key)+1}' if key else ''}
 current['questions'].append(question);audit.append({'variant':vid,'question':qi,'key':key,'method':method,'sourceParagraph':pi,'optionLabels':labels})
 norm=lambda s:' '.join(s.lower().split())
 compare[(norm(stem),tuple(norm(o) for o in options))].append({'variant':vid,'question':qi,'key':key})
assert [v['number'] for v in variants]==list(range(1,7));assert all(len(v['questions'])==20 for v in variants),[(v['number'],len(v['questions'])) for v in variants]
for v in variants:v.pop('number')
conflicts=[{'text':key[0],'occurrences':items} for key,items in compare.items() if len(set(x['key'] for x in items))>1]
result={'id':a.id,'name':a.name,'subjectId':a.subject,'minutes':20,'published':False,'groupIds':a.groups.split(','),'variants':variants}
out=Path(a.output);out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
report={'source':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'variants':6,'questions':120,'optionCounts':{'4':120},'keys':audit,'conflictingKeysForIdenticalQuestions':conflicts,'unconfirmedKeys':missing,'sourceLabelWarnings':label_warnings,'minutes':20,'published':False,'notes':['Ключи перенесены из таблицы источника.' if keys else 'Ключи перенесены по явно выделенным жирным ответам источника.','Продолжительность 20 минут по умолчанию, сохранено черновиком.']}
out.with_name(out.stem+'-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{out.name}: 6 variants, 120 questions, keys {len(audit)-len(missing)}/120; key source: {method}; identical-question conflicts: {len(conflicts)}')
