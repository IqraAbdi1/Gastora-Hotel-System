
import { useEffect, useState } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ConciergeChatWidget from './ConciergeChatWidget'
import GuestFooter from './GuestFooter'
import HotelLocationSection from './HotelLocationSection'
import { useFeatures } from '../platform/featuresContext'

const heroImages = [
  '/images/hero.jpg',
  '/images/hero1.jpg',
  '/images/hero2.jpg',
  '/images/hero3.jpg',
  '/images/hero4.jpg',
]

function localDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getTomorrow(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return localDate(date)
}

function getDateAfter(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return getTomorrow()
  }

  date.setDate(date.getDate() + 1)
  return localDate(date)
}

const roomHighlights = [
  {
    name: 'Standard Room',
    description:
      'A welcoming retreat with the essentials for a comfortable, restful stay.',
    image: '/images/normal_room.jpg',
    tag: 'COMFORT',
  },
  {
    name: 'Deluxe Room',
    description:
      'Enjoy extra space, refined details and a little more room to unwind.',
    image: '/images/advanced_room.jpg',
    tag: 'ELEVATED',
  },
  {
    name: 'Garden Retreat',
    description:
      'A peaceful atmosphere inspired by natural tones and relaxing surroundings.',
    image: '/images/room_in_like_garden.jpg',
    tag: 'SERENE',
  },
  {
    name: 'Contemporary Room',
    description:
      'A clean, modern interior designed for an effortless hotel experience.',
    image: '/images/natural_room.jpg',
    tag: 'MODERN',
  },
  {
    name: 'Premium View',
    description:
      'A bright, inviting space with an open outlook and room to relax.',
    image: '/images/room_with_better_view.jpg',
    tag: 'PREMIUM',
  },
  {
    name: 'Signature Suite',
    description:
      'A generous setting for guests who appreciate space and considered details.',
    image: '/images/room_with_all.jpg',
    tag: 'SIGNATURE',
  },
  {
    name: 'Classic Bedroom',
    description:
      'Timeless styling and a calm atmosphere for an easy, comfortable stay.',
    image: '/images/bed_room.jpg',
    tag: 'CLASSIC',
  },
  {
    name: 'Advanced Suite',
    description:
      'Contemporary finishes and a spacious setting for a more elevated visit.',
    image: '/images/bed_room_advanced.jpg',
    tag: 'SUITE',
  },
  {
    name: 'Warm Retreat',
    description:
      'Warm tones and a cosy atmosphere to help you settle in after a busy day.',
    image: '/images/bed_with_better.jpg',
    tag: 'RELAXED',
  },
  {
    name: 'Room with a View',
    description:
      'An inviting place to slow down and enjoy a change of scenery.',
    image: '/images/room1.jpg',
    tag: 'VIEW',
  },
  {
    name: 'Simple Comfort',
    description:
      'An uncluttered room focused on the essentials of a restful stay.',
    image: '/images/simple_room.jpg',
    tag: 'ESSENTIAL',
  },
  {
    name: 'Evening Comfort',
    description:
      'A cosy setting to return to and relax in after a full day.',
    image: '/images/simple_room2.jpg',
    tag: 'COSY',
  },
]

const experiences = [
  {
    number: '01',
    title: 'A simpler booking experience',
    text: 'Choose your dates, select your preferred room and explore the options for your visit.',
  },
  {
    number: '02',
    title: 'Clarity at every step',
    text: 'Review available options and the applicable pricing information throughout your booking.',
  },
  {
    number: '03',
    title: 'Your stay in one place',
    text: 'Access your guest account and, when connected, view your reservations and stay information.',
  },
]

