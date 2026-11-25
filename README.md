# Tempero

Web para ordenador para gestionar explotaciones agrícolas sobre el mapa: parcelas SIGPAC, lluvia y riego, plan de abonado, cuaderno de campo y terreno en 3D.

Un producto de GarzaDigital.

## Fase 1 (esta versión)

- **Portada** (`/`).
- **Mapa** (`/app/mapa`): ortofoto PNOA del IGN y recintos SIGPAC (teselas vectoriales del FEGA). Clic en un recinto → se añade con su código, superficie, uso, pendiente y altitud. También se pueden dibujar parcelas. Búsqueda de municipios (OpenStreetMap Nominatim).
- **Lluvia y riego** (`/app/riego`): balance hídrico diario por parcela (FAO-56 simplificado, Kc mensual) con lluvia y ETo de Open-Meteo. Propone fecha, lámina, volumen y horas según el sistema de riego. «Marcar como regado» lo anota en el cuaderno.
- **Plan de abonado** (`/app/abonado`): balance de N (necesidades − suelo − agua − cultivo anterior − orgánicos) y reposición de P y K según análisis. Reparto en fondo y coberteras. Exporta a PDF (vista de impresión) y pasa las aplicaciones al cuaderno como pendientes.
- **Cuaderno de campo** (`/app/cuaderno`): tratamientos, fertilización, riegos, labores y cosechas. Copiar la última anotación, duplicar, avisos de datos obligatorios. Exporta a Excel (una hoja por sección) y PDF. Es un cuaderno de apoyo: el oficial es el CUE de cada comunidad.
- **Terreno 3D** (`/app/terreno`): relieve con la ortofoto encima (Terrain Tiles de AWS).
- **Ajustes** (`/app/ajustes`): datos de la explotación, copia de seguridad (JSON) y restauración.

Los datos se guardan en el navegador (`localStorage`). No hay cuentas ni servidor todavía.

## Próximas fases

- **Fase 2:** curvas de nivel, animación del agua sobre el terreno, zonas de encharcamiento, importación de planos de AutoCAD (DXF / LandXML), relieve LiDAR del IGN.
- **Fase 3:** cuentas de usuario y base de datos, datos de AEMET y estaciones SiAR, exportación más cercana al CUE oficial.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # comprobación de producción
```

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · MapLibre GL · Zustand · Turf · write-excel-file.

## Despliegue en Vercel

Importar el repositorio en Vercel (framework Next.js, sin variables de entorno). No necesita configuración adicional.

## Fuentes de datos

- Ortofoto PNOA y mapa base: © Instituto Geográfico Nacional.
- Recintos SIGPAC: © FEGA, CC BY 4.0 (`sigpac-hubcloud.es/mvt`).
- Lluvia y ETo: Open-Meteo. Ojo: el plan gratuito de Open-Meteo es para uso no comercial; para un uso comercial hay que contratar su API o cambiar a AEMET/SiAR.
- Relieve: Terrain Tiles (AWS Open Data / Mapzen).
- Coeficientes de cultivo, suelos y extracciones: valores orientativos editables en cada parcela.
