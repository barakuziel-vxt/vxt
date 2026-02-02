-- Safe DROP script for dbo.CustomerProperties
-- Backs up the table, drops FKs that reference it, then drops the table.
-- Run in the database where dbo.CustomerProperties exists (e.g., USE BoatTelemetryDB;)

SET NOCOUNT ON;

BEGIN TRAN;

IF OBJECT_ID('dbo.CustomerProperties','U') IS NULL
BEGIN
    PRINT 'Table dbo.CustomerProperties does not exist; nothing to do.';
    ROLLBACK TRAN;
    RETURN;
END

-- 1) Show FK dependencies (inspect before committing)
PRINT 'Foreign keys referencing dbo.CustomerProperties:';
SELECT fk.name AS ForeignKeyName, 
       OBJECT_SCHEMA_NAME(fk.parent_object_id) + '.' + OBJECT_NAME(fk.parent_object_id) AS ReferencingTable
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('dbo.CustomerProperties');

-- 2) Create a backup table with a date suffix
DECLARE @bkname SYSNAME = 'CustomerProperties_backup_' + CONVERT(VARCHAR(8), GETDATE(), 112);
DECLARE @sql NVARCHAR(MAX) = 'SELECT * INTO dbo.' + QUOTENAME(@bkname) + ' FROM dbo.CustomerProperties;';
EXEC sp_executesql @sql;
PRINT 'Backup created: ' + @bkname;

-- 3) Drop foreign keys that reference CustomerProperties
DECLARE @fkname SYSNAME, @parent NVARCHAR(256), @dropsql NVARCHAR(MAX);
DECLARE fk_cursor CURSOR FOR
  SELECT fk.name, OBJECT_SCHEMA_NAME(fk.parent_object_id) + '.' + OBJECT_NAME(fk.parent_object_id)
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID('dbo.CustomerProperties');

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @fkname, @parent;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @dropsql = 'ALTER TABLE ' + @parent + ' DROP CONSTRAINT ' + QUOTENAME(@fkname) + ';';
  PRINT 'Dropping FK: ' + @fkname + ' on ' + @parent;
  EXEC sp_executesql @dropsql;
  FETCH NEXT FROM fk_cursor INTO @fkname, @parent;
END
CLOSE fk_cursor;
DEALLOCATE fk_cursor;

-- 4) Drop triggers or other dependent objects on the table
IF OBJECT_ID('TRG_CustomerProperties_UpdateTimestamp','TR') IS NOT NULL
BEGIN
  PRINT 'Dropping trigger TRG_CustomerProperties_UpdateTimestamp';
  DROP TRIGGER TRG_CustomerProperties_UpdateTimestamp;
END

-- 5) Optionally rename first for safety
-- EXEC sp_rename 'dbo.CustomerProperties','CustomerProperties_before_drop';

-- 6) Drop the table
DROP TABLE dbo.CustomerProperties;
PRINT 'Dropped table dbo.CustomerProperties';

COMMIT TRAN;

-- 7) Post-drop verification
SELECT OBJECT_ID('dbo.CustomerProperties','U') AS PostDrop_ObjectId; -- should be NULL
SELECT name FROM sys.tables WHERE name LIKE 'CustomerProperties_backup%';   -- check backups

PRINT 'Done.';
