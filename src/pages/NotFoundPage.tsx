import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 max-w-md text-sm text-slate-500">The page you’re looking for doesn’t exist or has been moved.</p>
      <Button className="mt-5">
        <Link to="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  )
}
