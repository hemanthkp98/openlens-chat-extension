import "@testing-library/jest-dom";
import "@testing-library/jest-dom/extend-expect";

// Polyfill requestAnimationFrame for jsdom tests
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};
