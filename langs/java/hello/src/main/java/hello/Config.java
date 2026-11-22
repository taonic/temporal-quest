package hello;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Where the worker and the starter find Temporal: the workshop's .env (as the Python side reads
 * it), under anything already set in the environment. HELLO_TASK_QUEUE and WORKER_MODE are for the
 * checks and the challenges: a queue of their own, and a worker with only workflows or activities.
 */
public final class Config {
    private Config() {}

    private static final Map<String, String> DOTENV = readDotenv();

    public static final String ADDRESS = env("TEMPORAL_ADDRESS", "localhost:7233");
    public static final String NAMESPACE = env("TEMPORAL_NAMESPACE", "default");
    public static final String UI_URL = env("TEMPORAL_UI_URL", "http://localhost:8233").replaceAll("/$", "");
    public static final String TASK_QUEUE = env("HELLO_TASK_QUEUE", "hello");
    public static final String MODE = env("WORKER_MODE", "all");

    /** A setting: from the environment, else the workshop's .env, else {@code fallback}. */
    public static String env(String name, String fallback) {
        String value = System.getenv(name);
        if (value != null) return value;
        return DOTENV.getOrDefault(name, fallback);
    }

    /** 20 for 20.0, 2.5 for 2.5: a number as a person would write it. */
    public static String number(double value) {
        return value == Math.rint(value) ? String.valueOf((long) value) : String.valueOf(value);
    }

    // The repo's .env: this project is langs/java/hello, three folders down.
    private static Map<String, String> readDotenv() {
        Map<String, String> values = new HashMap<>();
        Path dotenv = Path.of(System.getProperty("user.dir"), "..", "..", "..", ".env").normalize();
        if (!Files.exists(dotenv)) return values;
        Pattern line = Pattern.compile("^\\s*([A-Z_][A-Z0-9_]*)\\s*=\\s*([^#]*?)\\s*(?:#.*)?$");
        try {
            for (String text : Files.readAllLines(dotenv)) {
                Matcher match = line.matcher(text);
                if (match.matches()) values.put(match.group(1), match.group(2));
            }
        } catch (IOException ignored) {
            // No .env: the defaults, or the environment.
        }
        return values;
    }
}
