
import { Link } from 'react-router-dom'

const HOTEL_NAME = 'Gastora Hotel'
const HOTEL_ADDRESS = 'Kampala Road, Kampala, Uganda'
const HOTEL_PHONE = '+256 700 123 456'
const HOTEL_EMAIL = 'info@gastorahotel.com'

export default function HotelLocationSection() {
  const encodedAddress = encodeURIComponent(HOTEL_ADDRESS)

  const mapUrl = `https://maps.google.com/maps?q=${encodedAddress}&output=embed`

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`

  return (
    <section
      id="location"
      className="bg-white px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
            Find Us
          </p>

          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Visit {HOTEL_NAME}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            We look forward to welcoming you. Find our location and contact
            us if you need help planning your visit.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-6 shadow-sm sm:p-8">
            <h3 className="text-xl font-semibold text-gray-900">
              Contact Information
            </h3>

            <div className="mt-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z"
                    />
                    <circle cx="12" cy="9" r="2.3" />
                  </svg>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900">
                    Our Address
                  </h4>
                  <p className="mt-1 text-gray-600">
                    {HOTEL_ADDRESS}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 4h4l2 5-2.5 1.5a15 15 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10 21 3 14 3 6a2 2 0 0 1 2-2Z"
                    />
                  </svg>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900">
                    Phone
                  </h4>
                  <a
                    href={`tel:${HOTEL_PHONE.replace(/\s/g, '')}`}
                    className="mt-1 inline-block text-gray-600 transition hover:text-amber-700"
                  >
                    {HOTEL_PHONE}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4 7 8 6 8-6"
                    />
                  </svg>
                </div>

                <div>
                  <h4 className="font-semibold text-gray-900">
                    Email
                  </h4>
                  <a
                    href={`mailto:${HOTEL_EMAIL}`}
                    className="mt-1 inline-block break-all text-gray-600 transition hover:text-amber-700"
                  >
                    {HOTEL_EMAIL}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white transition hover:bg-amber-700"
              >
                Get Directions
              </a>

              <Link
                to="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-800 transition hover:border-amber-600 hover:text-amber-700"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="min-h-[320px] overflow-hidden rounded-2xl bg-gray-100 shadow-sm sm:min-h-[420px]">
            <iframe
              title={`${HOTEL_NAME} location on Google Maps`}
              src={mapUrl}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: '320px' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  )
}
