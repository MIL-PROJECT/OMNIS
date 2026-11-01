import type { PublicUser } from '../../shared/contracts'
let current: PublicUser | null = null
let version = 0
export const session = { get: (): PublicUser | null => current, version: ():number=>version, refresh: (user:PublicUser):void=>{current=user}, set: (user: PublicUser | null, authVersion=0): void => { current = user; version=authVersion } }
