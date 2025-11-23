# Security Best Practices

This document provides a checklist of security best practices to follow when deploying the EDK application to a production environment.

## 1. Network Security

- [ ] **Firewall**: Configure a firewall on your servers. Only open ports that are absolutely necessary (e.g., 80, 443).
- [ ] **Private Networking**: Place your database, Redis, and Typesense instances in a private network (e.g., a VPC). Only allow the application servers to connect to them.
- [ ] **SSH Hardening**:
    - [ ] Disable password-based authentication; use SSH keys only.
    - [ ] Disable root login.
    - [ ] Change the default SSH port.

## 2. Application Security

- [ ] **Secure Environment Variables**:
    - [ ] Do not hardcode secrets (API keys, passwords) in the code.
    - [ ] Use a secure method for managing environment variables (e.g., Doppler, HashiCorp Vault, or your cloud provider's secret manager).
    - [ ] Do not commit your `.env` file to version control.
- [ ] **Dependencies**:
    - [ ] Regularly scan for vulnerabilities in your dependencies (`bun pm audit`).
    - [ ] Keep dependencies up-to-date.
- [ ] **Input Validation**: All incoming data (request bodies, query parameters, headers) is validated using Zod schemas to prevent common vulnerabilities like injection attacks.

## 3. Web Server & Reverse Proxy

- [ ] **HTTPS Only**: Enforce HTTPS by redirecting all HTTP traffic to HTTPS.
- [ ] **Strong SSL/TLS Configuration**:
    - [ ] Use modern TLS versions (TLS 1.2, 1.3).
    - [ ] Disable old, insecure protocols (SSLv2, SSLv3).
    - [ ] Use strong cipher suites.
- [ ] **Security Headers**: Implement security-related HTTP headers in your reverse proxy configuration:
    - [ ] `Strict-Transport-Security (HSTS)`
    - [ ] `X-Frame-Options`
    - [ ] `X-Content-Type-Options`
    - [ ] `Content-Security-Policy (CSP)`
    - [ ] `Referrer-Policy`

## 4. Database (PostgreSQL)

- [ ] **Strong Passwords**: Use a long, complex, and unique password for the database user.
- [ ] **Principle of Least Privilege**: The application's database user should only have the permissions it needs (e.g., `SELECT`, `INSERT`, `UPDATE`, `DELETE` on specific tables). It should not be a superuser.
- [ ] **Encrypted Connections**: Enforce SSL connections between the application and the database (`sslmode=require` or `verify-full`).
- [ ] **Regular Backups**: Ensure automated, regular backups are being made and stored securely.

## 5. Redis

- [ ] **Password Protection**: Always set a password (`requirepass` in `redis.conf`).
- [ ] **Protected Mode**: Do not disable protected mode. This prevents clients from connecting from the public internet.
- [ ] **Disable Dangerous Commands**: Rename or disable commands that can be dangerous if exposed, such as `FLUSHALL`, `FLUSHDB`, `KEYS`, `PEXPIRE`, `DEL`, `CONFIG`, `SHUTDOWN`, `BGREWRITEAOF`, `BGSAVE`, `SAVE`, `SPOP`, `SREM`, `RENAME`, and `DEBUG`.

## 6. Typesense

- [ ] **API Keys**:
    - [ ] Use separate, securely generated API keys for search-only operations and admin operations.
    - [ ] Do not expose the admin API key to the client-side.
- [ ] **Scoped Search Keys**: For multi-tenant or user-specific search scenarios, generate scoped search keys to restrict what data a user can search.

## 7. Logging and Monitoring

- [ ] **Centralized Logging**: Ship logs to a secure, centralized logging system.
- [ ] **Audit Trails**: Monitor logs for suspicious activity, such as repeated failed login attempts or unusual error patterns.
- [ ] **Alerting**: Set up alerts for critical security events and application failures.
