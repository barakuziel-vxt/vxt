# Step-by-Step: Create App Service Plan (Free F1) + App Service

---

## QUICK OVERVIEW

You'll create 2 things (they work together):
1. **App Service Plan** = The compute container (Free F1 tier = $0)
2. **App Service** = Your actual app that runs inside the plan

**Total time: ~15-20 minutes**

---

## STEP 1: Create App Service Plan

### Step 1.1: Go to Azure Portal

1. Open browser → Go to **https://portal.azure.com**
2. Sign in with your Azure account
3. You should see the home page with a search bar at the top

### Step 1.2: Search for "App Service Plan"

1. Click the **search bar** at the top (magnifying glass icon)
2. Type: **App Service Plan**
3. From results, click **"App Service Plan"** (it may appear in the list)
4. Click the blue **"Create"** button (top-left area)

**You should see a form: "Create App Service Plan"**

### Step 1.3: Fill in the App Service Plan Form

Fill in these fields:

| Field | Value | Notes |
|-------|-------|-------|
| **Subscription** | (select your subscription) | Usually "Free Trial" or your subscription name |
| **Resource Group** | `VXT-IoT-Hub` | SELECT the existing one (don't create new) |
| **Name** | `vxt-app-plan` | Must be unique, only letters/numbers/hyphens |
| **Operating System** | Windows | Select this radio button |
| **Region** | East US (or your region) | Choose same region as SQL Server |
| **Pricing Tier** | (will set in next step) | Don't click yet |

### Step 1.4: Select Free F1 Pricing Tier

1. Under **"Sku and size"** section, click the text that says **"Change size"** or **"Dev/Test"**
2. A pricing panel appears on the right side
3. Look for **"Free tier"** option (should show **F1**)
4. **Click on "Free (F1)"** box
5. Click **"Apply"** button

### Step 1.5: Review and Create

1. Scroll to bottom
2. Click **"Review + create"** button (blue)
3. Azure validates the form (should show green checkmarks)
4. Click **"Create"** button (final step)

⏱️ **Wait 1-2 minutes for deployment**

You should see:
```
Deployment in progress...
(spinner) Your deployment is underway
```

When done, you'll see:
```
Your deployment is complete
```

---

## STEP 2: Create App Service

### Step 2.1: Search for "App Service"

1. Go back to Azure Portal home
2. Click **search bar** at top
3. Type: **App Service**
4. Click **"App Service"** from results
5. Click blue **"Create"** button

**You should see a form: "Create Web App"**

### Step 2.2: Fill in the App Service Form

Fill in these fields:

| Field | Value | Notes |
|-------|-------|-------|
| **Subscription** | (your subscription) | Same as before |
| **Resource Group** | `VXT-IoT-Hub` | SELECT existing (don't create) |
| **Name** | `vxt-admin-app` | **IMPORTANT**: This becomes your URL<br/>(vxt-admin-app.azurewebsites.net)<br/>Must be globally unique, lowercase |
| **Publish** | Code | Select this radio button |
| **Runtime stack** | Python 3.11 | IMPORTANT: Must be Python 3.11 |
| **Operating System** | Windows | Select this radio button |
| **Region** | East US | Same as App Service Plan |
| **App Service Plan** | `vxt-app-plan` | SELECT the one you just created |
| **Sku and size** | Free F1 | Should auto-select (already set from plan) |

### Step 2.3: Detailed Instructions for Each Field

**Subscription:**
- Click dropdown
- Select your subscription (e.g., "Free Trial", "Visual Studio Professional")

**Resource Group:**
- Click dropdown → Select **`VXT-IoT-Hub`** (your existing group)
- Do NOT create new

**Name:**
- Click text box
- Delete any existing text
- Type: **`vxt-admin-app`** (lowercase, no spaces)
- Azure will show: ✅ or ⚠️ if name is taken
- If taken, add a number: `vxt-admin-app123`

**Runtime stack:**
- Click dropdown (shows "Node 18 LTS" or similar)
- Scroll down to find **"Python"** section
- Select **"Python 3.11"**

**App Service Plan:**
- Click dropdown
- You should see **`vxt-app-plan`** (the one you created)
- Select it

### Step 2.4: Review and Create

1. Scroll to bottom
2. Click **"Review + create"** (blue button)
3. Verify all fields (see green checkmarks)
4. Click **"Create"** button (final)

⏱️ **Wait 2-3 minutes for deployment**

When complete, you'll see:
```
Your deployment is complete
✓ vxt-admin-app (App Service created)
```

---

## STEP 3: Verify Your Resources

### Step 3.1: Confirm in Resource Group

1. Go to **Azure Portal** home
2. Click **"Resource groups"** (left menu)
3. Click **`VXT-IoT-Hub`**
4. You should see **3 resources now**:
   ```
   ✓ vxt-app-plan (App Service Plan)
   ✓ vxt-admin-app (App Service)
   ✓ vxtstoragedev (Storage Account - created earlier)
   ```

### Step 3.2: Get Your App URL

1. In the resource group, click **`vxt-admin-app`** (App Service)
2. Top-right area, you'll see a URL like:
   ```
   https://vxt-admin-app.azurewebsites.net
   ```
3. Copy this URL (you'll need it later)

### Step 3.3: Check App Service Plan Tier

1. Click **`vxt-app-plan`** resource
2. Look for **"Sku"** or **"Pricing tier"** info
3. Should show **"Free F1"** ✓

---

## WHAT YOU JUST CREATED

```
Resource Group: VXT-IoT-Hub
├─ vxt-app-plan (App Service Plan - Free F1)
│  └─ Status: Running
│  └─ Cost: $0/month
│
├─ vxt-admin-app (App Service - your app)
│  └─ Status: Running
│  └─ URL: https://vxt-admin-app.azurewebsites.net
│  └─ Runtime: Python 3.11
│  └─ Cost: $0/month
│
└─ vxtstoragedev (Storage Account - Free tier)
   └─ Status: Created
   └─ Cost: Free (12 months)
```

---

## TROUBLESHOOTING

### Issue: "Name is already taken"
**Solution:**
- The app name must be globally unique in Azure
- Try adding a number: `vxt-admin-app123` or `vxt-admin-app2026`
- Click the Name field again and modify

### Issue: "Runtime stack is not showing Python"
**Solution:**
1. Make sure **"Code"** is selected for Publish
2. Make sure **"Windows"** is selected for OS
3. Then try clicking Runtime stack dropdown again

### Issue: Can't find "VXT-IoT-Hub" resource group
**Solution:**
1. Make sure you created it earlier
2. Or create it now: 
   - Search "Resource groups" → Create → Name it "VXT-IoT-Hub"
3. Then try App Service Plan again

---

## NEXT STEPS (After This)

✅ **App Service Plan + App Service created!**

Remaining steps:
1. Create Azure SQL Server + Database
2. Build React dashboard locally
3. Deploy code to App Service (via Git)
4. Configure settings (DB connection string)
5. Execute SQL schema script
6. Test your app

---

## QUICK REFERENCE

**Your App Details:**
- **App Service Plan Name**: `vxt-app-plan`
- **App Service Name**: `vxt-admin-app`
- **App URL**: `https://vxt-admin-app.azurewebsites.net`
- **Runtime**: Python 3.11
- **Tier**: Free F1
- **Cost**: $0/month
- **Resource Group**: VXT-IoT-Hub

Save these details!

