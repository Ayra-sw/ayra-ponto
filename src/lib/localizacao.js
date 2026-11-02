// Localização no ponto. Normalmente é opcional: se a pessoa negar ou o
// aparelho não tiver GPS, o ponto é registrado do mesmo jeito.
// Quando a empresa liga o bloqueio fora da cerca, pedimos uma posição nova e
// mais precisa: o banco confere e recusa a marcação fora da cerca ou sem local.
export async function obterLocalizacao({ precisa = false } = {}) {
  if (!navigator.geolocation) return {}
  const opcoes = precisa
    ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    : { timeout: 5000, maximumAge: 60000 }
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, opcoes))
    return { p_latitude: Number(pos.coords.latitude.toFixed(6)), p_longitude: Number(pos.coords.longitude.toFixed(6)) }
  } catch {
    return {}
  }
}
