#!/usr/bin/env bash
# ==============================================================================
# SPARROWX MULTI-DATABASE BLUEPRINT INITIALIZER
# Provisions separate isolated databases for every SparrowX microservice while
# keeping `sparrowbase` as the unified Auth & Identity Hub.
# ==============================================================================
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE sparrowx_db_studio' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sparrowx_db_studio')\gexec
  SELECT 'CREATE DATABASE sparrowx_shield' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sparrowx_shield')\gexec
  SELECT 'CREATE DATABASE sparrowx_files' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sparrowx_files')\gexec
  SELECT 'CREATE DATABASE sparrowx_api' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sparrowx_api')\gexec
EOSQL

for db in sparrowx_db_studio sparrowx_shield sparrowx_files sparrowx_api; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "vector";
    DO \$\$
    BEGIN
      IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
        GRANT USAGE ON SCHEMA public TO web_anon;
      END IF;
      IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        GRANT USAGE ON SCHEMA public TO anon;
      END IF;
    END
    \$\$;
EOSQL
done
