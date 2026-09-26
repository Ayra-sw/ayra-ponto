// Localização é opcional: se a pessoa negar ou o aparelho não tiver GPS, o
// ponto é registrado do mesmo jeito (a Portaria 671 proíbe bloquear).
export async function obterLocalizacao() {
  if (!navigator.geolocation) return {}
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 60000 }))
    return { p_latitude: Number(pos.coords.latitude.toFixed(6)), p_longitude: Number(pos.coords.longitude.toFixed(6)) }
  } catch {
    return {}
  }
}
