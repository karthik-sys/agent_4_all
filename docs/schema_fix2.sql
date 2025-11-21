-- Make protocol nullable
ALTER TABLE transactions ALTER COLUMN protocol DROP NOT NULL;
