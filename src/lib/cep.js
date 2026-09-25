import { apenasDigitos } from './formatos'

// Busca o endereço de um CEP no ViaCEP (serviço público e gratuito).
// Se falhar, a pessoa simplesmente preenche à mão.
export async function buscarCep(cep) {
  const v = apenasDigitos(cep)
  if (v.length !== 8) return null
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${v}/json/`)
    if (!resposta.ok) return null
    const d = await resposta.json()
    if (d.erro) return null
    return { logradouro: d.logradouro || '', bairro: d.bairro || '', cidade: d.localidade || '', uf: d.uf || '' }
  } catch {
    return null
  }
}
