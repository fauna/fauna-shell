export async function makeFaunaRequest({ argv, url, params, method, shouldThrow = true }) {
  const paramsString = params
    ? `?${new URLSearchParams(params)}`
    : ''

  const fullUrl = new URL(`${url}${paramsString}`, argv.url)
  const response = await fetch(fullUrl, {
    method,
    headers: { AUTHORIZATION: `Bearer ${argv.secret}` },
  })

  const obj = await response.json()

  if (obj.error && shouldThrow) {
    throw new Error(obj.error.message)
  }

  return obj
}
