"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "sans-serif", padding: 32 }}>
        <h1>Ocurrio un error inesperado</h1>
        <p>El equipo ya fue notificado. Intenta de nuevo.</p>
        <button type="button" onClick={() => reset()}>Reintentar</button>
      </body>
    </html>
  );
}
