# SQL Archive

Historical one-off migrations and fix scripts that were previously scattered
in the repository root. They have already been applied (or superseded) on the
live database and are kept only for reference.

**Do not run these against a live database.** Several are destructive
(`drop_script.sql`, `migration_wipe_old_data.sql`, `recovery.sql`).

- The canonical schema lives in `/supabase_schema.sql`.
- New migrations belong in `/supabase/migrations/` with timestamped filenames
  (`YYYYMMDDHHMMSS_description.sql`) so the Supabase CLI can track them.
