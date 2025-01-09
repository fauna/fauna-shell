/** @typedef {import('awilix').AwilixContainer<import('./config/setup-container.mjs').modifiedInjectables> } container */
/** @type {container} */
export let container;

/**
 * @param {container} newContainer - The new container to set.
 */
export const setContainer = (newContainer) => {
  container = newContainer;
};
