# Crescent Home Kitchen: setup

The website has two parts:

- **The pages** (`index.html` for customers, `admin.html` for you), hosted free on GitHub Pages.
- **The Google Sheet**, which stores menus and orders. A small script inside it (`apps-script/Code.gs`) checks the limits and saves each order.

This takes about 15 minutes, once.

## 1. Make the Google Sheet and its script

1. Go to [sheets.new](https://sheets.new) and name the sheet something like **Crescent Orders**.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete what's in `Code.gs`, then paste in everything from `apps-script/Code.gs` in this folder.
4. Near the top, change `var ADMIN_PASSWORD = 'change-me';` to a password only you know, e.g. `'tomato-rasam-42'`.
5. Click **Project Settings** (gear icon) and set **Time zone** to *(GMT+05:30) India Standard Time*.
6. Back in the editor, choose the `setup` function in the toolbar and click **Run**. Google will ask for permission to use your sheet: click through and allow it (you may need to choose *Advanced → Go to project*). This creates the **Orders** and **Menus** tabs.
7. Click **Deploy → New deployment**. For the type, pick **Web app**, then set:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
8. Click **Deploy** and copy the **Web app URL**. It starts with `https://script.google.com/macros/s/`.

## 2. Connect the pages

Open `config.js` and paste the URL in:

```js
window.CRESCENT_CONFIG = {
  api: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

## 3. Put the site on GitHub Pages

1. Create a new repository on GitHub (e.g. `crescent-kitchen`). It must be **public** for free GitHub Pages.
2. Upload these files: `index.html`, `admin.html`, `admin.js`, `app.js`, `poster.js`, `style.css`, `config.js`, and the `dev/` and `apps-script/` folders.
3. In the repository go to **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute your site is live at `https://<your-username>.github.io/crescent-kitchen/`.
   - Customers use that link.
   - You use `.../admin.html` and sign in with your password.

The repository is public, but your password and orders are not in it. They live only in your Google account.

## Using it every day

1. **Admin → Menu & poster:** pick the date and Lunch or Dinner, type the dishes, check the prices and limits, then press **Publish & open orders**. Save the poster and post it in the group along with the order link.
2. **Admin → Orders:** watch orders come in (the page refreshes every minute). When someone picks up and pays, press **Mark completed**. Press **+ Add an order** for anyone who orders on WhatsApp, so they count toward the limits.
3. **Admin → Records:** see what you collected each day and month. Everything is also in the Google Sheet.

The website stops taking orders by itself at the order-by time, or when a limit runs out. **Stop taking orders** closes a menu early.

## Changing the script later

If you edit `Code.gs` (for example to change the password), go to **Deploy → Manage deployments**, click the pencil, choose **Version: New version**, and **Deploy**. This keeps the same URL, so `config.js` doesn't need to change.

## Trying it without Google (test mode)

Add `?mock` to a page address, e.g. `admin.html?mock`. The site then uses a pretend sheet stored only in your browser. The admin password in test mode is `test`. `dev/test.html` checks the order rules.
