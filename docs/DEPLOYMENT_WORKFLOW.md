# VXT Deployment Workflow - Official Strategy

**Last Updated:** March 21, 2026  
**Status:** ✅ Active and Enforced  
**Applies To:** All code changes, all deployments, all team members

---

## 🎯 Core Principle

**RULE: Code lives on `main`, Production runs from `prod`, Deployments use ONLY the `push-to-prod.ps1` script.**

---

## Understanding Git Structure

### Three Critical Components

#### 1. **main** (Your Development Branch)
- Where ALL code changes start
- Automatically tested locally before pushing
- Changes here ❌ do NOT deploy automatically
- Frequent, daily commits expected
- This is where you work 99% of the time

#### 2. **prod** (Production Branch)
- Only receives code via `push-to-prod.ps1` script
- Every push to prod ✅ AUTOMATICALLY deploys to Azure
- Protected on GitHub (prevents accidental commits)
- Rarely updated (only when code is stable & ready)
- This should change only when deployment is intentional

#### 3. **origin** (GitHub Remote Repository)
- Your repository on GitHub
- `origin/main` = GitHub's copy of main
- `origin/prod` = GitHub's copy of prod
- Commands like `git pull origin main` sync FROM GitHub TO your local machine

### Visual Flow

```
Your Work (main branch)
    ↓ commit & push to GitHub
GitHub main branch (origin/main)
    ↓ when ready, run push-to-prod.ps1
GitHub prod branch (origin/prod)
    ↓ GitHub Actions automatically triggers
Azure Deployment ✅
```

---

## Daily Workflow - Step by Step

### Phase 1: Development (On `main`)

```bash
# 1. Ensure you're on main
git branch
# Should show: * main

# 2. Pull latest changes
git pull origin main

# 3. Make your code changes
# (edit files, test locally, etc.)

# 4. Commit your changes
git add .
git commit -m "feat: add new telemetry feature"

# 5. Push to GitHub
git push origin main
# OR use VS Code: Source Control → sync button
```

✅ **Result:** Your code is now on GitHub main branch  
❌ **NOT deployed yet** - This is intentional!

### Phase 2: Testing & Verification

```bash
# Run local tests
python -m pytest tests/

# Test endpoints locally
curl http://localhost:8000/health/db

# Verify everything works
# Fix any issues, commit to main again if needed
```

✅ **All tests pass, code is stable**

### Phase 3: Deploy to Production (When Ready)

```bash
# Run the official deployment script
.\push-to-prod.ps1

# Or via VS Code:
# Ctrl+Shift+P → search → "Push Main to Prod"
```

✅ **What happens:**
1. Verifies you're on main branch
2. Pulls latest main from GitHub
3. Switches to prod
4. Merges main → prod
5. Pushes prod to GitHub
6. **GitHub Actions automatically deploys to Azure**

📊 **Monitor deployment:** Click the link in terminal output

---

## What Does push-to-prod.ps1 Do?

This script is your **official and only** deployment mechanism:

```powershell
.\push-to-prod.ps1
```

**Execution Steps:**
1. ✅ Checks: Are you on main branch?
2. ✅ Pulls: Latest code from GitHub main
3. ✅ Switches: To prod branch
4. ✅ Merges: main → prod locally
5. ✅ Pushes: prod to GitHub (triggers Azure deployment)
6. ✅ Returns: Back to main branch
7. ✅ Shows: GitHub Actions link to monitor

**What NOT to do:**
```bash
# NEVER do this:
git checkout prod; git push origin prod  # ❌ FORBIDDEN - breaks workflow
git commit directly to prod              # ❌ FORBIDDEN
git push origin prod                     # ❌ FORBIDDEN - use script only
```

---

## Common Scenarios

### Scenario 1: "I made changes, need to deploy"

```bash
# Step 1: On main, commit and push
git add .
git commit -m "fix: database connection timeout"
git push origin main

# Step 2: Test locally to ensure it works
npm test  # or pytest, etc.

# Step 3: Ready? Deploy!
.\push-to-prod.ps1

# All done! Azure will deploy automatically
```

---

### Scenario 2: "I pushed to main, but want to hold deployment"

**No problem!** Changes on `main` don't deploy automatically.

```bash
# Just don't run the script
# Your code stays safe on main
# Deploy later when ready: .\push-to-prod.ps1
```

---

### Scenario 3: "Production broke, need to rollback"

```bash
# Option 1: Revert the bad commit
git log --oneline  # See recent commits
git revert <bad-commit-hash>
git push origin main
.\push-to-prod.ps1  # Deploy fix

# Option 2: Rollback entire prod to previous version
# Contact admin for git reset if needed
```

---

### Scenario 4: "What if I accidentally committed to prod?"

**GitHub protection prevents this**, but if it happens:

