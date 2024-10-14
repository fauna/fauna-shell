// small helper for sinon to wrap your return value
// in the shape fetch would return it from the network
export function f(returnValue) {
  return { json: async () => returnValue };
}

export const commonFetchParams = {
  method: "GET",
  headers: {
    AUTHORIZATION: "Bearer secret",
  },
};
