import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs" };

const clients = new Set<VercelResponse>();
const WEBHOOK_SECRET = process.env.NEQUI_WEBHOOK_SECRET || "dulceplacer-radar-2024";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const heartbeat = setInterval(() => {
      res.write("event: ping\ndata: {}\n\n");
    }, 25000);

    clients.add(res);

    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });

    const welcomeMsg = JSON.stringify({ mensaje: "Radar Nequi conectado" });
    res.write("event: connected\ndata: " + welcomeMsg + "\n\n");
    return;
  }

  if (req.method === "POST") {
    const token = req.headers["x-webhook-secret"] || req.query.secret;
    if (token !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Token invalido" });
    }

    const body = req.body || {};
    const monto = body.monto;
    const remitente = body.remitente || "Cliente Nequi";
    const descripcion = body.descripcion || "Transferencia recibida";
    const banco = body.banco || "Nequi";

    if (!monto) {
      return res.status(400).json({ error: "Falta monto" });
    }

    const evento = {
      tipo: "pago_recibido",
      monto: Number(monto),
      remitente,
      descripcion,
      banco,
      timestamp: new Date().toISOString(),
    };

    const payload = "event: pago\ndata: " + JSON.stringify(evento) + "\n\n";
    let enviados = 0;
    clients.forEach((client) => {
      try {
        client.write(payload);
        enviados++;
      } catch {
        clients.delete(client);
      }
    });

    return res.status(200).json({ ok: true, enviados, evento });
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-webhook-secret");
    return res.status(200).end();
  }

  return res.status(405).json({ error: "Metodo no permitido" });
}
