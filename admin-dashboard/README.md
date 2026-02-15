# VXT Admin Dashboard

A comprehensive React-based administration dashboard for managing VXT database configurations including entity categories, entity types, and entity type attributes with protocol mappings and scoring criteria.

## Features

### 📁 Entity Categories Management
- View, create, update, and delete entity categories
- Categories: Yacht, Person, Stock, Vehicle
- Active/Inactive status management

### 🏷️ Entity Types Management
- Manage entity types within categories
- Examples: Person, Lagoon 380, Elan Impression 40
- Link entity types to their parent categories
- Status tracking

### ⚙️ Entity Type Attributes Management
- Create and manage attributes for each entity type
- **Protocol Integration**: Link attributes to protocols (LOINC, SignalK, etc.)
- **Protocol Attribute Mapping**: Select specific protocol attributes when defining entity type attributes
- **Dynamic Scoring Criteria**: Define multiple criteria based on:
  - Min/Max value ranges
  - String values
  - Point scores for event triggering

## Architecture

### Project Structure
```
admin-dashboard/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── index.jsx
│   ├── index.css
│   ├── App.jsx
│   ├── App.css
│   ├── services/
│   │   └── api.js          # API service layer
│   └── pages/
│       ├── EntityCategoryPage.jsx
│       ├── EntityTypePage.jsx
│       └── EntityTypeAttributePage.jsx
```

### Technology Stack
- **React 18.2**: UI framework
- **Vite**: Build tool and dev server
- **Axios**: HTTP client for API calls
- **CSS3**: Styling (no external UI library)

## Setup & Installation

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation Steps

1. **Navigate to project directory**:
   ```bash
   cd admin-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure API endpoint** (in `vite.config.js`):
   ```javascript
   proxy: {
     '/api': {
       target: 'http://localhost:5000',  // Change to your API server
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/api/, '')
     }
   }
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Open in browser**:
   ```
   http://localhost:3001
   ```

## API Endpoints Required

The dashboard expects the following API endpoints on your backend:

### Entity Categories
- `GET /api/entitycategories` - List all categories
- `GET /api/entitycategories/{id}` - Get single category
- `POST /api/entitycategories` - Create category
- `PUT /api/entitycategories/{id}` - Update category
- `DELETE /api/entitycategories/{id}` - Delete category

### Entity Types
- `GET /api/entitytypes` - List all entity types
- `GET /api/entitytypes/{id}` - Get single entity type
- `POST /api/entitytypes` - Create entity type
- `PUT /api/entitytypes/{id}` - Update entity type
- `DELETE /api/entitytypes/{id}` - Delete entity type

### Entity Type Attributes
- `GET /api/entitytypeattributes` - List all attributes
- `GET /api/entitytypeattributes/{id}` - Get single attribute
- `POST /api/entitytypeattributes` - Create attribute
- `PUT /api/entitytypeattributes/{id}` - Update attribute
- `DELETE /api/entitytypeattributes/{id}` - Delete attribute

### Protocols
- `GET /api/protocols` - List all protocols

### Protocol Attributes
- `GET /api/protocolattributes` - List all protocol attributes
- `GET /api/protocolattributes?protocolId={id}` - Get attributes for protocol

### Entity Type Criteria
- `GET /api/entitytypecriteria` - List all criteria
- `GET /api/entitytypecriteria?attributeId={id}` - Get criteria for attribute
- `POST /api/entitytypecriteria` - Create criterion
- `PUT /api/entitytypecriteria/{id}` - Update criterion
- `DELETE /api/entitytypecriteria/{id}` - Delete criterion

## Usage

### Entity Categories Page
1. Click "Entity Categories" in sidebar
2. View list of all categories
3. Click "+ Add New Category" to create
4. Click "Edit" to modify or "Delete" to remove

### Entity Types Page
1. Click "Entity Types" in sidebar
2. Select a category from dropdown when creating/editing
3. Manage entity type names and status
4. Entity types are grouped by category

### Entity Type Attributes Page
**This is the most powerful feature** with full protocol integration:

1. Click "Entity Type Attributes" in sidebar
2. Create new attribute:
   - Select Entity Type (required)
   - Select Protocol (optional, e.g., LOINC, SignalK)
   - **If protocol selected**: Choose from available protocol attributes
   - Enter Attribute Name
   - Select Time Aspect (Point, Mean, Max, Min)
   - Enter Unit
3. Click "Criteria" button on any attribute to define scoring rules:
   - Set Min/Max value ranges
   - Optionally set string values
   - Assign point scores
   - Multiple criteria can be created per attribute

## Data Model

### Entity Category
```
{
  entityCategoryId: int,
  entityCategoryName: varchar,
  active: char ('Y'/'N'),
  createDate: datetime,
  lastUpdateTimestamp: datetime,
  lastUpdateUser: varchar
}
```

### Entity Type
```
{
  entityTypeId: int,
  entityTypeName: varchar,
  entityCategoryId: int (FK),
  active: char ('Y'/'N'),
  createDate: datetime,
  lastUpdateTimestamp: datetime,
  lastUpdateUser: varchar
}
```

### Entity Type Attribute
```
{
  entityTypeAttributeId: int,
  entityTypeId: int (FK),
  protocolId: int (FK, optional),
  entityTypeAttributeCode: varchar,
  entityTypeAttributeName: varchar,
  entityTypeAttributeTimeAspect: varchar,
  entityTypeAttributeUnit: varchar,
  active: char ('Y'/'N'),
  createDate: datetime,
  lastUpdateTimestamp: datetime,
  lastUpdateUser: varchar
}
```

### Entity Type Criteria
```
{
  entityTypeCriteriaId: int,
  entityTypeId: int (FK),
  entityTypeAttributeId: int (FK),
  minValue: float,
  maxValue: float,
  strValue: varchar,
  score: int,
  active: char ('Y'/'N'),
  createDate: datetime,
  lastUpdateTimestamp: datetime,
  lastUpdateUser: varchar
}
```

## Building for Production

```bash
npm run build
```

This generates optimized files in the `dist/` directory.

## Features & Capabilities

✅ **Full CRUD Operations**: Create, read, update, delete for all entities
✅ **Responsive Design**: Works on desktop and tablet
✅ **Error Handling**: User-friendly error messages
✅ **Protocol Integration**: Seamless mapping between protocols and attributes
✅ **Dynamic Criteria**: Flexible scoring system for events
✅ **Real-time Updates**: Changes reflect immediately
✅ **Batch Operations**: Manage multiple criteria per attribute
✅ **Status Tracking**: Active/Inactive management for all entities
✅ **Audit Trail**: Create date and last update timestamps

## Quick Links

- **Boat Dashboard**: http://localhost:3000
- **Health Dashboard**: http://localhost:3002
- **Admin Dashboard**: http://localhost:3001

## Support

For issues or questions, refer to the VXT documentation or the main project README.
