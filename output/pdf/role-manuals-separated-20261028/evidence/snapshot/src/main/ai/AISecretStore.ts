import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type CredentialProvider='OPENAI'|'ANTHROPIC'
export type CredentialSource='encrypted-store'|'environment'|'none'
export type CredentialStatus={configured:boolean;source:CredentialSource;masked:string|null}
export interface EncryptionAdapter { isEncryptionAvailable():boolean; encryptString(value:string):Buffer; decryptString(value:Buffer):string }
type SecretFile={version:1;credentials:Partial<Record<CredentialProvider,{ciphertext:string;updatedAt:string}>>}

export class AISecretStore {
  readonly filePath:string
  constructor(userDataPath:string,private encryption:EncryptionAdapter,private env:NodeJS.ProcessEnv=process.env){this.filePath=join(userDataPath,'secrets','ai-credentials.json')}
  private read():SecretFile { if(!existsSync(this.filePath))return {version:1,credentials:{}}; try{const value=JSON.parse(readFileSync(this.filePath,'utf8')) as SecretFile; return value.version===1&&value.credentials?value:{version:1,credentials:{}}}catch{return {version:1,credentials:{}}} }
  private write(value:SecretFile):void { mkdirSync(dirname(this.filePath),{recursive:true}); const temp=`${this.filePath}.tmp`; writeFileSync(temp,JSON.stringify(value),{encoding:'utf8',mode:0o600}); renameSync(temp,this.filePath) }
  private envName(provider:CredentialProvider):'OPENAI_API_KEY'|'ANTHROPIC_API_KEY' { return provider==='OPENAI'?'OPENAI_API_KEY':'ANTHROPIC_API_KEY' }
  getCredential(provider:CredentialProvider):{value:string;source:Exclude<CredentialSource,'none'>}|null { const envValue=this.env[this.envName(provider)]?.trim(); if(envValue)return {value:envValue,source:'environment'}; const entry=this.read().credentials[provider]; if(!entry)return null; if(!this.encryption.isEncryptionAvailable())return null; try{return {value:this.encryption.decryptString(Buffer.from(entry.ciphertext,'base64')),source:'encrypted-store'}}catch{return null} }
  status(provider:CredentialProvider):CredentialStatus { const credential=this.getCredential(provider); return credential?{configured:true,source:credential.source,masked:maskCredential(credential.value)}:{configured:false,source:'none',masked:null} }
  save(provider:CredentialProvider,value:string):CredentialStatus { const key=value.trim(); if(key.length<12)throw new Error('API Key 형식이 올바르지 않습니다.'); if(!this.encryption.isEncryptionAvailable())throw new Error('운영체제 암호화를 사용할 수 없어 API Key를 저장하지 않았습니다. 환경변수를 사용하십시오.'); const file=this.read(); file.credentials[provider]={ciphertext:this.encryption.encryptString(key).toString('base64'),updatedAt:new Date().toISOString()}; this.write(file); return this.status(provider) }
  delete(provider:CredentialProvider):CredentialStatus { const file=this.read(); delete file.credentials[provider]; if(Object.keys(file.credentials).length)this.write(file); else if(existsSync(this.filePath))unlinkSync(this.filePath); return this.status(provider) }
}

export function maskCredential(value:string):string { return `••••••••${value.slice(-4)}` }
