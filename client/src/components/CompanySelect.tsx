import { useMemo, useState } from 'react'
import { Autocomplete, TextField } from '@mui/material'
import type { ContactRow } from '../utils/parseFile'

type Props = {
  contacts: ContactRow[]
  companyColumnKey: string | null
  value: string | null
  onChange: (company: string | null) => void
  onInputValueChange?: (input: string) => void
  onSelectForChat?: (company: string) => void
  disabled?: boolean
}

export function CompanySelect({
  contacts,
  companyColumnKey,
  value,
  onChange,
  onInputValueChange,
  onSelectForChat,
  disabled,
}: Props) {
  const [inputValue, setInputValue] = useState('')
  const handleInputChange = (_: unknown, newInput: string) => {
    setInputValue(newInput)
    onInputValueChange?.(newInput)
  }

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
      freeSolo
      value={value}
      onChange={(_, newValue) => onChange(typeof newValue === 'string' ? newValue.trim() || null : newValue)}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={filteredOptions}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : '')}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search company"
          placeholder="Type to search company names..."
          size="small"
          disabled={disabled}
          inputProps={{ ...params.inputProps, 'data-testid': 'company-select-input' }}
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
