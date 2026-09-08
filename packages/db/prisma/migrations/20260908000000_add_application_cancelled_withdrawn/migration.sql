-- Add missing application lifecycle statuses to production PostgreSQL enum.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
