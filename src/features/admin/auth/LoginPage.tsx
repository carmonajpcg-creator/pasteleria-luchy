import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Field, inputClass } from '../../../components/Field'
import { btnPrimary } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { supabase } from '../../../lib/supabase'
import { useAuth } from './AuthProvider'

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo').email('Ingresa un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})
type Values = z.infer<typeof schema>

function loginErrorMessage(error: { code?: string; status?: number }) {
  if (error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.'
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  }
  return 'No pudimos iniciar sesión. Inténtalo de nuevo.'
}

export function LoginPage() {
  usePageTitle('Acceso administrador')
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'
  const [formError, setFormError] = useState<string | null>(null)
  // El enlace de recuperación solo aparece después de un intento fallido por credenciales.
  const [wrongCredentials, setWrongCredentials] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null)
    setWrongCredentials(false)
    if (!supabase) {
      setFormError('El panel no está configurado.')
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setFormError(loginErrorMessage(error))
      setWrongCredentials(error.code === 'invalid_credentials')
      return
    }
    void navigate(from, { replace: true })
  })

  if (auth.status === 'authed') return <Navigate to={from} replace />

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Acceso administrador</h1>
      <p className="mb-6 text-muted">Solo para el personal de la tienda.</p>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="rounded-card bg-white p-4 shadow-card">
        <Field id="email" label="Correo" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="username"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={`${inputClass} ${errors.email ? 'border-danger' : 'border-line'}`}
            {...register('email')}
          />
        </Field>
        <Field id="password" label="Contraseña" error={errors.password?.message}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={`${inputClass} ${errors.password ? 'border-danger' : 'border-line'}`}
            {...register('password')}
          />
        </Field>
        {formError && (
          <p role="alert" className="mb-4 text-danger">
            {formError}
          </p>
        )}
        {wrongCredentials && (
          <p className="mb-4">
            <Link to="/admin/recuperar" className="font-semibold text-purple-700 underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full disabled:opacity-60`}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-center">
        <Link to="/" className="font-semibold text-purple-700 underline">
          Volver a la tienda
        </Link>
      </p>
    </main>
  )
}
