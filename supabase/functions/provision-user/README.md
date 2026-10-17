# Supabase Edge Function: `provision-user`

This Edge Function securely provisions user accounts (School Admins, Parents, Guards, Teachers) using the Supabase Service Role key on the server side. It enforces strict RBAC and prevents privilege escalation.

## Security Guarantees
1. **Never exposes service_role key to browser/client.**
2. **Caller Authentication**: Verifies the caller's JWT through `auth.getUser()`.
3. **Role Enforcement**:
   - Only a **Super Admin** can create/assign a **School Admin**.
   - A **School Admin** can only create **Parent**, **Guard**, or **Teacher** accounts for their **own active school**.
   - Cannot create Super Admin accounts.
   - Deactivated schools cannot have accounts provisioned.
4. **Safe Response**: Never returns passwords or sensitive tokens.

## How to Deploy to Supabase

### 1. Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### 2. Login and Link your Supabase Project
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 3. Deploy the Edge Function
```bash
supabase functions deploy provision-user --no-verify-jwt
```
*(Note: JWT is verified internally inside the function code to provide custom role checks and detailed error responses).*

### 4. Verify Secrets
In your Supabase Dashboard -> **Edge Functions** -> **Secrets**, ensure:
- `SUPABASE_URL` is set to your project URL
- `SUPABASE_ANON_KEY` is set to your project public anon key
- `SUPABASE_SERVICE_ROLE_KEY` is set to your project secret service_role key
