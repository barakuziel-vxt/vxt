# GitHub Branch Protection Setup - VXT Prod Branch

**Purpose:** Prevent accidental commits to `prod` branch, enforce script-based deployments only

---

## What Is Branch Protection?

Branch protection on GitHub prevents:
- ❌ Direct pushes to the protected branch
- ❌ Accidental force-pushes
- ❌ Deletion of the branch
- ✅ Allows admin override when needed (for you)
- ✅ Enforces review/approval workflow (optional)

---

## How to Enable Prod Protection (Admin Only)

### Step 1: Go to GitHub Settings
```
https://github.com/barakuziel-vxt/vxt/settings/branches
```

### Step 2: Add Protection Rule
1. Click **"Add rule"** button
2. Under **"Branch name pattern"**, enter: `prod`
3. Check these options:
   - ✅ **Require a pull request before merging**
     - Set required approvals: `0` (you can approve yourself)
     - Check: "Dismiss stale pull request approvals when new commits are pushed"
   - ✅ **Require status checks to pass before merging**
     - This ensures tests pass before deployment
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Include administrators**
     - This means EVEN admins follow the rules (good practice)

### Step 3: Save
- Click **"Create"** or **"Save changes"**
- GitHub will confirm protection is active

---

## Result: How It Works

### Scenario 1: Manual push (BLOCKED)
```bash
git push origin prod
# ERROR: Protected branch push rejected
```

### Scenario 2: Script push (ALLOWED - admin bypass)
```bash
.\push-to-prod.ps1
# ✅ SUCCEEDS
# Because: Script is approved deployment mechanism
#          You have admin privileges
#          It's a controlled merge operation
```

### Scenario 3: Emergency override (ALLOWED - admin only)
```bash
git push origin prod --force
# ✅ SUCCEEDS (if admin)
# Use ONLY for emergency rollback
```

---

## Why We're Doing This

| Without Protection | With Protection |
|------------------|-----------------|
| ❌ Could accidentally push bad code to prod | ✅ Physical barrier prevents accidents |
| ❌ Someone (even you) could force-push bad code | ✅ Must go through script workflow |
| ❌ Inconsistent deployments | ✅ All deployments same path |
| ❌ Hard to audit "who deployed what" | ✅ Clear audit trail |
| ❌ Risky for multi-person team | ✅ Professional safeguard |

---

## For Multi-Session Consistency

### How Branch Protection Helps All Claude Sessions

**Without protection:**
- Session 1: "I'll push to prod" ✅ Possible
- Session 2: "I'll push to prod" ✅ Possible
- Result: ⚠️ Chaotic, multiple people pushing

**With protection:**
- Session 1: "I'll push to prod" → ERROR: protected
- Session 2: "I'll push to prod" → ERROR: protected
- Result: ✅ Only script allowed
- Enforcement: Technical + procedural

---

## What Happens After Protection Is Enabled

### Workflow Still Works:
```bash
.\push-to-prod.ps1
# Script runs successfully because:
# 1. It's an approved workflow
# 2. You (admin) can override
# 3. This is the intended operation
```

### No Code Changes Needed:
- `push-to-prod.ps1` works exactly the same
- You have admin privileges (protection doesn't block admins doing controlled merges)
- Deployment process unchanged

### Protected:
- Direct manual pushes: ❌ BLOCKED
- Accidental commits: ❌ PREVENTED
- Unauthorized changes: ❌ BLOCKED
- Script deployments: ✅ ALLOWED

---

## Testing Protection

Once enabled, verify it works:

```bash
# This should FAIL:
git checkout prod
git commit --allow-empty -m "test"
git push origin prod
# Error: "protected branch"

# This should SUCCEED:
.\push-to-prod.ps1
# (runs normal script successfully)
```

---

## Common Questions

### "Can I still push to prod if I need to?"
Yes, as admin you can override using:
```bash
git push origin prod --force-with-lease
```
But you shouldn't - use the script instead. Protection helps you resist the temptation.

### "What if the script fails?"
The script will tell you why (merge conflict, etc). Then:
1. Fix the issue
2. Try again or manually resolve
3. Use `git push origin prod --force-with-lease` if truly necessary

### "Does this break anything?"
No. Your workflows all stay the same:
- Pushing to `main` works (not protected)
- Script works (you're admin, approved method)
- Only direct pushes to `prod` are blocked

### "How does Azure deployment still work?"
GitHub Actions watches `prod` branch:
```
┌─ Protection: blocks direct push
├─ Script: admin can override
└─ Result: prod receives update → GitHub Actions triggers → Azure deploys
```

---

## Maintenance

### If You Need to Disable (Not Recommended):
1. Go to Settings → Branches
2. Find `prod` rule
3. Click **"Delete"**
4. Confirm deletion

Warning: This removes all protections. Only do if:
- Emergency recovery required
- Strategic decision to remove safeguards
- Plan to re-enable afterward

---

## Summary

| Protection Level | How | Result |
|-----------------|-----|--------|
| No protection | Can push directly | ❌ Risky |
| Script only | Use push-to-prod.ps1 | ✅ Safer |
| Branch protection | GitHub blocks direct push | ✅ Manufacturing control |
| Branch protection + training | + everyone knows workflow | ✅ Professional |

**Recommendation:** Enable protection now, train everyone, use script for all deployments.
