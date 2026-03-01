
EXAM ANALYSER - RENDER READY

Steps:

1. Upload all files to your new GitHub repo (exam-analyser).
   IMPORTANT: package.json and server.js must be in ROOT.

2. In Render:
   Runtime: Node
   Build Command: npm install
   Start Command: node server.js

3. Add Environment Variables in Render (if using production DB):
   DB_HOST
   DB_USER
   DB_PASS
   DB_NAME

4. Ensure MySQL database has:
   exams
   answer_keys
   submissions tables

5. Deploy.

Your app will run on:
https://your-render-url.onrender.com
