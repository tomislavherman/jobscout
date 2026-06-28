import { useState } from 'react'
import { useT } from '../i18n'

export default function NotInterestedModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (notes: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-2">{t('mark_not_interested')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('not_interested_reason')}</p>
        <textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('not_interested_placeholder')}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onSubmit(notes)}
            className="px-4 py-2 text-sm rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
