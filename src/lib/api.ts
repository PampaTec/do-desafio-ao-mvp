import { supabase } from './supabase'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

interface Profile {
  id: string
  email: string
  name: string | null
  role: string
}

export interface Team {
  id: string
  projectName: string
  currentStage: number
  status: string
  createdAt: string
  _count?: { chatMessages: number }
  progress: { stage: number; status: string; stageOutput: string | null }[]
  members: { id: string; profile: { name: string | null; email: string } | null; invitedEmail: string | null }[]
}

export interface Message {
  id: string
  role: string
  content: string
  createdAt: string
}

interface ChatResponse {
  userMessage: Message
  aiMessage: Message
  content: string
  stageCompleted: number | null
}

interface StatData {
  activeTeams: number
  completedTeams: number
  totalMembers: number
  totalTeams: number
}

interface SkillVersion {
  id: string
  versionLabel: string
  contentMd: string
  isActive: boolean
  createdAt: string
}

export const authApi = {
  login: (access_token: string) =>
    api<{ profile: Profile; hasTeam: boolean; team: Team | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ access_token }),
    }),
}

export const teamsApi = {
  list: () => api<Team[]>('/api/teams'),
  my: () => api<Team | null>('/api/teams/my'),
  get: (id: string) => api<Team & { chatMessages: Message[] }>(`/api/teams/${id}`),
  create: (projectName: string, memberEmails: string[]) =>
    api<Team>('/api/teams', {
      method: 'POST',
      body: JSON.stringify({ projectName, memberEmails }),
    }),
  advance: (id: string) =>
    api<void>(`/api/teams/${id}/advance`, { method: 'PATCH' }),
  delete: (id: string) =>
    api<void>(`/api/teams/${id}`, { method: 'DELETE' }),
}

export const chatApi = {
  list: (teamId: string) => api<Message[] | null>(`/api/chat/${teamId}`),
  send: (teamId: string, content: string) =>
    api<ChatResponse>(`/api/chat/${teamId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
}

export const skillApi = {
  active: () => api<SkillVersion | null>('/api/skill/active'),
  list: () => api<SkillVersion[]>('/api/skill'),
  save: (versionLabel: string, contentMd: string) =>
    api<SkillVersion>('/api/skill', {
      method: 'POST',
      body: JSON.stringify({ versionLabel, contentMd }),
    }),
  restore: (id: string) =>
    api<SkillVersion>(`/api/skill/${id}/restore`, { method: 'POST' }),
}

export const statsApi = {
  get: () => api<StatData>('/api/stats'),
}
