# Create App Service - Step by Step

---

## Quick Summary

You'll create ONE App Service inside your existing App Service Plan.

**Time:** ~5-10 minutes

---

## Step 1: Go to Azure Portal

1. Open browser → **https://portal.azure.com**
2. Sign in with your Azure account

---

## Step 2: Search for App Service

1. Click **search bar** at top (magnifying glass)
2. Type: **App Service**
3. Click **"App Service"** from results
4. Click blue **"Create"** button

---

## Step 3: Fill the Form

| Field | Value |
|-------|-------|
| **Subscription** | Your subscription (same as before) |
| **Resource Group** | `VXT-IoT-Hub` ← SELECT existing |
| **Name** | `vxt-admin-app` |
| **Publish** | Code |
| **Runtime stack** | Python 3.11 |
| **Operating System** | Windows |
| **Region** | West Europe ← IMPORTANT: Must match plan |
| **App Service Plan** | `vxt-app-plan` ← SELECT the one you just created |

---

## Step 4: Detailed Instructions

### Subscription
- Should auto-fill with your subscription name
- If not, click dropdown and select

### Resource Group
- **Click dropdown**
- **Select: `VXT-IoT-Hub`** (the existing one)
- Do NOT create new

### Name
- **Click text box**
- **Enter: `vxt-admin-app`** (lowercase, no spaces)
- Azure will show ✅ if available
- If not available, add a number: `vxt-admin-app123`

### Publish
- **Select: "Code"** (radio button)

### Runtime stack
- **Click dropdown** (shows "Node 18 LTS" or similar)
- **Scroll down to find "Python"**
- **Select: "Python 3.11"** ← CRITICAL

### Operating System
- **Select: "Windows"** (radio button)

### Region
- **Click dropdown**
- **Select: "West Europe"** ← Same as your App Service Plan

### App Service Plan
- **Click dropdown**
- **Select: `vxt-app-plan`** (the one you created)
- Should show: "Free F1" tier

---

## Step 5: Review and Create

1. **Scroll to bottom**
2. **Click "Review + create"** (blue button)
3. **Verify all fields show checkmarks** ✓
4. **Click "Create"** button (final step)

⏱️ **Wait 2-3 minutes for deployment**

---

## Success!

When complete, you'll see:

```
Your deployment is complete
✓ vxt-admin-app (App Service)
```

---

## Get Your App URL

Once created:

1. **Azure Portal** → **VXT-IoT-Hub** resource group
2. **Click `vxt-admin-app`** (App Service)
3. **Top-right**: Copy the URL:
   ```
   https://vxt-admin-app.azurewebsites.net
   ```
   (or similar, depending on your name)

**Save this URL** - you'll need it later!

---

## What You'll Have Now

```
Resource Group: VXT-IoT-Hub
├─ vxt-app-plan (App Service Plan)
│  └─ Cost: $0
│  └─ Tier: Free F1
│
├─ vxt-admin-app (App Service) ✅ CREATED NOW
│  └─ Cost: $0
│  └─ Runtime: Python 3.11
│  └─ URL: https://vxt-admin-app.azurewebsites.net
│  └─ Region: West Europe
│
└─ SQL Database: (Europe, FREE)
```

---

## Troubleshooting

### "Name already taken"
- Add a number: `vxt-admin-app123` or `vxt-admin-app2026`

### "Python 3.11 not showing"
- Make sure **"Code"** is selected for Publish
- Make sure **"Windows"** is selected for OS
- Then try the Runtime dropdown again

### "Can't find App Service Plan"
- Make sure you created it first (you said you did ✓)
- Click the dropdown and scroll - it should be there

---

## Next Steps (After This)

✅ App Service Plan created  
✅ App Service created ← You are here  

⏳ Still need:
- Build React dashboard locally
- Deploy code to App Service
- Configure database connection
- Test your app

Ready to continue?

