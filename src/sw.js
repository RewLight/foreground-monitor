import { precacheAndRoute } from 'workbox-precaching'

self.addEventListener('message', (evt) => {
  if (evt.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// 在构建时 Workbox 会把 __WB_MANIFEST 注入进来
precacheAndRoute(self.__WB_MANIFEST || [])

