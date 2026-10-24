import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Field, inputClass } from '../../../components/Field'
import { Loading } from '../../../components/QueryState'
import { btnPrimary } from '../../../components/ui'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { supabase } from '../../../lib/supabase'
import { useAuth } from './AuthProvider'

// 12 caracteres: el mínimo adoptado para las cuentas de administrador (Fase 9).
const schema = z
  .object({
    password: z.string().min(12, 'Usa al menos 12 caracteres'),
    confirm: z.string().min(1, 'Repite la contraseña'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden' })
type Values = z.infer<typeof schema>

export function ResetPasswordPage() {
  usePageTitle('Nueva contraseña')
  const auth = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null)
    if (!supabase) return
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(
        error.code === 'weak_password'
          ? 'La contraseña es muy débil. Usa una más larga y variada.'
          : error.code === 'same_password'
            ? 'La contraseña nueva debe ser distinta de la anterior.'
            : 'No pudimos cambiar la contraseña. Pide un enlace nuevo e inténtalo de nuevo.',
      )
      return
    }
    void navigate('/admin', { replace: true })
  })

  if (auth.status === 'loading') {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <Loading what="el enlace" />
      </main>
    )
  }

  if (auth.status === 'anon') {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold">Enlace no válido</h1>
        <p className="mb-4">El enlace caducó, ya se usó o se abrió en otro navegador. Pide uno nuevo.</p>
        <Link to="/admin/recuperar" className="font-semibold text-purple-700 underline">
          Recuperar contraseña
        </Link>
      </main>
    )
  }

  const field = (name: keyof Values) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: `${inputClass} ${errors[name] ? 'border-danger' : 'border-line'}`,
  })

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-1 text-3xl font-bold">Nueva contraseña</h1>
      <p className="mb-6 text-muted">Elige una contraseña de al menos 12 caracteres.</p>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="rounded-card bg-white p-4 shadow-card">
        <Field id="password" label="Contraseña nueva" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="new-password" {...field('password')} {...register('password')} />
        </Field>
        <Field id="confirm" label="Repite la contraseña" error={errors.confirm?.message}>
          <input id="confirm" type="password" autoComplete="new-password" {...field('confirm')} {...register('confirm')} />
        </Field>
        {formError && (
          <p role="alert" className="mb-4 text-danger">
            {formError}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full disabled:opacity-60`}>
          {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </main>
  )
}
