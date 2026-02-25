interface Props {
  text: string
}

export function BodyText({ text }: Props) {
  if (!text) return null
  return <>{text}</>
}
