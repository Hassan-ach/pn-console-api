export interface InputInsight {
  id: number
  type: 'TASK' | 'URGENCY' | 'INFO' | 'DECISION'
  content: string
}

export interface InputMessage {
  id: string
  type: 'direct' | 'email'
  content: string
  reply_to: string | null
  reactions: Record<string, unknown>
  pinned: boolean
  edited_date: string | null
  entities: Record<string, unknown> | null
}
