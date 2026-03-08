// A hostile repo: no types, no tests, no docs, no CI
const x = require("./lib");
module.exports = function () {
  return x.doStuff();
};
