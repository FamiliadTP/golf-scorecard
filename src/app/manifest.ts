import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Golf Scorecard',
    short_name: 'Golf Scorecard',
    description: 'Tarjeta de golf con múltiples modalidades',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F5EF',
    theme_color: '#1B4332',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