```bash
# Recovery: sync prod back to main
git checkout prod
git reset --hard origin/main
git push origin prod --force

# This overwrites prod with main's code
```

---

## GitHub Branch Protection (How It Works)

### Why Prod Is Protected

We've enabled GitHub branch protection on `prod` branch to:
- ❌ Prevent direct pushes to prod
- ❌ Prevent accidental commits to prod
- ✅ Enforce script-based deployment only
- ✅ Require admin status for emergency overrides

### What This Means

```bash
# This will FAIL (branch protection):
git push origin prod

# This will SUCCEED (approved via script):
.\push-to-prod.ps1
```

The script succeeds because:
1. It's an intentional, controlled merge
2. You have admin privileges
3. It follows the official workflow

---

## CI/CD Pipeline: What Happens After Push

### When You Push to `prod`:

1. **GitHub receives push** → Triggers GitHub Actions
2. **Tests run** → `deploy-web-app-to-azure.yml` starts
3. **Code deploys** → Direct file deployment to Azure Web App
4. **Health check** → Automatically verifies deployment
5. **Done** → Live in production

**Timeline:** 2-5 minutes from script execution to live deployment

**Monitor:** 
```bash
# GitHub Actions: https://github.com/barakuziel-vxt/vxt/actions
# Azure Web App: https://vxt-web-app-g5gbaee2f4bmgphb.northeurope-01.azurewebsites.net
```

---

## Best Practices

### ✅ DO:
- ✅ Work on `main` for all development
- ✅ Commit frequently to `main` (git is your backup)
- ✅ Test locally before pushing
- ✅ Use `push-to-prod.ps1` for ALL deployments
- ✅ Monitor Azure after deployment
- ✅ Keep `prod` in sync with GitHub

### ❌ DON'T:
- ❌ Commit directly to `prod` branch
- ❌ Use `git push origin prod` manually
- ❌ Create features on `prod` branch
- ❌ Bypass the deployment script
- ❌ Push untested code to `main`
- ❌ Mix development with deployment

---

## Troubleshooting

### Issue: Script says "ERROR: You must be on 'main' branch"

```bash
# Solution: Switch to main
git checkout main
git pull origin main

# Then try again
.\push-to-prod.ps1
```

---

### Issue: "Failed to pull from main" error

```bash
# Solution: Check GitHub connection
git remote -v
# Should show: origin  https://github.com/barakuziel-vxt/vxt.git (fetch/pull)

# If this fails, re-authenticate with GitHub
git config --global credential.helper store
git pull origin main
```

---

### Issue: Merge conflicts during push

```bash
# This means prod has changes main doesn't have (unusual)

# Solution 1: Resolve manually
git merge -X ours origin/main
git push origin prod

# Solution 2: Force prod to match main
git reset --hard origin/main
git push origin prod --force
```

---

## For Claude Sessions & Automation

### Instructions for All Claude AI Sessions

When the user asks you to **"fix and deploy"** or **"deploy changes to production"**:

1. **Commit to main:**
   ```bash
   git checkout main
   git add .
   git commit -m "fix: description"
   git push origin main
   ```

2. **Tell user:**
   - ✅ "Code has been committed to main"
   - ✅ "To deploy, run: `.\push-to-prod.ps1`"
   - ❌ Never say "I'll push to prod"

3. **Never touch prod directly:**
   - ❌ Don't run `git checkout prod`
   - ❌ Don't run `git push origin prod`
   - ❌ Don't modify prod branch
   - ✅ Always redirect to the script

### Why This Matters

- **Safety:** Script is the tested, reliable deployment method
- **Consistency:** All deployments use same process
- **Auditability:** Clear record of who deployed when
- **Automation:** GitHub Actions keys off prod pushes
- **Control:** User controls when deployments happen, not AI

---

## Quick Reference Card

| Action | Command | Result |
|--------|---------|--------|
| Develop & commit | `git add . && git commit -m "..."` | Changes save locally |
| Push changes | `git push origin main` | Syncs to GitHub main |
| Ready to deploy? | `.\push-to-prod.ps1` | Deploys to Azure ✅ |
| Check deployment | Monitor terminal output | See GitHub Actions link |
| Roll back prod | Contact admin or manual git reset | Only if emergency |
| Revert bad commit | `git revert <hash>` then push to main | Safe rollback |

---

## Related Documentation

- [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) - Current deployment status
- [setup.md](setup.md) - Initial setup
- [deployment.md](deployment.md) - Detailed deployment info
- GitHub Actions: [.github/workflows/](.github/workflows/README.md)

---

## Questions?

Refer to this document or check:
- [Deployment Status](DEPLOYMENT_STATUS.md)
- [Setup Guide](setup.md)
- GitHub Actions logs: `https://github.com/barakuziel-vxt/vxt/actions`

**Remember: main branch = daily work, prod branch = production only**
