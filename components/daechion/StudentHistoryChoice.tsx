'use client'

export type StudentHistory = 'EXISTING' | 'NEW'

// Kept separate from the legacy application form. The process-2 form owns
// required-field validation; `required` on both checkboxes would require both.
export default function StudentHistoryChoice({ value, onChange, error, disabled = false }: {
  value?: StudentHistory; onChange: (value: StudentHistory) => void; error?: string; disabled?: boolean
}) {
  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={error ? 'student-history-error' : undefined}>
    <legend style={{ font: 'inherit', fontWeight: 600, marginBottom: 12 }}>기존 수강 여부 (필수)</legend>
    <div role="group" aria-label="기존 수강 여부" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {([{ value: 'EXISTING', label: '기존 수강생' }, { value: 'NEW', label: '신규 수강생' }] as const).map(option =>
        <label key={option.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer' }}>
          <input type="checkbox" name="studentHistory" value={option.value} checked={value === option.value}
            onChange={() => onChange(option.value)} style={{ width: 18, height: 18, accentColor: '#3b82f6' }} />
          {option.label}
        </label>)}
    </div>
    {error && <p id="student-history-error" role="alert" style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}
  </fieldset>
}
