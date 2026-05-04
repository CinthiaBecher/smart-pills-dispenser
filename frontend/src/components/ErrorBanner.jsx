export default function ErrorBanner({ erro, onClose }) {
  if (!erro) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="12" cy="12" r="9" stroke="#D85A30" strokeWidth="2" />
          <path d="M12 8v4M12 16h.01" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-red-700">{erro}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-red-400 shrink-0 hover:text-red-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
