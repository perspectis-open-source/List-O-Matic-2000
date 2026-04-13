/**
 * @file importSchemas.ts
 * @description Canonical CSV/Excel column sets for contact and company imports (exact header strings).
 * @module List-O-Matic-2000/client
 */

export const NEW_CONTACT_HEADERS = [
  'First',
  'Last',
  'Company',
  'Title',
  'Email',
  'City',
  'State',
  'Zip',
  'Country',
] as const

export const LEGACY_CONTACT_MIN_HEADERS = ['Name', 'Email', 'Company'] as const

export const COMPANY_REQUIRED_HEADERS = [
  'Name',
  'Client Number',
  'Open Date',
  'Status',
  'Client Originating Attorney',
] as const

export type ContactSchemaKind = 'new' | 'legacy'
