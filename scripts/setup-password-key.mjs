import {readFile,appendFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const path='.env.local';const env=await readFile(path,'utf8');
const configured=/^CREDENTIAL_ENCRYPTION_KEY=(.*)$/m.exec(env);
if(!configured||!configured[1].trim()){
 if(configured){const {writeFile}=await import('node:fs/promises');await writeFile(path,env.replace(/^CREDENTIAL_ENCRYPTION_KEY=.*$/m,''));}await appendFile(path,'\nCREDENTIAL_ENCRYPTION_KEY='+randomBytes(32).toString('hex')+'\n');console.log('Credential encryption key configured without displaying it');}
else console.log('Existing credential encryption key preserved');
