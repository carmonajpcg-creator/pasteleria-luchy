import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { describedBy, Field, inputClass } from '../../../../components/Field'
import { Loading, LoadError } from '../../../../components/QueryState'
import { btnPrimary } from '../../../../components/ui'
import { usePageTitle } from '../../../../hooks/usePageTitle'
import { slugify } from '../../lib/slugify'
import { useExec } from '../../lib/useExec'
import { deleteCategory, listCategories, saveCategory, type AdminCategory } from '../api'
import { categorySchema, toCategoryInput, type CategoryValues } from '../schema'

function CategoryForm({ category, onDone }: { category: AdminCategory | null; onDone: () => void }) {
  const { exec, busy, error } = useExec()
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      sortOrder: String(category?.sort_order ?? 0),
      active: category?.active ?? true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (await exec(() => saveCategory(category?.id ?? null, toCategoryInput(values)))) onDone()
  })

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      noValidate
      aria-labelledby="cat-form-title"
      className="mb-6 rounded-card bg-white p-4 shadow-card"
    >
      <h2 id="cat-form-title" className="mb-3 text-xl font-bold">
        {category ? `Editar categoría: ${category.name}` : 'Nueva categoría'}
      </h2>
      <Field id="cat-name" label="Nombre" error={errors.name?.message}>
        <input
          id="cat-name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('cat-name', { error: Boolean(errors.name) })}
          className={`${inputClass} ${errors.name ? 'border-danger' : 'border-line'}`}
          {...register('name', {
            // El slug se propone desde el nombre mientras no se haya editado a mano ni exista ya.
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              if (!category && !getFieldState('slug').isDirty) setValue('slug', slugify(e.target.value))
            },
          })}
        />
      </Field>
      <Field
        id="cat-slug"
        label="Clave de URL"
        hint="Minúsculas, números y guiones. Se usa en los enlaces del catálogo."
        error={errors.slug?.message}
      >
        <input
          id="cat-slug"
          aria-invalid={errors.slug ? true : undefined}
          aria-describedby={describedBy('cat-slug', { hint: true, error: Boolean(errors.slug) })}
          className={`${inputClass} ${errors.slug ? 'border-danger' : 'border-line'}`}
          {...register('slug')}
        />
      </Field>
      <Field id="cat-order" label="Orden" error={errors.sortOrder?.message}>
        <input
          id="cat-order"
          inputMode="numeric"
          aria-invalid={errors.sortOrder ? true : undefined}
          aria-describedby={describedBy('cat-order', { error: Boolean(errors.sortOrder) })}
          className={`${inputClass} ${errors.sortOrder ? 'border-danger' : 'border-line'}`}
          {...register('sortOrder')}
        />
      </Field>
      <label className="mb-4 flex items-center gap-3">
        <input type="checkbox" className="size-6" {...register('active')} />
        <span>Activa (visible en la tienda)</span>
      </label>
      {error && (
        <p role="alert" className="mb-3 text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={`${btnPrimary} disabled:opacity-60`}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="min-h-12 font-semibold underline" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export function CategoriesPage() {
  usePageTitle('Categorías')
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: listCategories })
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null)
  const { exec, busy, error } = useExec()

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Categorías</h1>
        {editing === null && (
          <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
            Nueva categoría
          </button>
        )}
      </div>

      {editing !== null && (
        <CategoryForm
          key={editing === 'new' ? 'new' : editing.id}
          category={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-danger bg-white p-3 text-danger">
          {error}
        </p>
      )}
      {categories.isPending && <Loading what="las categorías" />}
      {categories.isError && <LoadError what="las categorías" onRetry={() => void categories.refetch()} />}
      {categories.data && (
        <ul className="grid gap-3">
          {categories.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white p-4 shadow-card">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">
                  /{c.slug} · orden {c.sort_order} · {c.active ? 'Activa' : 'Inactiva'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="min-h-12 font-semibold text-purple-700 underline"
                  aria-label={`Editar ${c.name}`}
                  onClick={() => setEditing(c)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-12 font-semibold text-danger underline disabled:opacity-60"
                  aria-label={`Borrar ${c.name}`}
                  onClick={() => {
                    if (window.confirm(`¿Borrar la categoría «${c.name}»? Solo es posible si no tiene productos.`)) {
                      void exec(() => deleteCategory(c.id))
                    }
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
