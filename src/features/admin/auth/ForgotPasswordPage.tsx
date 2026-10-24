import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Field, inputClass } from '../../../components/Field'
import { btnPrimary } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { supabase } from '../../../lib/supabase'

const schema = z.object({ email: z.string().trim().min(1, 'Escribe tu correo').email('Ingresa un correo válido') })
type Values = z.infer<typeof schema>

export function ForgotPasswordPage() {
  usePageTitle('Recuperar contraseña')
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    if (!supabase) {
      setFormError('El panel no está configurado.')
      return
    }
    // El enlace vuelve a la raíz del sitio (ver lib/recoveryRedirect.ts).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
    })
    if (error) {
      setFormError(
        error.status === 429 || error.code === 'over_email_send_rate_limit'
          ? 'Ya se envió un correo hace poco. Espera unos minutos e inténtalo de nuevo.'
          : 'No pudimos enviar el correo. Inténtalo de nuevo.',
      )
      return
    }
    setSent(true)
  })

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Recuperar contraseña</h1>
      <p className="mb-6 text-muted">Te enviaremos un enlace a tu correo para elegir una contraseña nueva.</p>
      {sent ? (
        <div role="status" className="rounded-card bg-white p-4 shadow-card">
          <p className="mb-2 font-semibold">Revisa tu correo.</p>
          <p>
            Si la cuenta existe, recibirás un enlace para restablecer la contraseña (revisa también spam). Ábrelo en este
            mismo navegador y dispositivo.
          </p>
        </div>
      ) : (
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
          {formError && (
            <p role="alert" className="mb-4 text-danger">
              {formError}
            </p>
          )}
          <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full disabled:opacity-60`}>
            {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
      <p className="mt-4 text-center">
        <Link to="/admin/login" className="font-semibold text-purple-700 underline">
          Volver al acceso
        </Link>
      </p>
    </main>
  )
}
