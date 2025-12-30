# Fix Admin Panel Access

## Issue
Admin panel redirects to login even when logged in as admin.

## Solution

The backend now returns `isAdmin: true` for admin users, but your browser still has the old user data in localStorage.

### Quick Fix:

1. **Open Browser Console** (F12)
2. **Run this command** to clear old data and set admin user:
```javascript
// Clear old data
localStorage.removeItem('user');
localStorage.removeItem('token');

// Login again via API
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' })
})
.then(r => r.json())
.then(data => {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  console.log('✅ Admin user set:', data.user);
  console.log('isAdmin:', data.user.isAdmin);
  window.location.href = '/admin';
});
```

### Alternative: Manual Steps

1. **Logout** from the frontend
2. **Login again** with `admin@example.com` / `admin123`
3. **Navigate** to `/admin`

The backend now correctly returns `isAdmin: true` for admin users.

