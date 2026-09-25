export default function Modal({ title, onClose, children, maxWidth = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className={`w-full ${maxWidth} bg-base-900 border-[0.5px] border-line rounded-lg p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <button onClick={onClose} className="text-ink-secondary hover:text-white text-sm">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
