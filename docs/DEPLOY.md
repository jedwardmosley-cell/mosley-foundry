# Putting Both Hands on the Wheel online

About 20 minutes. You need a GitHub account (you have one) and the two content files
(`pack.json`, `entrepreneur.json`). Nothing here costs money on the free plans.

The app runs on **Vercel** (hosting) with a **Neon** database (PostgreSQL), which Vercel sets up for you.

## 1. Create the Vercel project

1. Go to **vercel.com** and choose **Sign Up**, then **Continue with GitHub**.
2. Choose **Add New...**, then **Project**.
3. Find **mosley-foundry** and choose **Import**. If it isn't listed, choose
   **Adjust GitHub App Permissions** and give Vercel access to that repository.
4. Leave every setting as it is and choose **Deploy**.

   The first deploy finishes without a database. That's expected.

## 2. Add the database

1. In your new project, open the **Storage** tab.
2. Choose **Create Database**, pick **Neon** (Serverless Postgres), and accept the defaults.
3. When asked which environments to connect, keep all of them checked and choose **Connect**.

   This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to your project automatically.

## 3. Add your settings

Open **Settings**, then **Environment Variables**, and add:

| Name | Value |
|---|---|
| `SETUP_TOKEN` | A long password you make up (20+ characters). You will type it once at the setup page. Keep it private. |
| `ALLOW_SIGNUP` | `true` lets anyone create an account. `false` means only administrators enroll people. |
| `ANTHROPIC_API_KEY` | Optional. Your key from console.anthropic.com, to turn on the AI Companion. |

## 4. Redeploy

Open the **Deployments** tab. On the newest deployment, choose the **...** menu, then **Redeploy**.
This time the build creates the database tables.

## 5. Run setup

1. Open `https://YOUR-PROJECT.vercel.app/setup` (the address is on the project's main page).
2. Check the launch checklist. Database and setup token should show a check mark.
3. **Create the administrator:** enter your setup token, your organization name, name, email, and a password.
   This works only once.
4. **Install the content pack:** enter the setup token again and choose `pack.json` and `entrepreneur.json`.
   They are stored in your private database, never in the public code.
5. Choose **Go to sign in** and sign in as the administrator.

## 6. After launch

- **Coaches and cohorts:** as the administrator, create a cohort, then enroll coaches (role "Facilitator / coach")
  and participants. Each new person gets a temporary password, shown once.
- **Custom domain:** under **Settings**, then **Domains**, you can add an address like `app.mosleyfoundry.com`.
- **Updates:** every change merged into `main` on GitHub deploys automatically.
- **Optional cleanup:** you can delete `SETUP_TOKEN` after setup. Add it back if you need to replace the content pack.

## If something goes wrong

- **Setup page says the database is not connected:** repeat step 2, then step 4.
- **"Setup token is missing or wrong":** check the value under Environment Variables, and redeploy after changing it.
- **Assessment shows "Draft assessment":** the content pack isn't installed yet. Repeat step 5.4.
