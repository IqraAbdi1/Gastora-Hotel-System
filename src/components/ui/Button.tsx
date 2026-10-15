import type { ButtonHTMLAttributes } from 'react'
import { buttonClass } from './buttonStyles'
import type { ButtonSize, ButtonVariant } from './buttonStyles'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }

export default function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...rest }: Props) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />
}
