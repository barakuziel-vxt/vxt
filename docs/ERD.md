# VXT Database Entity Relationship Diagram

```mermaid
erDiagram
    ENTITY_CATEGORY ||--o{ ENTITY_TYPE : "contains"
    ENTITY_TYPE ||--o{ ENTITY : "has"
    ENTITY_TYPE ||--o{ ENTITY_TYPE_ATTRIBUTE : "has"
    ENTITY_TYPE ||--o{ EVENT : "triggers"
    ENTITY ||--o{ CUSTOMER_SUBSCRIPTIONS : "subscribes"
    CUSTOMER ||--o{ CUSTOMER_SUBSCRIPTIONS : "has"
    EVENT ||--o{ EVENT_CRITERIA : "defines"
    ENTITY_TYPE_ATTRIBUTE ||--o{ EVENT_CRITERIA : "used_in"
    ENTITY_TYPE_ATTRIBUTE ||--o{ ENTITY_TYPE_CRITERIA : "evaluated_by"
    ENTITY_TYPE_CRITERIA ||--o{ EVENT_CRITERIA : "scores"
    ENTITY ||--o{ ENTITY_TELEMETRY : "records"
    ENTITY_TYPE_ATTRIBUTE ||--o{ ENTITY_TELEMETRY : "measures"
    BOAT_TELEMETRY ||--o{ ENTITY : "from_entity"
    HEALTH_VITALS ||--o{ ENTITY : "from_entity"
    PROVIDER ||--o{ PROVIDER_EVENT : "publishes"
    PROVIDER_EVENT ||--o{ ENTITY_TYPE_ATTRIBUTE : "maps_to"
    PROTOCOL ||--o{ PROTOCOL_ATTRIBUTE : "contains"
    PROTOCOL_ATTRIBUTE ||--o{ PROTOCOL_ATTRIBUTE_MAPPING : "defines"
    PROTOCOL_ATTRIBUTE_MAPPING ||--o{ ENTITY_TYPE_ATTRIBUTE : "maps_to"

    ENTITY_CATEGORY {
        int entityCategoryId PK
        string entityCategoryName
        char active
    }
    ENTITY_TYPE {
        int entityTypeId PK
        string entityTypeName
        int entityCategoryId FK
        char active
    }
    ENTITY_TYPE_ATTRIBUTE {
        int entityTypeAttributeId PK
        int entityTypeId FK
        string entityTypeAttributeCode
        string entityTypeAttributeName
        string entityTypeAttributeTimeAspect
        string entityTypeAttributeUnit
        int providerId FK
        char active
    }
    ENTITY {
        string entityId PK
        string entityFirstName
        string entityLastName
        int entityTypeId FK
        char gender
        date birthDate
        char active
    }
    EVENT {
        int eventId PK
        string eventCode
        string eventDescription
        int entityTypeId FK
        int minCumulatedScore
        int maxCumulatedScore
        string risk
        char active
    }
    EVENT_CRITERIA {
        int eventId PK_FK
        int entityTypeId FK
        int entityTypeAttributeId PK_FK
        char active
    }
    ENTITY_TYPE_CRITERIA {
        int entityTypeCriteriaId PK
        int entityTypeId FK
        int entityTypeAttributeId FK
        string strValue
        float minValue
        float maxValue
        int score
        char active
    }
    CUSTOMER {
        int customerId PK
        string customerName
        string primaryContactName
        string primaryContactEmail
        string primaryContactPhone
        string billingAddress1
        string billingCity
        char active
    }
    CUSTOMER_SUBSCRIPTIONS {
        int customerSubscriptionId PK
        int customerId FK
        string entityId FK
        string eventId FK
        datetime subscriptionStartDate
        datetime subscriptionEndDate
        char active
    }
    ENTITY_TELEMETRY {
        bigint entityTelemetryId PK
        string entityId FK
        int entityTypeAttributeId FK
        datetime startTimestampUTC
        datetime endTimestampUTC
        datetime ingestionTimestampUTC
        string providerDevice
        float numericValue
        float latitude
        float longitude
        string stringValue
    }
    BOAT_TELEMETRY {
        bigint eventId PK
        string boatId FK
        datetime timestamp
        string rawJson
        float engineRPM
        float coolantTempC
        float oilPressurePascal
        float batteryVoltage
        float depth
        float sog
        float latitude
        float longitude
    }
    HEALTH_VITALS {
        bigint healthVitalsId PK
        string userId FK
        datetime timestamp
        datetime startTime
        datetime endTime
        float avgHR
        float maxHR
        float minHR
        float restingHR
        float hrv_RMSSD
        float systolic
        float diastolic
        float oxygenSat
        float avgGlucose
        float breathsPerMin
        float bodyTemp
        string ecgClassification
        string afibResult
        string deviceName
    }
    PROVIDER {
        int providerId PK
        string providerName
        string providerDescription
        string providerCategory
        string apiBaseUrl
        string apiVersion
        char active
    }
    PROVIDER_EVENT {
        int providerEventId PK
        int providerId FK
        string providerEventType
        string providerEventDescription
        string providerNamespace
        string providerEventName
        string payloadSchema
        string requiredFields
        string loincCode
        char active
    }
    PROTOCOL {
        int protocolId PK
        string protocolName
        string protocolVersion
        string kafkaTopic
        int entityTypeId FK
        char active
    }
    PROTOCOL_ATTRIBUTE {
        int protocolAttributeId PK
        int protocolId FK
        string protocolAttributeCode
        string protocolAttributeName
        string unit
        string dataType
        string jsonPath
        decimal rangeMin
        decimal rangeMax
        char active
    }
    PROTOCOL_ATTRIBUTE_MAPPING {
        int protocolAttributeMappingId PK
        int protocolAttributeId FK
        string entityTypeAttributeCode FK
        string transformationRule
        string transformationLanguage
        int priority
        char active
    }
```

## Key Data Flows

### 1. Entity Management
- **EntityCategory** (Yacht, Person, Stock, Vehicle) → **EntityType** → **Entity**
- Each entity has a type that belongs to a category

### 2. Attribute Definition & Telemetry
- **EntityTypeAttribute** defines what attributes each entity type can measure
- **EntityTelemetry** stores actual telemetry values linked to entities and their attributes
- **BoatTelemetry** and **HealthVitals** are specialized telemetry tables

### 3. Event Scoring & Alerts
- **Event** defines alert types (e.g., "NEWSTemperatureLow")
- **EventCriteria** maps events to entity type attributes
- **EntityTypeCriteria** provides scoring rules (min/max values, point scores)
- System calculates cumulative scores to trigger events

### 4. Provider Integration
- **Provider** (Junction, Terra, Garmin, etc.) publishes events
- **ProviderEvent** documents event types from each provider
- **ProviderEvent** maps to **EntityTypeAttribute** for data normalization

### 5. Protocol Mapping
- **Protocol** (LOINC, SignalK, Junction, Terra) standardizes data formats
- **ProtocolAttribute** defines fields from each protocol
- **ProtocolAttributeMapping** transforms protocol data to EntityTypeAttribute

### 6. Customer Access Control
- **Customer** subscriptions to specific entities and events
- **CustomerSubscriptions** controls visibility: which customer can see which entity's data
- Subscription dates restrict access window

## Relationships Summary
- **19 Tables** across 6 functional domains
- **Primary Keys**: Mix of IDENTITY, NVARCHAR, BIGINT
- **Foreign Keys**: Multi-table constraints for referential integrity
- **Triggers**: Auto-update lastUpdateTimestamp and lastUpdateUser
