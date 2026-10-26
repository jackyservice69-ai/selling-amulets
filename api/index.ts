import express from "express";
import { app } from "../server/app.js";
// Vite serves the static frontend; this function handles same-origin /api requests.
const handler: express.Express = app;
export default handler;
