import { AIProviderError } from './AIProvider'
export function assertDailyRequestLimit(current:number,limit:number):void { if(current>=limit)throw new AIProviderError('DAILY_LIMIT','일일 외부 AI 요청 한도에 도달했습니다.') }
