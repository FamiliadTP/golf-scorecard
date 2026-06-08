# ⛳ Golf Scorecard

App de puntuación de golf con soporte para múltiples modalidades.

## Modalidades incluidas
- **Stroke Play** (Stableford con handicap) — 1 a 4 jugadores
- **Match Play Individual** — 1 vs 1, hoyo a hoyo con handicap
- **Match Play Dobles** — 2 vs 2, mejor bola por equipo
- **Bismarck** — 3 jugadores, 6 puntos por hoyo (4-2-0 / 4-1-1 / 3-3-0 / 2-2-2)

## Setup

### 1. Supabase

1. Crea una cuenta en [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Ve a **SQL Editor** y ejecuta el contenido de `supabase-schema.sql`
4. En **Settings → API**, copia:
   - `Project URL`
   - `anon public` key

### 2. Variables de entorno

Crea un archivo `.env.local` en la raíz:

```
NEXT_PUBLIC_SUPABASE_URL=tu_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### 3. GitHub

1. Crea un repositorio en GitHub
2. Sube todo el código:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tuusuario/golf-scorecard.git
git push -u origin main
```

### 4. Vercel

1. Ve a [vercel.com](https://vercel.com) → **Add New Project**
2. Importa tu repositorio de GitHub
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy** ✅

---

## Desarrollo local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Flujo de uso

1. **Crear campo** → ingresa nombre, club, hoyos, par y HCP de cada hoyo
2. **Nueva partida** → selecciona campo, modalidad, jugadores y sus handicaps
3. **Ingresar scores** → toca cada celda en la tarjeta
4. **Ver resultados** → pestaña "Resultados" con cálculos automáticos

## Estructura del proyecto

```
src/
  app/
    page.tsx              # Home — lista de partidas
    course/
      page.tsx            # Lista de campos
      new/page.tsx        # Crear campo
      [id]/page.tsx       # Detalle y edición de campo
    round/
      new/page.tsx        # Setup de nueva partida
      [id]/page.tsx       # Tarjeta de juego + resultados
  lib/
    supabase.ts           # Cliente Supabase + tipos
    golf.ts               # Motor de cálculo (todos los modos)
```
