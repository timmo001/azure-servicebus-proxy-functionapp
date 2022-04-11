import { Context, HttpRequest } from "@azure/functions";
import { ServiceBusClient } from "@azure/service-bus";

import {
  createErrorResponse,
  createBadRequestResponse,
  defaultResponseHeaders,
} from "./util";
import type { QueueRequestBody } from "./types/request";
import type { Response } from "./types/response";

export async function queueMessages(
  context: Context,
  req: HttpRequest
): Promise<void> {
  const { body, headers, method } = req;
  context.log("Request:", { method, body: JSON.stringify(body, undefined, 2) });

  if (!validateQueueRequest(context, req)) return;

  const { queueName, messages } = body as QueueRequestBody;

  const sbClient = new ServiceBusClient(
    process.env.SERVICEBUS_CONNECTION_STRING as string
  );
  const sbSender = sbClient.createSender(queueName);

  try {
    let messageBatch = await sbSender.createMessageBatch();
    for (const message of messages) {
      if (!messageBatch.tryAddMessage(message)) {
        // If add message to the current batch fails send the current batch as it is full
        await sbSender.sendMessages(messageBatch);
        // Create a new batch
        messageBatch = await sbSender.createMessageBatch();

        // Now add the message failed to be added to the previous batch to this batch
        if (!messageBatch.tryAddMessage(message)) {
          // If it still can't be added to the batch, the message is probably too big to fit in a batch
          throw new Error("Message too big to fit in a batch");
        }
      }
    }
    // Send the last created batch of messages to the queue
    await sbSender.sendMessages(messageBatch);

    const response: Response = {
      status: 200,
      headers: defaultResponseHeaders,
      body: {
        status: 200,
        message: `Sent ${messages.length} messages to queue: '${queueName}'`,
        request: { body, headers, method },
      },
    };
    context.res = response;
    context.log(JSON.stringify(response, undefined, 2));

    // Close the sender
    await sbSender.close();
  } catch (e) {
    const errorResponse = createErrorResponse(req, String(e));
    context.log(JSON.stringify(errorResponse, undefined, 2));
    context.res = errorResponse;
  } finally {
    // Close the client
    await sbClient.close();
  }
}

function validateQueueRequest(context: Context, req: HttpRequest): boolean {
  const { body } = req;
  const { queueName, messages } = body as QueueRequestBody;

  if (!process.env.SERVICEBUS_CONNECTION_STRING) {
    const errorResponse = createErrorResponse(
      req,
      "'SERVICEBUS_CONNECTION_STRING' is missing from environment variables!"
    );
    context.log(JSON.stringify(errorResponse, undefined, 2));
    context.res = errorResponse;
    return false;
  }

  if (!queueName) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "Missing 'queueName' from request body!"
    );
    context.log(JSON.stringify(badRequestResponse, undefined, 2));
    context.res = badRequestResponse;
    return false;
  }
  if (!messages) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "Missing 'messages' from request body!"
    );
    context.log(JSON.stringify(badRequestResponse, undefined, 2));
    context.res = badRequestResponse;
    return false;
  }
  if (!Array.isArray(messages)) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "'messages' is not an array!"
    );
    context.log(JSON.stringify(badRequestResponse, undefined, 2));
    context.res = badRequestResponse;
    return false;
  }

  return true;
}
