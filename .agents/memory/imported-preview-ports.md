---
name: Imported-project preview ports
description: Port mapping mismatches that can keep an imported web app from opening in preview.
---

An imported project's `.replit` port mapping can remain on an older port after a webview workflow is configured to wait on port 5000. The app can build and print a startup message while the preview still times out if the mapped local port does not match the server.

**Why:** This project initially mapped the app's old port while the webview workflow waited for 5000, causing repeated startup timeouts despite a successful production build.

**How to apply:** Before retrying a webview workflow after a port timeout, compare its `waitForPort`, the app's actual bind address and port, and `.replit` port mapping. Use the validated configuration flow when updating `.replit`.
