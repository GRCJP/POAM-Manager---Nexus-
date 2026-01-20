# Clear IndexedDB and Test Fixes

## Option 1: Clear via Browser DevTools (Recommended)
1. Open DevTools (F12)
2. Go to "Application" tab
3. Find "IndexedDB" in left sidebar
4. Right-click on "POAMDatabase" 
5. Select "Delete database"
6. Hard refresh (Cmd+Shift+R)
7. Re-upload CSV

## Option 2: Clear via Console
1. Open DevTools Console (F12)
2. Run this command:
```javascript
indexedDB.deleteDatabase('POAMDatabase');
location.reload(true);
```
3. Re-upload CSV after page reloads

## What This Fixes
The old POAMs in IndexedDB were created with the buggy code that:
- Dropped pocTeam field → all POCs show as missing
- Dropped dueDate field → all dates show as missing
- Didn't transform asset fields → assets show as "unknown"

After clearing and re-uploading, new POAMs will have:
✅ POC assignments from OS detection (Windows/Linux Systems Team)
✅ Due dates calculated from First Detected column
✅ Asset details with actual names/IPs/OS
