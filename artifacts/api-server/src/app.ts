import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { initTelegramBot } from "./lib/telegram";
import { initScheduler } from "./lib/scheduler";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    autoLogging: {
      ignore: (req) => req.url === "/api/ping",
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

// Increase payload limit to handle base64 profile photos (up to 10 MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const sessionSecret = process.env.SESSION_SECRET || "netherworld-secret-fallback";

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
  },
}));

app.use("/api", router);

initTelegramBot();
initScheduler();

// Self-ping every 4 minutes to keep the Replit free tier alive
const SELF_PING_INTERVAL = 4 * 60 * 1000;
function startKeepAlive() {
  setInterval(async () => {
    try {
      const port = process.env.PORT || 8080;
      await fetch(`http://localhost:${port}/api/ping`);
    } catch {
      // silently ignore — server may be mid-restart
    }
  }, SELF_PING_INTERVAL);
}
startKeepAlive();

export default app;
