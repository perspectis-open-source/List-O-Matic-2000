import { Box, Button } from '@mui/material'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

type Props = {
  html: string
  isLastSlide: boolean
  onNext: () => void
}

function isFullDocument(html: string): boolean {
  const trimmed = html.trim().toLowerCase()
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.includes('<head') || trimmed.includes('<body')
}

export function DemoSlide({ html, isLastSlide, onNext }: Props) {
  const srcdoc = isFullDocument(html)
    ? html
    : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        bgcolor: 'background.default',
        p: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
        }}
      >
        <iframe
          title="Slide"
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
          style={{
            width: '100%',
            flex: 1,
            border: 'none',
            display: 'block',
          }}
        />
      </Box>
      <Box sx={{ p: 2, width: '100%', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <Button
          variant="contained"
          size="large"
          endIcon={isLastSlide ? <PlayArrowIcon /> : <NavigateNextIcon />}
          onClick={onNext}
        >
          {isLastSlide ? 'Start demo' : 'Next'}
        </Button>
      </Box>
    </Box>
  )
}
