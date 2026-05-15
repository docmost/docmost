export function getColStyleDeclaration(minWidth: number, width: number | undefined): [string, string] {
  if (width) {
    return ['width', `${Math.max(width, minWidth)}px`]
  }

  return ['min-width', `${minWidth}px`]
}
