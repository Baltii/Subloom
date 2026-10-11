# CSV import and export

Settings → CSV import & export supports choosing a file or pasting CSV, downloading an example, previewing every new subscription and confirming import. All rows must validate before import; errors identify the CSV record. Up to 500 records / 2 MB. UTF-8 BOM, quoted commas/newlines, CRLF and doubled quotes are supported. Duplicate headers, unsupported columns, malformed quotes, invalid dates and invalid monetary amounts fail validation. Matching subscription fingerprints are skipped, including duplicate rows in one file. IDs and ownership are generated locally, never imported.

Import commits one local transaction with activity and normal account outbox operations. Account changes invalidate the preview. It never overwrites existing subscriptions. Subsequent cloud sync uses the existing idempotent operation contract; a cloud sync failure leaves the local records and pending outbox intact.

Export includes the displayed personal subscription records and does not include authentication tokens, user IDs or receipt evidence. Spreadsheet formula prefixes are escaped and decoded on reimport. Preview names/dates before confirming. File download on web; share sheet on iOS/Android. Empty exports contain headers only.

No new credentials/migration. Stacked after savings simulator. `npm run check` covers CSV syntax, monetary precision, formula safety, validation, deduplication and atomic store import.
