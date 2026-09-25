import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import Botao from '../ui/Botao'

export default function BotaoTema({ comTexto = false }) {
  const { theme, toggleTheme } = useTheme()
  const escuro = theme === 'dark'
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'
  return (
    <Botao
      variante="discreto"
      className={comTexto ? '' : 'btn--icone'}
      icone={escuro ? Sun : Moon}
      onClick={toggleTheme}
      aria-label={comTexto ? undefined : rotulo}
      title={rotulo}
    >
      {comTexto ? rotulo : null}
    </Botao>
  )
}
