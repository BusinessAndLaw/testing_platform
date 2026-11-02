'use client';
export class StudentApiError extends Error {
 constructor(message:string,public status:number,public data:Record<string,unknown>){super(message);}
}
export async function studentJson<T>(path:string,method='GET',body?:unknown):Promise<T>{
 let response:Response;try{response=await fetch(path,{method,cache:'no-store',...(body!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});}catch{throw new Error('Не удалось связаться с сервером. Проверьте соединение.');}
 let result;try{result=await response.json();}catch{throw new Error('Нет соединения с сервером. Повторите попытку.');}
 if(!response.ok)throw new StudentApiError(result.error??'Не удалось выполнить действие.',response.status,result);
 return result as T;
}
