
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const today = localDate(new Date())
const tomorrow = localDate(
  new Date(new Date().setDate(new Date().getDate() + 1)),
)

const roomHighlights = [
  {
    name: 'Standard Room',
    description: 'A welcoming space for a comfortable, restful stay.',
    image:
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=85',
    tag: 'COMFORT',
  },
  {
    name: 'Deluxe Room',
    description: 'More space, refined details, and extra comfort.',
    image:
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=900&q=85',
    tag: 'ELEVATED',
  },
  {
    name: 'Suite',
    description: 'A spacious retreat for a more memorable experience.',
    image:
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=900&q=85',
    tag: 'EXCEPTIONAL',
  },
]

export default function GuestLandingPage() {
  const navigate = useNavigate()

  const [arrival, setArrival] = useState(today)
  const [departure, setDeparture] = useState(tomorrow)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [rooms, setRooms] = useState(1)
  const [error, setError] = useState('')

  function searchRooms(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (arrival < today) {
      setError('Check-in cannot be in the past.')
      return
    }

    if (departure <= arrival) {
      setError('Check-out must be after check-in.')
      return
    }

    const params = new URLSearchParams({
      arrival,
      departure,
      adults: String(adults),
      children: String(children),
      rooms: String(rooms),
    })

    navigate(`/guest/rooms?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#202d26]">
      {/* Public navigation */}
      <header className="relative z-10 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/guest" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#193b30] text-xl text-[#d8bd88]">
              G
            </span>

            <span>
              <span className="block text-lg font-bold tracking-[0.22em]">
                GASTORA
              </span>
              <span className="block text-[9px] tracking-[0.22em] text-[#85775e]">
                HOSPITALITY REIMAGINED
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a href="#experience" className="transition hover:text-[#a17d43]">
              Experience
            </a>
            <a href="#rooms" className="transition hover:text-[#a17d43]">
              Our Rooms
            </a>
            <a href="#about" className="transition hover:text-[#a17d43]">
              About Gastora
            </a>
          </nav>

          <Link
            to="/guest/stay"
            className="rounded-full border border-[#193b30] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#193b30] hover:text-white sm:px-5"
          >
            My Stay
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-[530px] overflow-hidden bg-[#193b30] lg:min-h-[590px]">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2200&q=90')",
          }}
        />

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#10271f]/90 via-[#10271f]/65 to-[#10271f]/20" />

        <div className="mx-auto flex max-w-7xl flex-col justify-center px-5 py-20 sm:px-8 sm:py-28 lg:min-h-[590px]">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-semibold tracking-[0.3em] text-[#e0c18b] sm:text-sm">
              A BETTER WAY TO STAY
            </p>

            <h1 className="max-w-2xl text-4xl font-light leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
              Your next stay
              <span className="block font-semibold text-[#e4c997]">
                starts here.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
              Discover a more thoughtful hotel experience. Find your room,
              plan your stay, and let Gastora take care of the details.
            </p>

            <a
              href="#booking"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#d9bd87] px-7 py-3.5 text-sm font-semibold text-[#193b30] transition hover:bg-white"
            >
              Find your room
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="absolute bottom-6 right-8 hidden text-xs tracking-[0.2em] text-white/70 lg:block">
          COMFORT · CARE · EXPERIENCE
        </div>
      </section>

      {/* Booking search */}
      <section id="booking" className="relative z-10 mx-auto -mt-7 max-w-7xl px-5 sm:px-8">
        <form
          onSubmit={searchRooms}
          className="rounded-2xl border border-black/5 bg-white p-5 shadow-[0_15px_60px_rgba(0,0,0,0.10)] sm:p-7"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
                PLAN YOUR VISIT
              </p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                Find your perfect stay
              </h2>
            </div>

            <span className="text-sm text-gray-500">
              Choose your dates and guests
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Check-in
              </span>
              <input
                type="date"
                required
                min={today}
                value={arrival}
                onChange={(event) => setArrival(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f6] px-3 py-3.5 text-sm outline-none focus:border-[#193b30] focus:ring-2 focus:ring-[#193b30]/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Check-out
              </span>
              <input
                type="date"
                required
                min={arrival || today}
                value={departure}
                onChange={(event) => setDeparture(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f6] px-3 py-3.5 text-sm outline-none focus:border-[#193b30] focus:ring-2 focus:ring-[#193b30]/10"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Adults
              </span>
              <select
                value={adults}
                onChange={(event) => setAdults(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f6] px-3 py-3.5 text-sm outline-none focus:border-[#193b30]"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Adult' : 'Adults'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Children
              </span>
              <select
                value={children}
                onChange={(event) => setChildren(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f6] px-3 py-3.5 text-sm outline-none focus:border-[#193b30]"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Child' : 'Children'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                Rooms
              </span>
              <select
                value={rooms}
                onChange={(event) => setRooms(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-[#faf9f6] px-3 py-3.5 text-sm outline-none focus:border-[#193b30]"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Room' : 'Rooms'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col justify-between gap-4 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
            <p className="text-sm text-gray-500">
              Rates and availability are confirmed during room search.
            </p>

            <button
              type="submit"
              className="rounded-xl bg-[#193b30] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#285242] focus:outline-none focus:ring-2 focus:ring-[#193b30] focus:ring-offset-2"
            >
              Search availability →
            </button>
          </div>
        </form>
      </section>

      {/* Experience */}
      <section id="experience" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
              THE GASTORA EXPERIENCE
            </p>
            <h2 className="mt-4 text-3xl font-light leading-snug sm:text-4xl">
              Hospitality that feels personal.
            </h2>
          </div>

          <p className="leading-7 text-gray-600 md:col-span-2 md:pt-5">
            Your journey should be effortless from the first search to the
            moment you leave. Explore your options, manage your reservation,
            and access guest services in one convenient place.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {[
            {
              number: '01',
              title: 'Easy booking',
              text: 'Choose your dates and discover rooms available for your stay.',
            },
            {
              number: '02',
              title: 'Clear pricing',
              text: 'Review your stay total and required deposit before confirming.',
            },
            {
              number: '03',
              title: 'A connected stay',
              text: 'Access your stay information and request services from one portal.',
            },
          ].map((item) => (
            <article
              key={item.number}
              className="rounded-2xl border border-[#e8e4db] bg-white p-6 sm:p-7"
            >
              <span className="text-sm font-semibold text-[#a17d43]">
                {item.number}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Room categories */}
      <section id="rooms" className="bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
                FIND YOUR SPACE
              </p>
              <h2 className="mt-3 text-3xl font-light sm:text-4xl">
                Rooms for every kind of stay.
              </h2>
            </div>

            <a
              href="#booking"
              className="text-sm font-semibold text-[#193b30] hover:text-[#a17d43]"
            >
              Check availability →
            </a>
          </div>

          <div className="mt-10 grid gap-7 md:grid-cols-3">
            {roomHighlights.map((room) => (
              <article key={room.name} className="group overflow-hidden">
                <div className="relative overflow-hidden rounded-2xl">
                  <img
                    src={room.image}
                    alt={room.name}
                    loading="lazy"
                    className="h-64 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-72"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#193b30]">
                    {room.tag}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 pt-5">
                  <div>
                    <h3 className="text-xl font-semibold">{room.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {room.description}
                    </p>
                  </div>
                  <span className="pt-1 text-xl text-[#a17d43]">↗</span>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-xs leading-5 text-gray-500">
            Room categories and photographs are illustrative. Actual room
            descriptions, rates, and availability must come from Gastora's
            property and reservation data.
          </p>
        </div>
      </section>

      {/* Guest portal */}
      <section id="about" className="bg-[#193b30] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#d9bd87]">
              YOUR STAY, IN YOUR HANDS
            </p>

            <h2 className="mt-4 text-3xl font-light leading-snug text-white sm:text-4xl">
              Already have a reservation?
            </h2>

            <p className="mt-4 max-w-xl leading-7 text-white/75">
              Access your reservation details, review your folio, and request
              services during your stay through the Gastora guest portal.
            </p>
          </div>

          <Link
            to="/guest/stay"
            className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#d9bd87] px-7 py-4 text-sm font-semibold text-[#193b30] transition hover:bg-white"
          >
            Access My Stay
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#10271f] px-5 py-8 text-white/70 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm sm:flex-row sm:items-center">
          <span className="font-semibold tracking-[0.2em] text-white">
            GASTORA
          </span>
          <span>Thoughtful hospitality. Connected experiences.</span>
          <span>© {new Date().getFullYear()} Gastora</span>
        </div>
      </footer>
    </main>
  )
}
