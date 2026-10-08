import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.')
      return
    }

    navigate('/dashboard')
  }

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