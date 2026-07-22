# Authentication

Authentication is built on [NextAuth](https://next-auth.js.org/) and is entirely optional: the app
runs with auth disabled unless `NEXTAUTH_URL` is set ([`get-auth-toggle.ts`](../src/utils/auth/get-auth-toggle.ts)).
When disabled, [`SignInGate`](../src/components/SignInGate.tsx) renders its children unguarded.

A deployment configures **exactly one** identity provider — set `NEXTAUTH_URL`/`NEXTAUTH_SECRET`
plus that provider's block below, and leave every other provider's vars unset. Each provider is
only registered with NextAuth if all of its required vars are present
([`auth-providers.ts`](../src/utils/auth/auth-providers.ts)); unset providers are simply skipped.

## Common variables

These apply regardless of which provider is configured.

| Variable           | Default        | Required              | Purpose                                                                                                                            |
| ------------------ | -------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_URL`     | —              | Yes (to enable auth)  | Canonical deployment URL NextAuth uses for callback URLs and to detect https (secure cookies). Its presence is what turns auth on. |
| `NEXTAUTH_SECRET`  | —              | Yes (if auth enabled) | Secret NextAuth uses to sign/encrypt session JWTs.                                                                                 |
| `ADMIN_ROLE_NAMES` | `'admin'`      | No                    | Comma-separated role names that grant admin access.                                                                                |
| `DIAL_ROLES_FIELD` | `'dial_roles'` | No                    | Dot-separated JWT claim path the user's roles are read from.                                                                       |
| `SHOW_TOKEN_SUB`   | `false`        | No                    | Debug toggle (`'true'`/anything else) — logs the token `sub` claim in the clear instead of masking it as `******`.                 |

## Providers

Pick one section below and fill in its vars. `NAME` (where present) sets the display label
NextAuth/DIAL shows for the provider; it defaults to `'SSO'`.

### Keycloak

| Variable                  | Default                                 | Required | Purpose                                                                           |
| ------------------------- | --------------------------------------- | -------- | --------------------------------------------------------------------------------- |
| `AUTH_KEYCLOAK_CLIENT_ID` | —                                       | Yes      | OIDC client ID.                                                                   |
| `AUTH_KEYCLOAK_SECRET`    | —                                       | Yes      | OIDC client secret.                                                               |
| `AUTH_KEYCLOAK_HOST`      | —                                       | Yes      | Keycloak base URL. Used as the issuer directly if `AUTH_KEYCLOAK_REALM` is unset. |
| `AUTH_KEYCLOAK_REALM`     | —                                       | No       | If set, issuer becomes `<HOST>/realms/<REALM>` instead of just `HOST`.            |
| `AUTH_KEYCLOAK_NAME`      | `'SSO'`                                 | No       | Display name.                                                                     |
| `AUTH_KEYCLOAK_SCOPE`     | `'openid email profile offline_access'` | No       | OAuth scope.                                                                      |

### Azure AD

| Variable                  | Default                                           | Required | Purpose             |
| ------------------------- | ------------------------------------------------- | -------- | ------------------- |
| `AUTH_AZURE_AD_CLIENT_ID` | —                                                 | Yes      | OIDC client ID.     |
| `AUTH_AZURE_AD_SECRET`    | —                                                 | Yes      | OIDC client secret. |
| `AUTH_AZURE_AD_TENANT_ID` | —                                                 | Yes      | Azure AD tenant ID. |
| `AUTH_AZURE_AD_NAME`      | `'SSO'`                                           | No       | Display name.       |
| `AUTH_AZURE_AD_SCOPE`     | `'openid profile user.Read email offline_access'` | No       | OAuth scope.        |

### Google

| Variable                | Default                                 | Required | Purpose              |
| ----------------------- | --------------------------------------- | -------- | -------------------- |
| `AUTH_GOOGLE_CLIENT_ID` | —                                       | Yes      | OAuth client ID.     |
| `AUTH_GOOGLE_SECRET`    | —                                       | Yes      | OAuth client secret. |
| `AUTH_GOOGLE_NAME`      | `'SSO'`                                 | No       | Display name.        |
| `AUTH_GOOGLE_SCOPE`     | `'openid email profile offline_access'` | No       | OAuth scope.         |

### Auth0

| Variable               | Default                                 | Required | Purpose                                    |
| ---------------------- | --------------------------------------- | -------- | ------------------------------------------ |
| `AUTH_AUTH0_CLIENT_ID` | —                                       | Yes      | OIDC client ID.                            |
| `AUTH_AUTH0_SECRET`    | —                                       | Yes      | OIDC client secret.                        |
| `AUTH_AUTH0_HOST`      | —                                       | Yes      | Auth0 domain, used directly as the issuer. |
| `AUTH_AUTH0_NAME`      | `'SSO'`                                 | No       | Display name.                              |
| `AUTH_AUTH0_AUDIENCE`  | —                                       | No       | API audience, unset by default.            |
| `AUTH_AUTH0_SCOPE`     | `'openid email profile offline_access'` | No       | OAuth scope.                               |

### Amazon Cognito

| Variable                 | Default                  | Required | Purpose                                                |
| ------------------------ | ------------------------ | -------- | ------------------------------------------------------ |
| `AUTH_COGNITO_CLIENT_ID` | —                        | Yes      | OIDC client ID.                                        |
| `AUTH_COGNITO_SECRET`    | —                        | Yes      | OIDC client secret.                                    |
| `AUTH_COGNITO_HOST`      | —                        | Yes      | Cognito user pool domain, used directly as the issuer. |
| `AUTH_COGNITO_NAME`      | `'SSO'`                  | No       | Display name.                                          |
| `AUTH_COGNITO_SCOPE`     | `'openid email profile'` | No       | OAuth scope.                                           |

### Okta

| Variable                  | Default                  | Required | Purpose                                                                             |
| ------------------------- | ------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `AUTH_OKTA_CLIENT_ID`     | —                        | Yes      | OIDC client ID.                                                                     |
| `AUTH_OKTA_CLIENT_SECRET` | —                        | Yes      | OIDC client secret. Note the `CLIENT_SECRET` suffix — other providers use `SECRET`. |
| `AUTH_OKTA_ISSUER`        | —                        | Yes      | Okta issuer URL.                                                                    |
| `AUTH_OKTA_SCOPE`         | `'openid email profile'` | No       | OAuth scope.                                                                        |

Okta has no `AUTH_OKTA_NAME` — it always uses NextAuth's built-in provider display name.
