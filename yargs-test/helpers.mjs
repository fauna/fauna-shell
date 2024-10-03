// small helper for sinon to wrap your return value
// in the shape fetch would return it from the network
export function f(returnValue) {
  return { json: async () => returnValue }
}
