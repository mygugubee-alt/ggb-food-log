# GGB Food Log

A personal food, weight and blood sugar log. It is a web app that you add to your phone's home screen.
All data stays in the browser on the device. The full specification is in `../spec.md`.

## Run it (Docker only)

Docker runs through Colima on this Mac. If Docker is not running (for example after a restart):

```bash
colima start
```

Development server with live reload, at http://localhost:5173:

```bash
docker-compose up -d dev
```

Unit tests:

```bash
docker-compose run --rm test
```

The finished app (runs the tests, builds, and serves with nginx), at http://localhost:8080:

```bash
docker-compose --profile prod up -d --build web
```

Stop everything:

```bash
docker-compose --profile prod down
```

## Getting it onto a phone

A phone needs the app served over HTTPS (the camera, offline mode and "Add to Home Screen" all require it).
`localhost` on the Mac is not reachable from the phone as HTTPS. Publish the built files (the `dist` folder,
or the `web` image) to a static host such as GitHub Pages, open that address on the phone, and add it to the
home screen. See section 15 of the spec for the hosting decision.

## Layout

- `src/db` – database schema and all data operations
- `src/services` – report calculations, calorie rule, photo resizing, export and import
- `src/utils` – Malaysia dates, unit conversion and rounding
- `src/screens`, `src/components` – the user interface
- `src/strings/en.ts` – all UI text
- `tests` – unit tests (74)
