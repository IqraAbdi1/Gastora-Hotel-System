import { useFeatures } from '../platform/featuresContext'

export default function HotelLocationSection() {
  const { tenant } = useFeatures()
  const hotelName = tenant.name
  const hotelAddress = [tenant.registry?.address, tenant.registry?.town]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ')
  const hotelPhone = tenant.registry?.phone
  const hotelEmail = tenant.registry?.email
  const mapQuery = hotelAddress || tenant.registry?.town || hotelName
  const encodedMapQuery = encodeURIComponent(mapQuery)
  const mapUrl = `https://maps.google.com/maps?q=${encodedMapQuery}&output=embed`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedMapQuery}`

  return (
    <section id="location" className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
            Find Us
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Visit {hotelName}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
            We look forward to welcoming you. Find our location, get directions,
            or contact our team for more information.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-sm">
            <iframe
              title={`${hotelName} location on Google Maps`}
              src={mapUrl}
              width="100%"
              height="420"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-2xl font-bold text-gray-900">
              Contact &amp; Location
            </h3>
            <p className="mt-3 leading-7 text-gray-600">
              Have a question or need help planning your stay? Contact {hotelName}
              or use Google Maps to find the hotel.
            </p>

            <div className="mt-8 space-y-6">
              {hotelAddress && (
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900">Our Address</h4>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{hotelAddress}</p>
                    <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-amber-700 transition hover:text-amber-800">
                      Get Directions <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                </div>
              )}

              {hotelPhone && (
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A1.5 1.5 0 0 1 5.5 4H8l2 5-2 1.5a14 14 0 0 0 5.5 5.5L15 14l5 2v2.5a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 6.5 1.5 1.5 0 0 1 4 5.5Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900">Phone</h4>
                    <a href={`tel:${hotelPhone.replace(/\s+/g, '')}`} className="mt-1 inline-block text-sm text-gray-600 transition hover:text-amber-700">
                      {hotelPhone}
                    </a>
                  </div>
                </div>
              )}

              {hotelEmail && (
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-900">Email</h4>
                    <a href={`mailto:${hotelEmail}`} className="mt-1 inline-block break-all text-sm text-gray-600 transition hover:text-amber-700">
                      {hotelEmail}
                    </a>
                  </div>
                </div>
              )}

              {!hotelAddress && !hotelPhone && !hotelEmail && (
                <p className="text-sm leading-6 text-gray-500">
                  Contact details for {hotelName} have not been added yet.
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
                Open Google Maps
              </a>
              {hotelEmail && (
                <a href={`mailto:${hotelEmail}`} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-amber-600 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
                  Email Us
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
