import type { DailyStatus, IncidentMatch, MaintenanceCandidate } from './AIProvider'

const MASK = '[MASKED]'
const patterns = [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,/\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}\b/g,/\b\d{2}-\d{5,8}\b/g,/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,/\b(?:sk|api|key)[-_][A-Za-z0-9_-]{12,}\b/gi,/\b(?:password|passwd|비밀번호|token|secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,/(?:[A-Za-z]:\\|\\\\)[^\r\n<>:"|?*]+/g,/\/(?:Users|home|var|tmp)\/[^\s]+/g]
export function redactExternalText(value:string,maxLength:number):string { let output=value.slice(0,maxLength); for(const pattern of patterns) output=output.replace(pattern,MASK); return output }
export function externalTriageInput(title:string,description:string,serviceImpact=''):Record<string,string> { return { title:redactExternalText(title,200),description:redactExternalText(description,1000),serviceImpact:redactExternalText(serviceImpact,500) } }
export function externalDailyInput(status:DailyStatus):DailyStatus { return {...status,majorAlerts:status.majorAlerts.slice(0,10).map(v=>redactExternalText(v,160))} }
export function externalIncidentCandidates(title:string,candidates:IncidentMatch[]):{title:string;candidates:Array<{id:string;title:string;status:string}>} { return {title:redactExternalText(title,200),candidates:candidates.slice(0,20).map(c=>({id:c.ticket_no,title:redactExternalText(c.title,200),status:c.status}))} }
export function externalMaintenanceCandidates(candidates:MaintenanceCandidate[]):Array<{id:string;title:string;priority:string;status:string;scheduledDate:string}> { return candidates.slice(0,20).map(c=>({id:c.task_no,title:redactExternalText(c.title,200),priority:c.priority,status:c.status,scheduledDate:c.scheduled_date})) }
export function selectCandidateIds<T>(ids:string[],candidates:T[],idOf:(candidate:T)=>string):T[] { const allowed=new Map(candidates.map(c=>[idOf(c),c])); return [...new Set(ids)].slice(0,5).map(id=>allowed.get(id)).filter((v):v is T=>v!==undefined) }
