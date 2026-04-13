/**
 * @file fixtures.ts
 * @description Shared test fixtures: mockContacts, mockHeaders for component and API tests.
 * @module List-O-Matic-2000/client
 */
import type { ContactRow } from '../utils/parseFile'

export const mockHeaders: string[] = [
  'First',
  'Last',
  'Company',
  'Title',
  'Email',
  'City',
  'State',
  'Zip',
  'Country',
]

export const mockContacts: ContactRow[] = [
  {
    First: 'Alice',
    Last: 'Smith',
    Company: 'Acme Inc',
    Title: 'Engineer',
    Email: 'alice@acme.com',
    City: 'Boston',
    State: 'MA',
    Zip: '02101',
    Country: 'USA',
  },
  {
    First: 'Bob',
    Last: 'Jones',
    Company: 'Acme Inc',
    Title: 'Manager',
    Email: 'bob@acme.com',
    City: 'Boston',
    State: 'MA',
    Zip: '02102',
    Country: 'USA',
  },
  {
    First: 'Carol',
    Last: 'Lee',
    Company: 'Globex Corp',
    Title: 'Director',
    Email: 'carol@globex.com',
    City: 'NYC',
    State: 'NY',
    Zip: '10001',
    Country: 'USA',
  },
]

/** Legacy-shape rows for parse/import tests */
export const mockLegacyContacts: ContactRow[] = [
  { Name: 'Alice Smith', Email: 'alice@acme.com', Company: 'Acme Inc' },
  { Name: 'Bob Jones', Email: 'bob@acme.com', Company: 'Acme Inc' },
  { Name: 'Carol Lee', Email: 'carol@globex.com', Company: 'Globex Corp' },
]

export const mockLegacyHeaders = ['Name', 'Email', 'Company']
