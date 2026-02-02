# Boat Telemetry Database

## Overview
The Boat Telemetry Database project is designed to store and manage telemetry data from boats. It includes tables for storing telemetry information and properties associated with various entities.

## Files

- **sql/Create_BoatTelemetry_table.sql**: This script creates the `BoatTelemetry` table, which includes columns for `EventId`, `BoatId`, `Timestamp`, and several computed columns that extract data from JSON formatted telemetry data.

- **sql/Create_Properties_table.sql**: This script creates the `PROPERTIES` table with the following columns:
  - `property_key` as `VARCHAR(50)` (Primary Key)
  - `entity_id` as `INTEGER`
  - `property_name` as `VARCHAR(100)`

- **.gitignore**: This file specifies files and directories that should be ignored by Git, such as temporary files and logs.

- **schema.sql**: This file defines the overall database schema, including the creation of multiple tables and the relationships between them.

## Setup Instructions
1. Ensure you have a compatible SQL database server installed.
2. Run the SQL scripts located in the `sql` directory to create the necessary tables.
3. Use the `schema.sql` file to set up the overall database structure.

## Usage
After setting up the database, you can start inserting telemetry data into the `BoatTelemetry` table and manage properties using the `PROPERTIES` table. 

## Contributing
Contributions to improve the project are welcome. Please submit a pull request or open an issue for discussion.