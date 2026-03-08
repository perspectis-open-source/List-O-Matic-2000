/**
 * @file UploadDropZone.tsx
 * @description Dialog with drop zone for CSV/Excel contact file upload.
 * @module List-O-Matic-2000/client
 */
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Dialog, DialogTitle, DialogContent, Typography, Box } from '@mui/material'

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

type Props = {
  open: boolean
  onClose: () => void
  onFileAccepted: (file: File) => void
}

export function UploadDropZone({ open, onClose, onFileAccepted }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        onFileAccepted(file)
        onClose()
      }
    },
    [onFileAccepted, onClose]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxFiles: 1,
    noClick: false,
    noKeyboard: false,
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload contacts</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'action.hover' : 'background.default',
          }}
        >
          <input {...getInputProps()} />
          <Typography color="text.secondary">
            {isDragActive
              ? 'Drop CSV or Excel here'
              : 'Drag and drop a CSV or .xlsx file here, or click to choose'}
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