const facilities = [
  {
    title: 'Breakfast',
    image: '/images/breakfast.jpg',
    text: 'Ease into the day with a welcoming breakfast experience.',
  },
  {
    title: 'Dining',
    image: '/images/lunch.jpg',
    text: 'Make time for good food in a relaxed setting.',
  },
  {
    title: 'Swimming pool',
    image: '/images/swimming_pool.jpg',
    text: 'Take a refreshing break and enjoy a slower pace.',
  },
  {
    title: 'Poolside retreat',
    image: '/images/advanced_room%20(2).jpg',
    text: 'Discover an inviting setting for outdoor relaxation.',
  },
  {
    title: 'Fitness',
    image: '/images/gym1.jpg',
    text: 'Make room for movement while you are away.',
  },
  {
    title: 'Garden and leisure',
    image: '/images/chilling.jpg',
    text: 'Find a quiet moment in a relaxed atmosphere.',
  },
  {
    title: 'Fitness studio',
    image: '/images/gym.jpg',
    text: 'Keep up with your routine in a dedicated space.',
  },
  {
    title: 'Gym facilities',
    image: '/images/gym2.jpg',
    text: 'Enjoy another way to stay active during your visit.',
  },
  {
    title: 'Reception and lounge',
    image: '/images/recenption.jpg',
    text: 'A welcoming first impression when you arrive.',
  },
]

const eventSpaces = [
  {
    title: 'Conference auditorium',
    description:
      'A setting to explore for conferences, presentations and larger gatherings.',
    image: '/images/auditorium.jpg',
  },
  {
    title: 'Meeting room',
    description:
      'A professional environment for discussions and smaller meetings.',
    image: '/images/confress_one.jpg',
  },
  {
    title: 'Banquets and celebrations',
    description:
      'Explore a venue for celebrations, special occasions and shared moments.',
    image: '/images/weeding_and_co-operating_meeting_halls.jpg',
  },
  {
    title: 'Flexible event space',
    description: 'A versatile setting for gatherings with different needs.',
    image: '/images/confress_room.jpg',
  },
  {
    title: 'Celebration setting',
    description:
      'A space to consider for meaningful occasions and memorable events.',
    image: '/images/weeding_places.jpg',
  },
]

