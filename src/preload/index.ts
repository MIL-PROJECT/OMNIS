import { contextBridge, ipcRenderer } from 'electron'
import type { AfccsApi, Channel } from '../shared/contracts'

const invoke = (channel: Channel, payload?: Record<string, unknown>) => ipcRenderer.invoke(channel, payload ?? {})
const api: AfccsApi = {
  invoke,
  auth: { login: p => invoke('auth:login', p), logout: () => invoke('auth:logout'), me: () => invoke('auth:me') },
  dashboard: { getSummary: () => invoke('dashboard:getSummary') },
  operations: { list: p => invoke('operations:list', p), updateStatus: p => invoke('operations:updateStatus', p), getHistory: p => invoke('operations:getHistory', p) },
  incidents: { list: p => invoke('incidents:list', p), get: p => invoke('incidents:get', p), create: p => invoke('incidents:create', p), updateStatus: p => invoke('incidents:updateStatus', p), assign: p => invoke('incidents:assign', p), getEvents: p => invoke('incidents:getEvents', p) },
  maintenance: { list: p => invoke('maintenance:list', p), create: p => invoke('maintenance:create', p), updateStatus: p => invoke('maintenance:updateStatus', p) },
  ai: { triageIncident: p => invoke('ai:triageIncident', p), dailySummary: () => invoke('ai:dailySummary'), similarIncidents: p => invoke('ai:similarIncidents', p), maintenanceRecommendations: () => invoke('ai:maintenanceRecommendations') },
  system: { getInfo: () => invoke('system:getInfo'), backup: () => invoke('system:backup'), resetDemo: p => invoke('system:resetDemo', p) }
}
contextBridge.exposeInMainWorld('afccs', api)
