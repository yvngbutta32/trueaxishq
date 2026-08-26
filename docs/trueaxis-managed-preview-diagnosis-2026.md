# Managed Preview Diagnostic

**Observed:** August 26, 2026  
**Evidence label:** **Environment limitation; not an application defect.**

The managed development preview’s expected port, `3000`, was already externally reserved in the sandbox. Repeated managed restarts therefore started the application on fallback ports rather than producing an application-level route or compilation failure. Binding only to port `3000` caused `EADDRINUSE`; restoring the existing safe fallback allowed the app to start on port `3006`. A local HTTP request to `http://127.0.0.1:3006/` returned **200**.

This establishes that the application process starts and responds locally. Screenshot capture and the managed proxy remained unavailable because the preview tool targets the externally reserved expected port. No claim is made that the managed preview issue is solved in application code. Public responsive and authenticated-session checks remain pending when the managed preview or a controlled authenticated session is available.
