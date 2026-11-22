# --- TypeScript (course/snapshot/build-language.mjs appends this to the Python snapshot's) -------
# Node, the TypeScript hello's packages (installed, so a check needs no network), the editor's
# TypeScript language server, and `quest` on the PATH: a TypeScript learner's terminals open in
# langs/typescript/hello, where they run `npm run worker` and `quest check F2`.
ARG NODE_VERSION=24.22.3
RUN arch=$(uname -m | sed "s/x86_64/x64/;s/aarch64/arm64/") \
 && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.gz" \
    | tar -xz -C /usr/local --strip-components=1 --no-same-owner \
 && node --version \
 && npm config set update-notifier false --location=global \
 && npm install -g --no-audit --no-fund typescript-language-server@6.1.0 typescript@5.9.3
COPY lsp_stdio_bridge.py /opt/lsp/lsp_stdio_bridge.py
RUN cd /workshop/langs/typescript/hello \
 && npm ci --no-audit --no-fund \
 && npx tsc --noEmit \
 && printf '#!/bin/sh\n# quest from anywhere: a language learner works in its project, not the workshop.\ncd /workshop && exec ./quest "$@"\n' > /usr/local/bin/quest \
 && chmod +x /usr/local/bin/quest \
 && chmod -R a+rwX /workshop/langs \
 && sed -i 's#^cd /workshop$#cd /workshop/langs/typescript/hello#' /etc/bash.bashrc \
 && grep -q '^cd /workshop/langs/typescript/hello$' /etc/bash.bashrc
# (The Python snapshot's bash.bashrc moves every shell to /workshop; a TypeScript learner's
# terminals open in its project instead.)
