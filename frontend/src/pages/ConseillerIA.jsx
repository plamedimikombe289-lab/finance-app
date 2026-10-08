import { useState, useRef, useEffect, useCallback } from 'react'
import { iaApi } from '../api'

const SUGGESTIONS = [
  'Analyse ma situation financière actuelle',
  'Quelle dette devrais-je rembourser en premier ?',
  'Comment augmenter mon épargne ce mois-ci ?',
  'Mes enveloppes sont-elles bien équilibrées ?',
]

function DotsLoading() {
  return (
    <div className="flex gap-1 items-center py-0.5">
      {[0, 150, 300].map(delay => (
        <span
          key={delay}
          className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

function Message({ m }) {
  const isUser  = m.role === 'user'
  const isError = m.role === 'error'

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-base flex-shrink-0 mt-0.5 shadow-sm">
          ✨
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm'
          : isError
            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded-tl-sm'
            : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-sm shadow-sm border border-gray-100 dark:border-gray-700'
      }`}>
        {m.content}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-base flex-shrink-0 mt-0.5 shadow-sm">
          👤
        </div>
      )}
    </div>
  )
}

export default function ConseillerIA() {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [statut,   setStatut]   = useState(null)
  const bottomRef  = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    iaApi.statut()
      .then(s  => setStatut(s))
      .catch(() => setStatut({ disponible: false }))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const envoyer = useCallback(async (texte) => {
    const q = (texte ?? input).trim()
    if (!q || loading) return

    setInput('')
    const updated = [...messages, { role: 'user', content: q }]
    setMessages(updated)
    setLoading(true)

    try {
      const historique = updated
        .slice(-8, -1)
        .map(m => ({ role: m.role === 'error' ? 'assistant' : m.role, content: m.content }))

      const res = await iaApi.chat({ message: q, historique })
      setMessages(m => [...m, { role: 'assistant', content: res.reponse }])
    } catch (e) {
      setMessages(m => [
        ...m,
        { role: 'error', content: e?.message || 'Erreur lors de la communication avec l\'IA.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      envoyer()
    }
  }

  const isEmpty = messages.length === 0
  const iaActive = statut?.disponible === true

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 8rem)' }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            ✨ San Prince IA
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Analyse ta situation financière et répond à tes questions — 100% local, 0% cloud
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {statut !== null && (
            <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
              iaActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${iaActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {iaActive ? 'San Prince IA actif' : 'San Prince IA indisponible'}
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
            >
              Nouvelle conv.
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 p-4 space-y-4 min-h-0" style={{
        background: 'rgba(248,250,252,0.6)',
      }}>

        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-6 py-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/25">
              ✨
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Bonjour ! Je suis ton conseiller financier IA.
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                J'analyse tes enveloppes, dettes et comptes en temps réel pour te donner des conseils personnalisés.
                Tout reste sur ton ordinateur.
              </p>
            </div>

            {!iaActive && statut !== null && (
              <div className="px-5 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 max-w-sm text-left">
                <p className="font-semibold mb-1">Ollama n'est pas démarré.</p>
                <p>Ouvre un terminal et lance :</p>
                <code className="block mt-1.5 bg-red-100 dark:bg-red-900/40 px-3 py-1.5 rounded-lg font-mono text-xs">
                  ollama serve
                </code>
              </div>
            )}

            {iaActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => envoyer(s)}
                    disabled={loading}
                    className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-sm text-gray-700 dark:text-gray-300 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((m, i) => <Message key={i} m={m} />)}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-base flex-shrink-0 mt-0.5 shadow-sm">
                  ✨
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <DotsLoading />
                </div>
              </div>
            )}
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 space-y-1.5">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !iaActive && statut !== null
                ? 'Lance "ollama serve" pour activer l\'IA...'
                : 'Pose ta question financière... (Entrée pour envoyer, Maj+Entrée pour saut de ligne)'
            }
            disabled={!iaActive || loading}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ maxHeight: 100, overflowY: 'auto' }}
          />
          <button
            onClick={() => envoyer()}
            disabled={!input.trim() || !iaActive || loading}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-400 dark:disabled:text-gray-500 rounded-xl transition-all font-medium text-sm shadow-sm flex-shrink-0"
          >
            {loading ? '...' : 'Envoyer'}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
          Modèle Mistral 7B — tes données financières ne quittent jamais ton ordinateur
        </p>
      </div>
    </div>
  )
}
