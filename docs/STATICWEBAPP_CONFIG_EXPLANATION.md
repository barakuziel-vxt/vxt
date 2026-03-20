# Static Web Apps Configuration File

**File Location:** `c:\VXT\admin-dashboard\dist\staticwebapp.config.json`

Create this file and include it in your `dist/` folder uploads.

---

## Complete Configuration

```json
{
  "routes": [
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/*.{css,svg,ico,png,jpg,gif}"]
  },
  "mimeTypes": {
    ".json": "text/json",
    ".wasm": "application/wasm"
  },
  "auth": {
    "identityProviders": {}
  },
  "globalHeaders": {
    "content-security-policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  }
}
```

---

## What Each Section Does

### `routes`
**Purpose:** Define how requests are routed

```json
"routes": [
  {
    "route": "/*",           // Match ALL paths
    "serve": "/index.html",  // Serve React's entry point
    "statusCode": 200        // This is success, not 404
  }
]
```

**Why?** React Router handles all routing client-side. Without this, `/about`, `/entities`, etc. would return 404.

### `navigationFallback`
**Purpose:** Specify which files should NOT use the fallback

```json
"navigationFallback": {
  "rewrite": "/index.html",           // Default fallback file
  "exclude": [
    "/assets/*",                       // Don't rewrite asset requests
    "/*.{css,svg,ico,png,jpg,gif}"    // Don't rewrite static files
  ]
}
```

**Why?** CSS, images, and JS assets need to load directly. Only actual page routes fallback to index.html.

### `mimeTypes`
**Purpose:** Ensure correct content-type headers

```json
"mimeTypes": {
  ".json": "text/json",
  ".wasm": "application/wasm"
}
```

**Why?** Some file types may be misidentified. This ensures correct MIME types.

### `globalHeaders`
**Purpose:** Set security headers for all responses

```json
"globalHeaders": {
  "content-security-policy": "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'"
}
```

**Why?** Allows Vite's dev scripts and inline styles. Adjust for production if needed.

---

## Quick Implementation

### Step 1: Create File

```powershell
# In admin-dashboard directory
cd c:\VXT\admin-dashboard
```

### Step 2: Add to dist/ Folder

Create file in `dist/staticwebapp.config.json` with the complete configuration above.

### Step 3: Include in Upload

When uploading to Static Web Apps, ensure you're uploading:

```
dist/
├── index.html
├── staticwebapp.config.json     ← IMPORTANT: Include this
├── favicon.svg
└── assets/
    ├── main-xyz.js
    ├── style-abc.css
    └── ...
```

### Step 4: Verify Upload

After uploading, test these URLs (all should work):

```
https://vxt-admin-dashboard.azurewebsites.net/
https://vxt-admin-dashboard.azurewebsites.net/dashboard
https://vxt-admin-dashboard.azurewebsites.net/entities
https://vxt-admin-dashboard.azurewebsites.net/about
```

If any return 404 → config file is missing or incorrect.

---

## Troubleshooting

### Symptom: 404 on `/entities` route

**Cause:** SPA routing not configured

**Fix:**
1. Verify `staticwebapp.config.json` exists in `dist/`
2. Check JSON syntax (use JSON validator)
3. Re-upload entire `dist/` folder
4. Hard refresh browser (Ctrl+Shift+R)

### Symptom: All files return 404 except root

**Cause:** Too aggressive route matching

**Fix:**
```json
"exclude": [
  "/assets/*",
  "/*.{css,svg,ico,png,jpg,gif,woff,woff2,ttf,eot}"
]
```

Add more file extensions if needed.

### Symptom: CSS/JS not loading (blank page)

**Cause:** Asset paths incorrect in Vite config

**Fix:**
Ensure `vite.config.ts` has:
```typescript
export default defineConfig({
  base: '/',  // Root path
  // ... other config
})
```

---

## Testing Configuration

### Via Browser Console

```javascript
// Should return 200
fetch('/entities').then(r => console.log(r.status))

// Should return 200 (served from index.html)
fetch('/nonexistent-route').then(r => console.log(r.status))

// Should return 200 (CSS served directly)
fetch('/assets/main-xyz.css').then(r => console.log(r.status))
```

All should show 200 OK.

---

## Production Recommendations

For production deployment, consider:

1. **Stricter CSP (Security):**
   ```json
   "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
   ```

2. **Custom Error Pages:**
   ```json
   "routes": [
     {
       "route": "/404",
       "serve": "/404.html",
       "statusCode": 404
    }
   ]
   ```

3. **Cache Headers:**
   ```json
   "routes": [
     {
       "route": "/assets/*",
       "headers": {
         "cache-control": "public, max-age=31536000, immutable"
       }
     }
   ]
   ```

---

**That's it! Copy the JSON above and you're ready to deploy.**
