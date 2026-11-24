import { Link } from 'react-router'
import { button } from '../styles'
import { Page } from '../ui'

export default function NotFound() {
  return (
    <Page className="items-center !gap-5 text-center sm:!pt-36">
      <span className="num text-[64px] font-medium leading-none text-muted">404</span>
      <h1 className="text-xl font-semibold">That page doesn't exist</h1>
      <p className="max-w-[420px] text-md text-muted">
        It may have moved — MachinePlay is in early alpha and URLs still change.
      </p>
      <div className="mt-2 flex gap-3">
        <Link to="/" className={`${button.primary} h-[34px] px-4`}>
          Back to home
        </Link>
        <Link to="/engine" className={`${button.secondary} h-[34px] px-4`}>
          Browse engines
        </Link>
      </div>
    </Page>
  )
}
