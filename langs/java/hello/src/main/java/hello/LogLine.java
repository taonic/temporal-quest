package hello;

import ch.qos.logback.classic.pattern.ClassicConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * One line a log message, for the worker's terminal: the message in plain words, and an error's
 * root cause (the exception your code threw) without its stack trace.
 */
public class LogLine extends ClassicConverter {
    private static final Pattern ACTIVITY = Pattern.compile("activityType=(\\w+), attempt=(\\d+)");
    private static final Pattern WORKFLOW = Pattern.compile("WorkflowType='(\\w+)'");
    // A Temporal failure's summary: message='card ending 0000 was declined', type='CardDeclined', ...
    private static final Pattern FAILURE = Pattern.compile("message='(.*?)', type='([\\w.$]+)'");

    @Override
    public String convert(ILoggingEvent event) {
        String message = event.getFormattedMessage();
        // The SDK's words for a workflow task that threw: the workflow itself is still running, and
        // Temporal retries the task.
        if (message.startsWith("Workflow task processing failure")) {
            message = "Workflow task failed (the workflow waits, and it is retried)";
        } else if (message.startsWith("Activity failure")) {
            Matcher activity = ACTIVITY.matcher(message);
            message = activity.find()
                    ? "Activity " + activity.group(1) + " failed (attempt " + activity.group(2) + ")"
                    : "Activity failed";
        } else if (message.startsWith("Workflow execution failure")) {
            Matcher workflow = WORKFLOW.matcher(message);
            message = workflow.find() ? "Workflow " + workflow.group(1) + " failed" : "Workflow failed";
        }
        IThrowableProxy error = event.getThrowableProxy();
        if (error == null) return message;
        while (error.getCause() != null) error = error.getCause();
        return message + ": " + plain(error.getMessage());
    }

    // card ending 0000 was declined (CardDeclined), for a Temporal failure's summary; else as it is.
    private static String plain(String message) {
        if (message == null) return "";
        Matcher failure = FAILURE.matcher(message);
        if (!failure.find()) return message;
        String type = failure.group(2);
        // Your exception's own class (java.lang.IllegalStateException) says nothing a learner needs.
        return type.contains(".") ? failure.group(1) : failure.group(1) + " (" + type + ")";
    }
}
