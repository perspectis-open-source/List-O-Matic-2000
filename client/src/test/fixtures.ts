/**
 * @file fixtures.ts
 * @description Shared test fixtures: mockContacts, mockHeaders for component and API tests.
 * @module List-O-Matic-2000/client
 */
import type { ContactRow } from '../utils/parseFile'

export const mockContacts: ContactRow[] = [
  { Name: 'Alice Smith', Email: 'alice@acme.com', Company: 'Acme Inc' },
  { Name: 'Bob Jones', Email: 'bob@acme.com', Company: 'Acme Inc' },
  { Name: 'Carol Lee', Email: 'carol@globex.com', Company: 'Globex Corp' },
]

export const mockHeaders = ['Name', 'Email', 'Company']
