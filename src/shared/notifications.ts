export type UserNotification = {
  id: string
  kind: string
  title: string
  body: string
  entity_id: string
  created_at: string
  read_at: string | null
  superseded_at: string | null
}

export type NotificationInbox = {
  items: UserNotification[]
  unreadCount: number
}
