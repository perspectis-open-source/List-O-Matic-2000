/**
 * @file UploadDropZone.test.tsx
 * @description Vitest unit tests for UploadDropZone component.
 * @module List-O-Matic-2000/client
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../test/utils'
import { UploadDropZone } from './UploadDropZone'

describe('UploadDropZone', () => {
  it('renders nothing when closed', () => {
    render(
      <UploadDropZone open={false} onClose={() => {}} onFileAccepted={() => {}} />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with dropzone when open', () => {
    render(
      <UploadDropZone open={true} onClose={() => {}} onFileAccepted={() => {}} />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Upload contacts/)).toBeInTheDocument()
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument()
  })
})
