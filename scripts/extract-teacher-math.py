from pathlib import Path
from docx import Document
import re,json,hashlib
path=Path(r'\\172.17.17.24\document\Документы техникума\0ТЯНИ-ТОЛКАЙ0\_Сурин А.Ю\Тесты АМ\Математика в профессиональной деятельности учителя Н4.docx');doc=Document(path);assert not doc.element.xpath('//*[local-name()="oMath"]'),'Math formula objects require review'
result={'id':'primary-teacher-math-4','name':'Математика в профессиональной деятельности учителя · 4 курс','subjectId':'subject-primary-teacher-math','minutes':20,'published':False,'groupIds':['g-primary-0','g-primary-1'],'variants':[]};current=None;audit=[]
for p in doc.paragraphs:
 text=p.text.strip();h=re.fullmatch(r'ВАРИАНТ\s*(\d+)',text,re.I)
 if h:current={'id':f'teacher-math-v{h[1]}','name':f'Вариант {h[1]}','questions':[]};result['variants'].append(current);continue
 if current is None:continue
 matches=list(re.finditer(r'(?<!\w)([абвгАБВГ])\)\s*',text))
 if not matches:continue
 assert len(matches)==4,(current['name'],text)
 vi=len(result['variants']);qi=len(current['questions'])+1;stem=re.sub(r'^\d+\.\s*','',text[:matches[0].start()].strip());labels=[m[1].upper() for m in matches];key=doc.tables[vi-1].cell(1,qi).text.strip().upper();assert labels.count(key)==1
 qid=f'{current["id"]}-q{qi}';options=[{'id':f'{qid}-o{i+1}','text':text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)].strip()} for i,m in enumerate(matches)];current['questions'].append({'id':qid,'text':stem,'options':options,'correctId':options[labels.index(key)]['id']});audit.append({'variant':vi,'question':qi,'key':key,'optionLabels':labels})
assert len(result['variants'])==6 and all(len(v['questions'])==20 for v in result['variants'])
Path('seed/teacher-math.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');Path('seed/teacher-math-report.json').write_text(json.dumps({'source':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'keys':audit,'minutes':20,'published':False},ensure_ascii=False,indent=2),encoding='utf-8');print('Teacher mathematics: 6 variants, 120 questions, 120 keys')
