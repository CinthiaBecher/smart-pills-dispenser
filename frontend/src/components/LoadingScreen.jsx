export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path
            d="M4.5 12.5L11.5 5.5C13.5 3.5 16.5 3.5 18.5 5.5C20.5 7.5 20.5 10.5 18.5 12.5L11.5 19.5C9.5 21.5 6.5 21.5 4.5 19.5C2.5 17.5 2.5 14.5 4.5 12.5Z"
            stroke="#6B7280"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-gray-400 text-lg">Carregando...</p>
    </div>
  )
}
