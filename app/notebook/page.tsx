'use client'
import { useState } from 'react'
import AppFrame from '@/components/AppFrame'
import { useStore } from '@/lib/store'

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  tags: string[]
}

export default function NotebookPage() {
  const { trades } = useStore()
  const [notes, setNotes] = useState<Note[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('edge_notes') || '[]') } catch { return [] }
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const saveNotes = (updated: Note[]) => {
    setNotes(updated)
    localStorage.setItem('edge_notes', JSON.stringify(updated))
  }

  const createNote = () => {
    const note: Note = { id: Date.now().toString(), title: 'Untitled', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [] }
    const updated = [note, ...notes]
    saveNotes(updated)
    setSelectedId(note.id)
  }

  const updateNote = (id: string, changes: Partial<Note>) => {
    saveNotes(notes.map(n => n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n))
  }

  const deleteNote = (id: string) => {
    if (!confirm('Delete this note?')) return
    saveNotes(notes.filter(n => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const filtered = notes.filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
  const selected = selectedId ? notes.find(n => n.id === selectedId) : null

  return (
    <AppFrame>
      <div className="page-fade" style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="page-title">Notebook</div>
          <button className="btn btn-primary" onClick={createNote} style={{ padding: '8px 16px', fontSize: 12 }}>+ New Note</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, flex: 1, overflow: 'hidden' }}>
          {/* NOTE LIST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            <input className="form-input" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px', fontSize: 12, marginBottom: 4 }} />
            {!filtered.length ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>
                {notes.length ? 'No notes match' : 'No notes yet'}
              </div>
            ) : filtered.map(n => (
              <div key={n.id} onClick={() => setSelectedId(n.id)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: selectedId === n.id ? 'var(--bg4)' : 'var(--bg2)',
                border: `1px solid ${selectedId === n.id ? 'rgba(124,111,205,0.4)' : 'var(--border)'}`,
                transition: 'all .15s', boxShadow: selectedId === n.id ? 'inset 3px 0 0 var(--accent)' : 'none'
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || 'Untitled'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.content.slice(0, 60) || 'Empty note'}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{new Date(n.updatedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>

          {/* EDITOR */}
          {selected ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <input
                  value={selected.title}
                  onChange={e => updateNote(selected.id, { title: e.target.value })}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit' }}
                  placeholder="Note title..."
                />
                <button onClick={() => deleteNote(selected.id)} style={{ background: 'transparent', border: '1px solid rgba(255,77,77,0.3)', color: 'var(--red)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Delete</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
                Last edited {new Date(selected.updatedAt).toLocaleString()}
              </div>
              <textarea
                value={selected.content}
                onChange={e => updateNote(selected.id, { content: e.target.value })}
                placeholder="Start writing..."
                style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, resize: 'none', outline: 'none' }}
              />
            </div>
          ) : (
            <div className="card empty-state">
              <div style={{ fontSize: 36 }}>📓</div>
              <div>Select a note or create one</div>
              <button className="btn btn-primary" onClick={createNote} style={{ marginTop: 8 }}>+ New Note</button>
            </div>
          )}
        </div>
      </div>
    </AppFrame>
  )
}
