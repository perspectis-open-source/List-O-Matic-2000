import { useMemo, useState } from 'react'
import { Autocomplete, TextField } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'

type Props = {
  contacts: ContactRow[]
  companyColumnKey: string | null
  value: string | null
  onChange: (company: string | null) => void
  onSelectForChat?: (company: string) => void
  disabled?: boolean
}

export function CompanySelect({
  contacts,
  companyColumnKey,
  value,
  onChange,
  onSelectForChat,
  disabled,
}: Props) {
  const [inputValue, setInputValue] = useState('')

  const uniqueCompanies = useMemo(() => {
    if (!companyColumnKey || !contacts.length) return []
    const set = new Set<string>()
    for (const row of contacts) {
      const v = row[companyColumnKey]
      if (v != null && String(v).trim() !== '') set.add(String(v).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [contacts, companyColumnKey])

  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return uniqueCompanies
    const lower = inputValue.toLowerCase()
    return uniqueCompanies.filter((c) => c.toLowerCase().includes(lower))
  }, [uniqueCompanies, inputValue])

  if (!companyColumnKey) return null

  return (
    <Autocomplete
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      options={filteredOptions}
      getOptionLabel={(opt) => opt}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search company"
          placeholder="Type to search company names..."
          size="small"
          disabled={disabled}
        />
      )}
      disabled={disabled}
      sx={{ minWidth: 280 }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value && onSelectForChat) {
          onSelectForChat(value)
        }
      }}
    />
  )
}
