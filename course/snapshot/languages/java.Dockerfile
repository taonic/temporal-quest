# --- Java (course/snapshot/build-language.mjs appends this to the Python snapshot's) -------------
# A JDK, the Java hello built once (so Gradle, the SDK and their dependencies are in the image, and
# a check needs no network), and `quest` on the PATH: a Java learner's terminals open in
# langs/java/hello, where they run `./hello worker` and `quest check F2`. No language server: the
# editor highlights Java, as decided in ticket 02 (jdtls alone needs more memory than the sandbox has).
ARG JDK_VERSION=21.0.5_11
ENV JAVA_HOME=/opt/jdk \
    GRADLE_USER_HOME=/opt/gradle-home
RUN arch=$(uname -m | sed "s/x86_64/x64/;s/arm64/aarch64/") \
 && mkdir -p "$JAVA_HOME" \
 && curl -fsSL "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-$(echo ${JDK_VERSION} | sed 's/_/%2B/')/OpenJDK21U-jdk_${arch}_linux_hotspot_${JDK_VERSION}.tar.gz" \
    | tar -xz -C "$JAVA_HOME" --strip-components=1 --no-same-owner \
 && ln -s "$JAVA_HOME"/bin/* /usr/local/bin/ \
 && java -version
RUN cd /workshop/langs/java/hello \
 && ./gradlew --no-daemon -q installDist \
 && printf '#!/bin/sh\n# quest from anywhere: a language learner works in its project, not the workshop.\ncd /workshop && exec ./quest "$@"\n' > /usr/local/bin/quest \
 && chmod +x /usr/local/bin/quest \
 && chmod -R a+rwX /workshop/langs "$GRADLE_USER_HOME" \
 && sed -i 's#^cd /workshop$#case "$PWD" in /workshop*) ;; *) cd /workshop/langs/java/hello ;; esac#' /etc/bash.bashrc \
 && grep -q 'cd /workshop/langs/java/hello ;; esac$' /etc/bash.bashrc
# (The Python snapshot's bash.bashrc moves every shell to /workshop; a Java learner's terminals
# open in its project instead, unless the runner opened one elsewhere: in /workshop, for a learner who
# switched to Python.)