export default function GuestLandingPage() {
  const navigate = useNavigate()
  const { tenant } = useFeatures()

  // Always use the active tenant's name for the guest-facing hotel identity.
  // Keep Gastora as the platform brand in platform-level UI, not as the hotel name.
  const tenantBrandName = tenant.name?.trim() || 'Hotel'

  const [activeHeroImage, setActiveHeroImage] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHeroHovered, setIsHeroHovered] = useState(false)
  const [isHeroFocused, setIsHeroFocused] = useState(false)
  const [isDocumentHidden, setIsDocumentHidden] = useState(
    () => document.hidden,
  )
  const [reduceMotion, setReduceMotion] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [arrival, setArrival] = useState(() => localDate(new Date()))
  const [departure, setDeparture] = useState(() => getTomorrow())
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [rooms, setRooms] = useState(1)
  const [error, setError] = useState('')

  const today = localDate(new Date())

  useEffect(() => {
    document.title = `${tenantBrandName} | Official Hotel Website`
  }, [tenantBrandName])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')

    const updateMotionPreference = () => {
      setReduceMotion(media.matches)
    }

    updateMotionPreference()
    media.addEventListener('change', updateMotionPreference)

    return () => {
      media.removeEventListener('change', updateMotionPreference)
    }
  }, [])

  useEffect(() => {
    const updateVisibility = () => {
      setIsDocumentHidden(document.hidden)
    }

    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (
      isHeroHovered ||
      isHeroFocused ||
      isDocumentHidden ||
      reduceMotion ||
      heroImages.length < 2
    ) {
      return
    }

    const interval = window.setInterval(() => {
      setActiveHeroImage((current) => (current + 1) % heroImages.length)
    }, 6500)

    return () => {
      window.clearInterval(interval)
    }
  }, [isHeroHovered, isHeroFocused, isDocumentHidden, reduceMotion])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  function searchRooms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const currentDate = localDate(new Date())

    if (!arrival || !departure) {
      setError('Please select both check-in and check-out dates.')
      return
    }

    if (arrival < currentDate) {
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

    navigate(`/book?${params.toString()}`)
  }

  function openMyStay() {
    setMobileMenuOpen(false)
    navigate('/guest/login?redirect=%2Fstay')
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget

    image.style.display = 'none'
    image.dataset.imageFailed = 'true'

    console.error(
      `Hotel landing page image failed to load: ${image.currentSrc || image.src}`,
    )
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#faf9f6] text-[#202d26]">
      {/* HEADER AND NAVIGATION */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
          isScrolled
            ? 'border-stone-200 bg-white/95 shadow-sm backdrop-blur-md'
            : 'border-white/20 bg-black/20'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            to="/"
            aria-label={`${tenantBrandName} home`}
            className="flex shrink-0 items-center gap-3"
            onClick={closeMobileMenu}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#193b30] text-xl text-[#d8bd88]">
              {tenantBrandName.charAt(0).toUpperCase() || 'H'}
            </span>

            <span>
              <span
                className={`block max-w-[180px] truncate text-lg font-bold tracking-[0.08em] sm:max-w-[260px] ${
                  isScrolled ? 'text-emerald-950' : 'text-white'
                }`}
              >
                {tenantBrandName.toUpperCase()}
              </span>

              <span
                className={`block text-[9px] tracking-[0.22em] ${
                  isScrolled ? 'text-stone-500' : 'text-white/75'
                }`}
              >
                YOUR HOTEL, YOUR STAY
              </span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className={`hidden items-center gap-6 text-sm lg:flex ${
              isScrolled ? 'text-stone-700' : 'text-white'
            }`}
          >
            <a href="#experience" className="transition hover:text-[#d9bd87]">
              Experience
            </a>
            <a href="#rooms" className="transition hover:text-[#d9bd87]">
              Our rooms
            </a>
            <a href="#facilities" className="transition hover:text-[#d9bd87]">
              Facilities
            </a>
            <a href="#events" className="transition hover:text-[#d9bd87]">
              Events
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={openMyStay}
              className={`hidden rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:inline-flex ${
                isScrolled
                  ? 'border-[#193b30] text-[#193b30] hover:bg-[#193b30] hover:text-white'
                  : 'border-white/70 text-white hover:bg-white/15'
              }`}
            >
              My Stay
            </button>

            <Link
              to="/book"
              onClick={closeMobileMenu}
              className={`hidden rounded-full px-5 py-2.5 text-sm font-semibold transition sm:inline-flex ${
                isScrolled
                  ? 'bg-[#193b30] text-white hover:bg-[#285242]'
                  : 'bg-[#d9bd87] text-[#193b30] hover:bg-white'
              }`}
            >
              Book a stay
            </Link>

            <button
              type="button"
              aria-label={
                mobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={mobileMenuOpen}
              aria-controls="tenant-mobile-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border md:hidden ${
                isScrolled
                  ? 'border-stone-300 text-[#193b30]'
                  : 'border-white/60 text-white'
              }`}
            >
              <span aria-hidden="true" className="text-xl">
                {mobileMenuOpen ? '×' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="tenant-mobile-navigation"
            aria-label="Mobile navigation"
            className="border-t border-stone-200 bg-white px-5 py-4 text-[#193b30] shadow-lg md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-medium">
              <a href="#experience" onClick={closeMobileMenu}>
                Experience
              </a>
              <a href="#rooms" onClick={closeMobileMenu}>
                Our rooms
              </a>
              <a href="#facilities" onClick={closeMobileMenu}>
                Facilities
              </a>
              <a href="#events" onClick={closeMobileMenu}>
                Meetings and events
              </a>

              <button
                type="button"
                onClick={openMyStay}
                className="text-left"
              >
                My Stay
              </button>

              <Link to="/book" onClick={closeMobileMenu}>
                Book a stay
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* HERO SECTION */}
      <section
        onMouseEnter={() => setIsHeroHovered(true)}
        onMouseLeave={() => setIsHeroHovered(false)}
        onFocusCapture={() => setIsHeroFocused(true)}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget

          if (
            !(nextTarget instanceof Node) ||
            !event.currentTarget.contains(nextTarget)
          ) {
            setIsHeroFocused(false)
          }
        }}
        className="relative isolate min-h-[610px] overflow-hidden bg-[#193b30] pt-20 lg:min-h-[670px]"
        aria-label={`${tenantBrandName} hotel highlights`}
      >
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {heroImages.map((image, index) => (
            <img
              key={image}
              src={image}
              alt=""
              aria-hidden="true"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
              onError={handleImageError}
              className={`absolute inset-0 h-full w-full object-cover object-center ${
                reduceMotion
                  ? ''
                  : 'transition-opacity duration-[1500ms] ease-in-out'
              } ${
                activeHeroImage === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#10271f]/90 via-[#10271f]/65 to-[#10271f]/20"
          aria-hidden="true"
        />

        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/30 via-transparent to-black/20"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-center px-5 py-20 sm:px-8 sm:py-28 lg:min-h-[590px]">
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
              Find your room, plan your stay, and let {tenantBrandName} take
              care of the details.
            </p>

            <a
              href="#booking"
              className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#d9bd87] px-7 py-3.5 text-sm font-semibold text-[#193b30] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#193b30]"
            >
              Find your room
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div
            className="mt-10 flex items-center gap-2"
            role="group"
            aria-label="Choose hero background image"
          >
            {heroImages.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveHeroImage(index)}
                aria-label={`Show hero image ${index + 1}`}
                aria-pressed={activeHeroImage === index}
                className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white ${
                  activeHeroImage === index
                    ? 'w-8 bg-[#e4c997]'
                    : 'w-3 bg-white/60 hover:bg-white'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 right-8 z-10 hidden text-xs tracking-[0.2em] text-white/80 lg:block">
          COMFORT · CARE · EXPERIENCE
        </div>
      </section>

      {/* BOOKING SEARCH */}
      <section
        id="booking"
        className="relative z-10 mx-auto -mt-7 max-w-7xl scroll-mt-24 px-5 sm:px-8"
      >
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
                onChange={(event) => {
                  const nextArrival = event.target.value
                  setArrival(nextArrival)
                  setError('')

                  if (nextArrival && departure <= nextArrival) {
                    setDeparture(getDateAfter(nextArrival))
                  }
                }}
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
                min={getDateAfter(arrival)}
                value={departure}
                onChange={(event) => {
                  setDeparture(event.target.value)
                  setError('')
                }}
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
                {[1, 2, 3, 4, 5, 6].map((number) => (
                  <option key={number} value={number}>
                    {number} {number === 1 ? 'Adult' : 'Adults'}
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
                {[0, 1, 2, 3, 4, 5, 6].map((number) => (
                  <option key={number} value={number}>
                    {number} {number === 1 ? 'Child' : 'Children'}
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
                {[1, 2, 3, 4, 5].map((number) => (
                  <option key={number} value={number}>
                    {number} {number === 1 ? 'Room' : 'Rooms'}
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

      {/* TENANT HOTEL EXPERIENCE */}
      <section
        id="experience"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
              THE {tenantBrandName.toUpperCase()} EXPERIENCE
            </p>
            <h2 className="mt-4 text-3xl font-light leading-snug sm:text-4xl">
              Hospitality that feels personal.
            </h2>
          </div>

          <p className="leading-7 text-gray-600 md:col-span-2 md:pt-5">
            Discover a more considered hotel experience, from exploring your
            room to managing your reservation through your guest account.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {experiences.map((item) => (
            <article
              key={item.number}
              className="rounded-2xl border border-[#e8e4db] bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-7"
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

      {/* ROOM GALLERY */}
      <section id="rooms" className="scroll-mt-24 bg-white py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
                FIND YOUR SPACE
              </p>
              <h2 className="mt-3 text-3xl font-light sm:text-4xl">
                Rooms for every kind of stay.
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-gray-600">
                From practical comfort to spacious suites, explore the room
                styles and find an option that suits your visit.
              </p>
            </div>

            <a
              href="#booking"
              className="text-sm font-semibold text-[#193b30] hover:text-[#a17d43]"
            >
              Check availability →
            </a>
          </div>

          <div className="mt-10 grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {roomHighlights.map((room) => (
              <article key={room.name} className="group min-w-0">
                <div className="relative overflow-hidden rounded-2xl bg-stone-100">
                  <img
                    src={room.image}
                    alt={room.name}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className={`h-64 w-full object-cover sm:h-72 ${
                      reduceMotion
                        ? ''
                        : 'transition duration-500 group-hover:scale-105'
                    }`}
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

                  <a
                    href="#booking"
                    aria-label={`Check availability for ${room.name}`}
                    className="shrink-0 rounded-full border border-stone-200 px-3 py-2 text-lg text-[#a17d43] transition hover:border-[#193b30] hover:bg-[#193b30] hover:text-white"
                  >
                    ↗
                  </a>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-8 text-xs leading-5 text-gray-500">
            Room details, prices and availability are confirmed during the
            booking process.
          </p>
        </div>
      </section>

      {/* HOTEL FACILITIES */}
      <section
        id="facilities"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
              MORE TO EXPERIENCE
            </p>
            <h2 className="mt-4 text-3xl font-light leading-snug sm:text-4xl">
              Space to unwind, recharge and connect.
            </h2>
          </div>

          <p className="max-w-2xl leading-7 text-gray-600">
            Explore the spaces that can make a hotel visit feel more complete,
            from dining and fitness to outdoor leisure and welcoming shared
            areas.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((item) => (
            <article
              key={item.title}
              className="group min-w-0 overflow-hidden rounded-2xl border border-stone-100 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="overflow-hidden bg-stone-100">
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                  className={`h-56 w-full object-cover ${
                    reduceMotion
                      ? ''
                      : 'transition duration-500 group-hover:scale-105'
                  }`}
                />
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {item.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* MEETINGS AND EVENTS */}
      <section
        id="events"
        className="scroll-mt-24 bg-[#f0eee7] px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#a17d43]">
                GATHER AT {tenantBrandName.toUpperCase()}
              </p>
              <h2 className="mt-4 text-3xl font-light leading-snug sm:text-4xl">
                Meetings, milestones and memorable moments.
              </h2>
            </div>

            <p className="max-w-xl leading-7 text-gray-600">
              Explore spaces for professional gatherings, conferences and
              celebrations. Contact the team to discuss your event requirements
              and availability.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {eventSpaces.map((item) => (
              <article
                key={item.title}
                className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="overflow-hidden bg-stone-200">
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    onError={handleImageError}
                    className={`h-56 w-full object-cover ${
                      reduceMotion
                        ? ''
                        : 'transition duration-500 group-hover:scale-105'
                    }`}
                  />
                </div>

                <div className="p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* GUEST PORTAL */}
      <section
        id="guest-portal"
        className="scroll-mt-24 bg-[#193b30] px-5 py-16 sm:px-8 lg:py-20"
      >
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#d9bd87]">
              YOUR STAY, IN YOUR HANDS
            </p>
            <h2 className="mt-4 text-3xl font-light leading-snug text-white sm:text-4xl">
              Your reservation, all in one place.
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-white/75">
              Sign in to your guest account to access your stay information.
              Use the guest options provided by {tenantBrandName} to manage
              your stay.
            </p>
          </div>

          <button
            type="button"
            onClick={openMyStay}
            className="inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#d9bd87] px-7 py-4 text-sm font-semibold text-[#193b30] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#193b30]"
          >
            Sign in to My Stay
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* HOTEL LOCATION AND MAP */}
      <HotelLocationSection />

      {/* SITE FOOTER */}
      <GuestFooter />

      {/* RESTORED GUEST CONCIERGE CHATBOT */}
      <ConciergeChatWidget />
    </main>
  )
}
