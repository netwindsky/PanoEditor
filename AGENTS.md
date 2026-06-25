# PanoEditor Knowledge Base

**Path:** `PanoEditor/`
**Purpose:** Panorama scene editor frontend

## OVERVIEW

Vue 3 + TypeScript editor for building and modifying panoramic scenes. Consumes the shared PanoViewV2 engine via `@panoview` alias for rendering and hotspot editing.

## STRUCTURE

```
PanoEditor/
├── src/
│   ├── api/           # Axios HTTP client (exports configured instance)
│   ├── components/    # Vue components (18 files)
│   ├── composables/   # Reusable composition functions
│   ├── router/        # Vue Router + auth guards
│   ├── stores/        # Pinia stores
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── views/         # Route-level pages
└── vite.config.ts     # Dev server port 5002, proxies /api and /uploads
```

## CONVENTIONS

- **Cross-app imports:** Uses `@panoview/*` to import PanoViewV2 engine modules
- **Element Plus:** UI component library
- **Axios:** HTTP client with configured baseURL

## WHERE TO LOOK

| Task | Location |
|------|----------|
| HTTP client setup | `src/api/index.ts` |
| Route definitions | `src/router/index.ts` |
| Auth guards | `src/router/index.ts` |
| Editor UI components | `src/components/` |

## ANTI-PATTERNS

- **Never import from `../PanoViewV2/src/...` directly:** Always use `@panoview/*`
- **Do not add obfuscation:** PanoEditor has no build obfuscation; rely on PanoViewV2's if needed
