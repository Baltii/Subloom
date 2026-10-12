# Searchable service catalog

The add-subscription form now offers 66 services with search by name, category and common aliases. Category filters and progressive results keep the picker compact, and the custom-service action explicitly clears the selected service ID and lets the user supply any provider.

Added services have real locally bundled SVG logos from Simple Icons 16.35.0. Only curated path data is rendered using the existing SVG library; no remote logo calls, external search requests or new runtime dependencies. Existing IDs remain stable. Unknown services retain an initial/icon fallback. No suggested prices or unverified account management URLs are added.

Asset provenance, upstream disclaimer and license are tracked under `vendor/service-logos/`. Package source: https://github.com/simple-icons/simple-icons. Search input is bounded to 80 characters; displayed results grow in batches. No migration, credentials or deployment required. Stacked after dashboard insights.
