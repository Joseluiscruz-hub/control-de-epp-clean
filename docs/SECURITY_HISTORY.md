# Auditoría de secretos en el historial de Git

**Fecha:** 2026-10-29. **Herramienta:** gitleaks v8.21.2 (`gitleaks git . --redact`) sobre los 183 commits de `main`.

| Hallazgo | Commit | Estado en `HEAD` | Evaluación |
|---|---|---|---|
| `gcp-api-key` en `firebase-applet-config.json` | `bcadf35` | El archivo ya no existe | Es la API key **web** de Firebase. Firebase la trata como identificador público, porque la seguridad depende de Auth, App Check y las Security Rules. Aun así debe estar **restringida** por dominio (HTTP referrer) y por API en Google Cloud Console, o rotarse. |
| `generic-api-key` en `lib/idempotency.test.ts` | `29a9d8e` | Sí existe | **Falso positivo**: es una llave de idempotencia de prueba, no una credencial. |

Los commits nuevos de esta iteración (`92bfd4d..HEAD`) no tienen hallazgos.

## Decisión: no reescribir `main`
El historial tiene commits de varios autores, entre ellos bots de Copilot y Codex y PRs fusionados. Reescribirlo con `git filter-repo` y force-push invalidaría los clones y PRs existentes. A cambio, los dos hallazgos son de bajo riesgo: una key pública de Firebase y un falso positivo. Por eso se decidió:

1. **No reescribir.** El repo sigue **privado**.
2. Restringir o rotar la API key web de Firebase del proyecto de producción. Es una acción manual en Google Cloud Console → Credentials.
3. Mantener `.env*` fuera de Git; `.env.example` no lleva valores.
4. Para mostrar el proyecto públicamente se usa un **mirror sanitizado** con historial nuevo: código anonimizado, sin datos de planta ni marcas. Así este historial nunca se publica.

## Cómo repetir la auditoría
```bash
gitleaks git . --redact                       # historial completo
gitleaks git . --redact --log-opts="-20"      # últimos commits
```

## Identificadores de marca en commits antiguos

Desde el commit de limpieza de identificadores, el arbol de `main` no contiene nombres de marca de la planta de origen
(los campos `erpSku`, ids `erp-*` y la fuente `PLANT_ERP` reemplazan a los nombres anteriores). Los commits previos
si conservan esos nombres. No se reescribio el historial porque `main` tiene varios autores; si el repo se publica,
hacerlo desde un mirror limpio (un solo commit) en vez de abrir este historial.
