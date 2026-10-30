import type { PublicUser } from '../../shared/contracts'
let current: PublicUser | null = null
export const session = { get: (): PublicUser | null => current, set: (user: PublicUser | null): void => { current = user } }
