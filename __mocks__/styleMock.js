const mock = new Proxy(
  {},
  {
    get: (target, key) => {
      if (key === "__esModule") return false;
      if (key === "default") return mock;
      return key;
    },
  }
);
module.exports = mock;
