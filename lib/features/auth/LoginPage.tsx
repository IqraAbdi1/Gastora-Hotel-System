import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { USERS, roleById } from '../../lib/roles'
import type { User } from '../../lib/roles'
import { useAuth } from './authContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, loginAs } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function enter(user: User) {
    navigate(roleById(user.role).landing, { replace: true })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    const user = login(email)
    if (!user) {
      setError('No account found for that email. Use one of the demo accounts below.')
      return
    }
    enter(user)
  }

  function pick(id: string) {
    const user = loginAs(id)
    if (user) enter(user)
  }

  const demo = USERS.filter((u) => u.demo)
  const hotel = demo.filter((u) => u.role !== 'platform')
  const platform = demo.filter((u) => u.role === 'platform')

  return (
    <main className="min-h-screen bg-canvas">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden bg-sidebar p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-2xl font-bold">Gastora</p>

            <p className="mt-1 text-sm text-white/60">
              Hotel & Resort Management Platform
            </p>
          </div>

          <div className="max-w-xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
              Hospitality operations
            </p>

            <h1 className="text-4xl font-bold leading-tight">
              One platform for managing your hotel operations.
            </h1>

            <p className="mt-5 text-base leading-7 text-white/70">
              Manage front desk operations, housekeeping, restaurant services,
              inventory, finance, guests, and business performance from one
              connected workspace.
            </p>
          </div>

          <p className="text-xs text-white/40">
            Gastora 2027
          </p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-2xl font-bold text-ink lg:hidden">
                Gastora
              </p>

              <h2 className="mt-2 text-3xl font-bold text-ink">
                Welcome back
              </h2>

              <p className="mt-2 text-sm text-ink/60">
                Sign in to continue to your hotel workspace.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm"
            >
              {error && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-bad/20 bg-bad/10 px-4 py-3 text-sm text-bad"
                >
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-ink"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-ink/15 bg-canvas px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-ink"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-lg border border-ink/15 bg-canvas px-4 py-3 pr-20 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((visible) => !visible)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink/60 hover:text-ink"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Sign in
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-ink/10 bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Demo accounts</p>
              <p className="mt-1 text-xs text-ink/60">
                Prototype only. Click one to sign in, no password needed. Or type its email with any password.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {hotel.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => pick(u.id)}
                    className="rounded-lg border border-ink/15 px-3 py-2 text-left hover:border-brand hover:bg-canvas"
                  >
                    <span className="block text-sm font-semibold text-ink">{roleById(u.role).label}</span>
                    <span className="block text-xs text-ink/60">{u.name}</span>
                  </button>
                ))}
              </div>
              {platform.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pick(u.id)}
                  className="mt-3 w-full rounded-lg border border-dashed border-ink/25 px-3 py-2 text-left hover:border-brand hover:bg-canvas"
                >
                  <span className="block text-sm font-semibold text-ink">Gastora team: {roleById(u.role).label}</span>
                  <span className="block text-xs text-ink/60">Manages hotels and their plans</span>
                </button>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-ink/50">
              Access is controlled by your assigned Gastora role and
              permissions.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}