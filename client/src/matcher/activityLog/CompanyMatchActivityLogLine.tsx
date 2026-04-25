/**
 * @file CompanyMatchActivityLogLine.tsx
 * @description `VendorActivityLogLine` + company-match activity body highlighting.
 */
import { VendorActivityLogLine } from '../../platform/local/shared/vendorActivityLog/VendorActivityLogLine'
import type { VendorActivityLogLineProps } from '../../platform/local/shared/vendorActivityLog/types'
import { renderCompanyMatchActivityBody } from './body'

export type CompanyMatchActivityLogLineProps = Omit<VendorActivityLogLineProps, 'renderBody'>

export function CompanyMatchActivityLogLine(props: CompanyMatchActivityLogLineProps) {
  const { palette, themeMode, ...rest } = props
  return (
    <VendorActivityLogLine
      {...rest}
      palette={palette}
      themeMode={themeMode}
      renderBody={(body) => renderCompanyMatchActivityBody(body, { palette, themeMode })}
    />
  )
}
