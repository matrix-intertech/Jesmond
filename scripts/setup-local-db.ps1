# Local Database Setup Script for Jesmond
# This script guides the developer through setting up the local PostgreSQL database securely.

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Jesmond Local Database Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "This script will connect to your local native PostgreSQL 18 instance."
Write-Host "It will create the 'jesmond' database and a dedicated 'jesmond_app' user."
Write-Host "You must provide your local 'postgres' administrator password when prompted by psql."
Write-Host ""

# Ensure psql is in PATH (assuming default PG18 location)
$psqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psqlPath)) {
    $psqlPath = "psql" # Fallback to PATH
}

# 1. Ask the developer for the desired application password (NOT the postgres superuser password)
$AppPassword = Read-Host "Enter a new secure password for the 'jesmond_app' user (will be used in .env)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($AppPassword)
$PlainAppPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 2. Construct the SQL commands safely
$sql = @"
-- 1. Create the database
SELECT 'CREATE DATABASE jesmond' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'jesmond')\gexec

-- 2. Create the application user
DO \`$\$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles WHERE rolname = 'jesmond_app'
  ) THEN
    CREATE ROLE jesmond_app WITH LOGIN PASSWORD '$PlainAppPassword';
  END IF;
END
\`$\$;

-- 3. Grant privileges
GRANT CONNECT ON DATABASE jesmond TO jesmond_app;
GRANT USAGE, CREATE ON SCHEMA public TO jesmond_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO jesmond_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO jesmond_app;
"@

# 3. Execute via psql. The developer will be prompted for their postgres admin password interactively.
Write-Host "`nConnecting to PostgreSQL on localhost:5432..." -ForegroundColor Yellow
Write-Host "Please enter your PostgreSQL administrator password if prompted:`n" -ForegroundColor Yellow

$sql | & $psqlPath -U postgres -d postgres -f -

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=============================================" -ForegroundColor Green
    Write-Host "SUCCESS: Database and User created!" -ForegroundColor Green
    Write-Host "Please update your .env file with the following connection string:" -ForegroundColor Cyan
    Write-Host "DATABASE_URL=`"postgresql://jesmond_app:<THE_PASSWORD_YOU_CHOSE>@localhost:5432/jesmond?schema=public`""
    Write-Host "=============================================`n" -ForegroundColor Green
    Write-Host "Next Steps:"
    Write-Host "1. pnpm db:validate"
    Write-Host "2. pnpm db:generate"
    Write-Host "3. pnpm db:push (or migrate)"
    Write-Host "4. pnpm db:seed"
} else {
    Write-Host "`nERROR: Database setup failed. Please check the output above." -ForegroundColor Red
}
