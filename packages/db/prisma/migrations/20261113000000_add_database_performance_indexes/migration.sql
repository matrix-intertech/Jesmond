-- 1. Drop redundant standalone index on SavedProperty (covered by composite unique SavedProperty_studentId_propertyId_key)
DROP INDEX IF EXISTS "SavedProperty_studentId_idx";

-- 2. Drop redundant standalone index on FoodOrder (covered by composite FoodOrder_organizationId_createdAt_idx leading column)
DROP INDEX IF EXISTS "FoodOrder_organizationId_idx";

-- 3. Create SavedProperty propertyId index for save count lookups and Property deletion cascade checks
CREATE INDEX IF NOT EXISTS "SavedProperty_propertyId_idx" ON "SavedProperty"("propertyId");

-- 4. Create AuditLog createdAt DESC index for high-growth feed ordering
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- 5. Create Property status + createdAt DESC composite index for public discovery search
CREATE INDEX IF NOT EXISTS "Property_status_createdAt_idx" ON "Property"("status", "createdAt" DESC);

-- 6. Create FoodOrder organizationId + createdAt DESC composite index for merchant order management
CREATE INDEX IF NOT EXISTS "FoodOrder_organizationId_createdAt_idx" ON "FoodOrder"("organizationId", "createdAt" DESC);

-- 7. Create Notification recipientId + createdAt DESC composite index for user notification feed
CREATE INDEX IF NOT EXISTS "Notification_recipientId_createdAt_idx" ON "Notification"("recipientId", "createdAt" DESC);

-- 8. Create WhatsAppNotificationLog userId index for User deletion cascade (onDelete: SetNull)
CREATE INDEX IF NOT EXISTS "WhatsAppNotificationLog_userId_idx" ON "WhatsAppNotificationLog"("userId");

-- 9. Create EmailNotificationLog userId index for User deletion cascade (onDelete: SetNull)
CREATE INDEX IF NOT EXISTS "EmailNotificationLog_userId_idx" ON "EmailNotificationLog"("userId");

-- 10. Create SalesOrder terminalId index for POS terminal transactions and reconciliation checks
CREATE INDEX IF NOT EXISTS "SalesOrder_terminalId_idx" ON "SalesOrder"("terminalId");
