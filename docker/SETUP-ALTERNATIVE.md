# Alternative LRS Setup Options

Since Learning Locker doesn't have a simple pre-built Docker image, here are your options:

## Option 1: Use a Hosted LRS (Easiest for Development)

For quick development, you can use a free hosted LRS:

### Veracity LRS (Free Tier)
1. Sign up at: https://www.veracitylearning.com/
2. Create a free account
3. Get your endpoint URL and credentials
4. Add to `backend/.env`:
   ```
   LRS_ENDPOINT=https://lrs.veracitylearning.com/data/xAPI
   LRS_KEY=your-key
   LRS_SECRET=your-secret
   ```

### SCORM Cloud (Free Trial)
1. Sign up at: https://cloud.scorm.com/
2. Get xAPI credentials from settings
3. Use their LRS endpoint

## Option 2: Official Learning Locker Setup

The official way to set up Learning Locker:

1. **Clone the deployment repository:**
   ```bash
   git clone https://github.com/LearningLocker/deploy.git
   cd deploy
   ```

2. **Run the deployment script:**
   ```bash
   sudo bash deployll.sh
   ```

3. **Follow the setup wizard** to configure Learning Locker

## Option 3: Mock/Test Mode (For Development)

You can run the backend without a real LRS for initial testing:

1. Set dummy values in `backend/.env`:
   ```
   LRS_ENDPOINT=http://localhost:8080/data/xAPI
   LRS_KEY=test-key
   LRS_SECRET=test-secret
   ```

2. The backend will show warnings but still run
3. Course content will work, but xAPI statements won't be stored

## Option 4: Use MongoDB + Simple LRS Script

I can create a simple Node.js LRS server that you can run locally. Would you like me to set this up?

## Recommendation

For **quick development**: Use Option 1 (Veracity LRS - free and easy)

For **production**: Use Option 2 (Official Learning Locker) or a hosted service

Let me know which option you prefer, and I'll help you set it up!

