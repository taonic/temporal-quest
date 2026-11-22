# --- C# (course/snapshot/build-language.mjs appends this to the Python snapshot's) ---------------
# The .NET SDK, the C# hello restored and built once (so its packages are in the image, and a check
# needs no network), the editor's C# language server (csharp-ls), and `quest` on the PATH: a C#
# learner's terminals open in langs/dotnet/hello, where they run `./hello worker` and `quest check F2`.
ARG DOTNET_SDK_VERSION=10.0.404
# No ICU in the slim base image: .NET aborts without it, unless it runs culture-invariant.
ENV DOTNET_ROOT=/opt/dotnet \
    NUGET_PACKAGES=/opt/nuget \
    DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
    PATH=/opt/dotnet:/opt/dotnet-tools:$PATH
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh \
 && bash /tmp/dotnet-install.sh --version "${DOTNET_SDK_VERSION}" --install-dir "$DOTNET_ROOT" --no-path \
 && rm /tmp/dotnet-install.sh \
 && ln -s "$DOTNET_ROOT/dotnet" /usr/local/bin/dotnet \
 && dotnet --version \
 && dotnet tool install csharp-ls --version 0.28.0 --tool-path /opt/dotnet-tools \
 && ln -s /opt/dotnet-tools/csharp-ls /usr/local/bin/csharp-ls
COPY lsp_stdio_bridge.py /opt/lsp/lsp_stdio_bridge.py
RUN cd /workshop/langs/dotnet/hello \
 && dotnet build -v q --nologo -nodeReuse:false \
 && dotnet build-server shutdown \
 && printf '#!/bin/sh\n# quest from anywhere: a language learner works in its project, not the workshop.\ncd /workshop && exec ./quest "$@"\n' > /usr/local/bin/quest \
 && chmod +x /usr/local/bin/quest \
 && chmod -R a+rwX /workshop/langs "$NUGET_PACKAGES" \
 && sed -i 's#^cd /workshop$#case "$PWD" in /workshop*) ;; *) cd /workshop/langs/dotnet/hello ;; esac#' /etc/bash.bashrc \
 && grep -q 'cd /workshop/langs/dotnet/hello ;; esac$' /etc/bash.bashrc
# (The Python snapshot's bash.bashrc moves every shell to /workshop; a C# learner's terminals open
# in its project instead, unless the runner opened one elsewhere: in /workshop, for a learner who
# switched to Python.)
