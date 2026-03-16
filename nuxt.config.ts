// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  fonts: {
    families: [
      { name: 'IBM Plex Sans', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600, 700] },
    ]
  },
  css: ['~/assets/main.css'],
  app: {
    head: {
      title: "O'zbekiston mehnat bozoriga AI ta'siri",
      meta: [
        { name: 'description', content: "O'zbekiston mehnat bozoriga sun'iy intellekt ta'sirini vizuallashtiruvchi interaktiv dashboard." }
      ]
    }
  }
})
