// Imágenes ilustrativas locales: nunca sustituyen una foto real subida por la tienda.
export const demoImages = {
  cake: `${import.meta.env.BASE_URL}images/luchy-cake.webp`,
  cupcakes: `${import.meta.env.BASE_URL}images/luchy-cupcakes.webp`,
  cookies: `${import.meta.env.BASE_URL}images/luchy-cookies.webp`,
  brownies: `${import.meta.env.BASE_URL}images/luchy-brownies.webp`,
}

export function demoImageFor(name: string) {
  const text = name.toLocaleLowerCase('es-MX')
  if (text.includes('cupcake')) return demoImages.cupcakes
  if (text.includes('galleta')) return demoImages.cookies
  if (text.includes('brownie') || text.includes('barra') || text.includes('chocolate')) return demoImages.brownies
  return demoImages.cake
}
