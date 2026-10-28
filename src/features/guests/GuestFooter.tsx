
import { Link } from 'react-router-dom'
import { useFeatures } from '../platform/featuresContext'

export default function GuestFooter() {
  const { tenant } = useFeatures()
  const tenantBrandName = tenant.group?.trim() || tenant.name
  const currentYear = new Date().getFullYear()
  const hotelAddress = [tenant.registry?.address, tenant.registry?.town]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ')
  const hotelPhone = tenant.registry?.phone
  const hotelEmail = tenant.registry?.email

  return (
    <footer className="bg-gray-950 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Link
            to="/"
            className="text-2xl font-bold tracking-wide text-white"
          >
            {tenantBrandName}<span className="text-amber-500">.</span>
          </Link>

          <p className="mt-4 max-w-xs text-sm leading-7 text-gray-400">
            Experience comfort, warm hospitality, and memorable stays at{' '}
            {tenant.name}.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Quick Links
          </h2>

          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                className="transition hover:text-amber-400"
                to="/"
              >
                Home
              </Link>
            </li>

            <li>
              <Link
                className="transition hover:text-amber-400"
                to="/#rooms"
              >
                Rooms &amp; Suites
              </Link>
            </li>

            <li>
              <Link
                className="transition hover:text-amber-400"
                to="/#experience"
              >
                About Us
              </Link>
            </li>

            <li>
              <Link
                className="transition hover:text-amber-400"
                to="/#location"
              >
                Contact
              </Link>
            </li>

            <li>
              <Link
                className="transition hover:text-amber-400"
                to="/#guest-portal"
              >
                Guest Portal
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Contact
          </h2>

          <ul className="mt-4 space-y-3 text-sm leading-6">
            {hotelAddress && <li>{hotelAddress}</li>}

            {hotelPhone && (
              <li>
                <a
                  href={`tel:${hotelPhone.replace(/\s/g, '')}`}
                  className="transition hover:text-amber-400"
                >
                  {hotelPhone}
                </a>
              </li>
            )}

            {hotelEmail && (
              <li>
                <a
                  href={`mailto:${hotelEmail}`}
                  className="break-all transition hover:text-amber-400"
                >
                  {hotelEmail}
                </a>
              </li>
            )}

            {!hotelAddress && !hotelPhone && !hotelEmail && (
              <li className="text-gray-500">
                Contact details will be provided by {tenant.name}.
              </li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Plan Your Stay
          </h2>

          <p className="mt-4 text-sm leading-6 text-gray-400">
            Ready to visit? Explore our rooms or contact our team for help
            with your reservation.
          </p>

          <Link
            to="/#rooms"
            className="mt-5 inline-flex rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Explore Rooms
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-gray-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>
            &copy; {currentYear} {tenantBrandName}. All rights reserved.
          </p>

          <a
            href="#top"
            className="transition hover:text-amber-400"
          >
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  )
}
