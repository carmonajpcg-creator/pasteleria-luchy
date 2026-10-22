import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading, LoadError } from '../../../components/QueryState'
import { btnPrimary } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { usePageTitle } from '../../../hooks/usePageTitle'
import { ProductCard, ProductGrid } from '../components/ProductCard'
import { demoImages, demoImageFor } from '../demoImages'
import { useCategories, useProductImages, useProducts } from '../hooks'

export function HomePage() {
  usePageTitle(undefined)
  const products = useProducts()
  const categories = useCategories()
  const images = useProductImages()
  const featured = products.data?.filter((p) => p.featured) ?? []
  const [preview, setPreview] = useState('Pasteles')

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <h1 id="home-title">Pastelería<br />Luchy</h1>
          <p className="hero-lead">Para celebrar.<br /> O solo porque se antoja.</p>
          <p className="hero-description">Pasteles, cupcakes y pequeños antojos. Elige tu favorito y armemos un buen momento para compartir.</p>
          <Link to="/catalogo" className={btnPrimary}>Ver catálogo<Icon name="arrow" /></Link>
          <p className="hero-order-note"><Icon name="check" />Tu pedido se confirma por WhatsApp</p>
        </div>
        <div className="hero-gallery">
          <figure className="hero-photo-main"><img src={demoImages.cake} width="1024" height="1024" alt="Imagen de ejemplo: pastel de vainilla con fresas" fetchPriority="high" /><figcaption>Algo dulce para tu día</figcaption></figure>
          <div className="hero-photo-pair"><img src={demoImages.cupcakes} width="1024" height="1024" alt="Imagen de ejemplo: cupcakes de chocolate" /><img src={demoImages.cookies} width="1024" height="1024" alt="Imagen de ejemplo: galletas con chocolate" /></div>
          <p className="hero-image-note">Imágenes ilustrativas de ejemplo</p>
        </div>
      </section>
      <section aria-labelledby="categorias" className="category-section">
        <div className="section-heading"><h2 id="categorias">¿Qué se te antoja?</h2><p>Encuentra tu próximo favorito.</p></div>
        <div className="category-index">
          <div className="category-list">{categories.data?.map((c) => <Link key={c.id} to={`/catalogo?categoria=${c.slug}`} onMouseEnter={() => setPreview(c.name)} onFocus={() => setPreview(c.name)} className="category-row"><span>{c.name}</span><Icon name="arrow" /></Link>)}
            {categories.isPending && <Loading what="las categorías" />}
            {categories.isError && <LoadError what="las categorías" onRetry={() => void categories.refetch()} />}
          </div>
          <figure className="category-preview"><img key={preview} src={demoImageFor(preview)} width="1024" height="1024" alt={`Imagen de ejemplo de ${preview}`} loading="lazy" /><figcaption>{preview}<span>Imagen de ejemplo</span></figcaption></figure>
        </div>
      </section>
      <section aria-labelledby="destacados" className="featured-section">
        <div className="section-heading"><div><h2 id="destacados">Dulces favoritos</h2><p>Una selección para empezar a disfrutar.</p></div><Link to="/catalogo" className="text-link">Ver todo el catálogo<Icon name="arrow" /></Link></div>
        {products.isPending && <Loading what="los productos destacados" />}
        {products.isError && <LoadError what="los productos destacados" onRetry={() => void products.refetch()} />}
        {products.data && <ProductGrid>{featured.map((p) => <li key={p.id}><ProductCard product={p} image={images.data?.find((i) => i.product_id === p.id)} /></li>)}</ProductGrid>}
        {products.data && featured.length === 0 && <p>Pronto encontrarás nuestros destacados. Mientras tanto, <Link to="/catalogo" className="text-link">explora el catálogo</Link>.</p>}
      </section>
      <section className="order-story" aria-labelledby="como-pedir">
        <div className="order-story-photo"><img src={demoImages.brownies} width="1024" height="1024" alt="Imagen de ejemplo: brownies de chocolate para compartir" loading="lazy" /><span className="demo-caption">Imagen de ejemplo</span></div>
        <div className="order-story-copy"><h2 id="como-pedir">Pide a tu gusto</h2><p>Tú eliges el antojo. Lo demás, lo platicamos.</p><ol className="order-steps"><li><strong>Encuentra tu favorito</strong><span>Explora el catálogo y agrega tus productos al carrito.</span></li><li><strong>Cuéntanos los detalles</strong><span>Elige fecha, entrega o recolección y añade tus notas.</span></li><li><strong>Confirma con la tienda</strong><span>Revisa tu pedido por WhatsApp. Solo queda confirmado cuando la tienda te lo indique.</span></li></ol><Link to="/catalogo" className={btnPrimary}>Elegir algo rico<Icon name="arrow" /></Link></div>
      </section>
      <section className="home-contact" aria-labelledby="algo-especial"><h2 id="algo-especial">¿Algo especial?</h2><div><p>Para una celebración o un detalle especial, cuéntanos qué necesitas.</p><Link to="/contacto" className="text-link">Hablemos de tu pedido<Icon name="arrow" /></Link></div></section>
    </>
  )
}
