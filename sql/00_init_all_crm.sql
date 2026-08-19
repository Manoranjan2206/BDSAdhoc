-- ============================================================================
-- 00_init_all_crm.sql: Automated PostgreSQL Multi-Tenant Database Initialization
-- Automatically executed on container creation by PostgreSQL docker-entrypoint
-- ============================================================================

-- 1. Create All 4 Enterprise Multitenant Databases
SELECT 'CREATE DATABASE crm_alphacorp' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_alphacorp')\gexec
SELECT 'CREATE DATABASE crm_betasolutions' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_betasolutions')\gexec
SELECT 'CREATE DATABASE crm_gammaindustries' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_gammaindustries')\gexec
SELECT 'CREATE DATABASE crm_deltaenterprises' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'crm_deltaenterprises')\gexec

-- 2. Initialize crm_alphacorp Database
\c crm_alphacorp
\i /docker-entrypoint-initdb.d/crm_schema.sql
\i /docker-entrypoint-initdb.d/crm_alphacorp_seed.sql

-- 3. Initialize crm_betasolutions Database
\c crm_betasolutions
\i /docker-entrypoint-initdb.d/crm_schema.sql
\i /docker-entrypoint-initdb.d/crm_betasolutions_seed.sql

-- 4. Initialize crm_gammaindustries Database
\c crm_gammaindustries
\i /docker-entrypoint-initdb.d/crm_schema.sql
\i /docker-entrypoint-initdb.d/crm_gammaindustries_seed.sql

-- 5. Initialize crm_deltaenterprises Database
\c crm_deltaenterprises
\i /docker-entrypoint-initdb.d/crm_schema.sql
\i /docker-entrypoint-initdb.d/crm_deltaenterprises_seed.sql
