// Local .env uses NODE_ENV=development for Express. Always optimize release assets.
process.env.NODE_ENV = "production";
const { build } = await import("vite");
await build({ mode: "production" });
