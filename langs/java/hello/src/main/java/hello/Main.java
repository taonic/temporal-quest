package hello;

import java.util.Arrays;

/**
 * hello worker | start | board | hold | pay | itinerary | book | replay: what {@code ./hello} runs.
 * The worker is HelloWorker; the commands that start and talk to workflows are in Starter.
 */
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        String command = args.length > 0 ? args[0] : "worker";
        String[] rest = Arrays.copyOfRange(args, Math.min(1, args.length), args.length);
        try {
            switch (command) {
                case "worker" -> HelloWorker.run();
                case "replay" -> System.exit(Replay.run(rest));
                default -> System.exit(Starter.run(command, rest));
            }
        } catch (Exception err) {
            // 1 is the replayer's "doesn't match": anything else that goes wrong is 2.
            System.err.println(err.getMessage() != null ? err.getMessage() : err);
            System.exit(2);
        }
    }
}
