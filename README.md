# Full-Stack Multi-Role E-Commerce Platform

A modern, full-stack e-commerce web application built with **Next.js (App Router)**, **Prisma**, **PostgreSQL**, and **Tailwind CSS**. It supports three distinct user roles (**USER**, **SELLER**, and **ADMIN**) with role-based access control, atomic checkout transactions, inventory management, and cloud image uploads.

---

## Features

- **Authentication & Role-Based Access Control (RBAC):**
  - JWT-based authentication and Google OAuth login.
  - Protected API routes and client-side route guards for **USER** (Buyer), **SELLER**, and **ADMIN** roles.
- **Product Catalog & Storefront:**
  - Real-time search, category filtering, "In Stock Only" filter, and "My Listings" view for sellers.
  - Full CRUD operations for Sellers and Admins, including soft-archiving for products linked to past orders.
  - Direct image uploads integrated with **Cloudinary**.
- **Shopping Cart & Dual Checkout Pipeline:**
  - Persistent database-backed shopping cart with stock validation and quantity controls.
  - Supports both **Cart Checkout** and **Direct Buy ("Buy Now")** flows with mandatory shipping address capture.
- **Atomic Order & Inventory Management:**
  - Uses Prisma `$transaction` to validate stock, decrement inventory, snapshot product names/prices (`productName`, `priceAtPurchase`), and clear carts atomically.
  - Buyers can track orders and cancel `PENDING` orders (automatically restoring product stock); Admins can update order fulfillment statuses (`PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `SHIPPED` $\rightarrow$ `DELIVERED` / `CANCELLED`).
- **Profile & Admin Management:**
  - Account profile page for updating personal details and changing passwords securely.
  - Admin controls for managing users, categories, products, and store-wide orders.

---

## Technologies Used

- **Frontend:** Next.js 16 (App Router, Turbopack), React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Next.js Route Handlers (REST API), Node.js
- **Database & ORM:** PostgreSQL, Prisma ORM (v7 with `@prisma/adapter-pg`)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Google Auth Library (`google-auth-library`)
- **Media Storage:** Cloudinary (`cloudinary`)
- **Deployment:** Vercel

---

## Environment Configuration

Create a `.env` file in the root directory of the project and configure the following variables:

```env
# PostgreSQL Connection String
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# Secret key used to sign and verify JWT tokens
JWT_SECRET="your-super-secret-jwt-key"

# Cloudinary Credentials (for product image uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Google OAuth (optional, required if Google Sign-In is enabled)
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URL (e.g., Neon, Supabase, Railway, or local PostgreSQL). |
| `JWT_SECRET` | Strong random string used to sign authentication tokens. |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret (server-side only). |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Client ID for verifying Google login tokens. |

---

## How to Run Locally

### 1. Prerequisites
- **Node.js** 18.18 or later
- **npm** (or yarn / pnpm)
- A running **PostgreSQL** database instance
- A **Cloudinary** account

### 2. Clone the Repository
```bash
git clone [https://github.com/Nasmiahmd/e-commerce-nextjs.git](https://github.com/Nasmiahmd/e-commerce-nextjs.git)
cd e-commerce-nextjs
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Set Up Environment Variables
Create a `.env` file in the project root and paste the configuration shown in the [Environment Configuration](#environment-configuration) section above.

### 5. Generate Prisma Client & Sync Database Schema
```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## Deployment (Vercel)

1. Push your repository to GitHub and import it into [Vercel](https://vercel.com).
2. Add all variables from your `.env` file under **Project Settings $\rightarrow$ Environment Variables**.
3. Ensure `package.json` runs `prisma generate` during the build step:
   ```json
   "scripts": {
     "build": "prisma generate && next build",
     "postinstall": "prisma generate"
   }
   ```
4. Trigger a deployment.