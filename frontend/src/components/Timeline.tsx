import type { TimelineEntry } from '../types'
import { useT } from '../i18n'
import type { Translations } from '../i18n/en'

const TYPE_LABEL_KEYS: Record<string, keyof Translations> = {
  interview:     'entry_type_interview',
  prep:          'entry_type_prep',
  feedback:      'entry_type_feedback',
  reminder:      'entry_type_reminder',
  note:          'entry_type_note',
  status_change: 'entry_type_status_change',
}

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const t = useT()

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 italic">{t('no_timeline_entries')}</p>
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gray-200" />
      {entries.map((entry) => {
        const isStatusChange = entry.entry_type === 'status_change'
        const labelKey = TYPE_LABEL_KEYS[entry.entry_type]

        return (
          <div key={entry.id} className="relative">
            <div className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-white" />
            <div className="text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {labelKey && (
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                    {t(labelKey)}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(entry.created_at).toLocaleDateString(t('date_locale'))}
                </span>
              </div>
              {isStatusChange && entry.status_from && entry.status_to && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {t(`status_${entry.status_from}` as keyof Translations)} &rarr; {t(`status_${entry.status_to}` as keyof Translations)}
                </p>
              )}
              {entry.content && (
                <p className="text-gray-600 mt-1 whitespace-pre-wrap">{entry.content}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
