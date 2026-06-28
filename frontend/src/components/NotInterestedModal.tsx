import { useState } from 'react'

export default function NotInterestedModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (notes: string) => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-2">Mark as Not Interested</h3>
        <p className="text-sm text-gray-500 mb-4">Optional: add a reason for your records.</p>
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why are you not interested?"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(notes)}
            className="px-4 py-2 text-sm rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
