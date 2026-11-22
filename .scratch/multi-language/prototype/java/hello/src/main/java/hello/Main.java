package hello;

import io.temporal.client.WorkflowClient;
import io.temporal.client.WorkflowClientOptions;
import io.temporal.client.WorkflowOptions;
import io.temporal.client.WorkflowStub;
import io.temporal.serviceclient.WorkflowServiceStubs;
import io.temporal.serviceclient.WorkflowServiceStubsOptions;
import io.temporal.worker.Worker;
import io.temporal.worker.WorkerFactory;
import java.util.UUID;

/** hello worker | hello start SFO JFK */
public class Main {
    static String env(String name, String fallback) {
        return System.getenv().getOrDefault(name, fallback);
    }

    public static void main(String[] args) {
        var service = WorkflowServiceStubs.newServiceStubs(WorkflowServiceStubsOptions.newBuilder()
                .setTarget(env("TEMPORAL_ADDRESS", "localhost:7233"))
                .build());
        var client = WorkflowClient.newInstance(service, WorkflowClientOptions.newBuilder()
                .setNamespace(env("TEMPORAL_NAMESPACE", "default"))
                .build());
        String taskQueue = env("HELLO_TASK_QUEUE", "hello");
        String command = args.length > 0 ? args[0] : "worker";

        if (command.equals("worker")) {
            // WORKER_MODE: the challenges run a worker with only workflows, or only activities.
            String mode = env("WORKER_MODE", "all");
            var factory = WorkerFactory.newInstance(client);
            Worker worker = factory.newWorker(taskQueue);
            if (!mode.equals("activities")) worker.registerWorkflowImplementationTypes(HelloTripWorkflowImpl.class);
            if (!mode.equals("workflows")) worker.registerActivitiesImplementations(new ActivitiesImpl());
            factory.start();
            System.out.println("Hello worker ready on task queue '" + taskQueue + "'");
        } else if (command.equals("start")) {
            String origin = args.length > 1 ? args[1] : "SFO";
            String destination = args.length > 2 ? args[2] : "JFK";
            String workflowId = "hello-" + origin.toLowerCase() + "-" + destination.toLowerCase() + "-"
                    + UUID.randomUUID().toString().substring(0, 4);
            HelloTripWorkflow trip = client.newWorkflowStub(HelloTripWorkflow.class, WorkflowOptions.newBuilder()
                    .setTaskQueue(taskQueue).setWorkflowId(workflowId).build());
            WorkflowClient.start(trip::run, new TripRequest(origin, destination));
            System.out.println("Started " + workflowId);
            System.out.println(WorkflowStub.fromTyped(trip).getResult(String.class));
            System.exit(0);
        }
    }
}
