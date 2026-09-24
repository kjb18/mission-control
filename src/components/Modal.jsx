export default function Modal({ title, onClose, children, maxWidth = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className={`w-full ${maxWidth} bg-base-900 border border-white/10 rounded-2xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-sm">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
