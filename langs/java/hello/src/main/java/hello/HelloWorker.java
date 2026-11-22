package hello;

import io.temporal.client.WorkflowClient;
import io.temporal.worker.Worker;
import io.temporal.worker.WorkerFactory;

/**
 * The worker: the process that runs workflow and activity code.   ./hello worker
 *
 * <p>It polls the "hello" task queue. Temporal hands it work; it never listens on a port.
 */
public final class HelloWorker {
    private HelloWorker() {}

    /** Every workflow this worker runs (and the replayer replays). */
    static final Class<?>[] WORKFLOWS = {
        HelloTripWorkflowImpl.class,
        BoardingWorkflowImpl.class,
        FareHoldWorkflowImpl.class,
        ItineraryWorkflowImpl.class,
        BookTripWorkflowImpl.class,
    };

    static void run() {
        WorkflowClient client = Starter.client();
        WorkerFactory factory = WorkerFactory.newInstance(client);
        Worker worker = factory.newWorker(Config.TASK_QUEUE);
        // WORKER_MODE: the checks and challenges run only the workflows (their activities are Python's).
        if (!Config.MODE.equals("activities")) worker.registerWorkflowImplementationTypes(WORKFLOWS);
        if (!Config.MODE.equals("workflows")) worker.registerActivitiesImplementations(new ActivitiesImpl());
        // Ctrl-C (or a stop): finish what's running, then exit.
        Runtime.getRuntime().addShutdownHook(new Thread(factory::shutdown));
        factory.start();
        System.out.println("Hello worker ready on task queue '" + Config.TASK_QUEUE + "'");
    }
}
