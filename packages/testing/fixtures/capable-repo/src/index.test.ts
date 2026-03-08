import { greet } from "./index";
test("greet returns hello message", () => {
  expect(greet("World")).toBe("Hello, World!");
});
