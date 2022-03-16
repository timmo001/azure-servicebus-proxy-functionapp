import { Context, HttpRequest } from "@azure/functions";
import {
  ServiceBusClient,
  ServiceBusReceivedMessage,
} from "@azure/service-bus";

import {
  createErrorResponse,
  createBadRequestResponse,
  defaultResponseHeaders,
} from "./util";
import type { ReceiveRequestQuery } from "./types/request";
import type { ReceiveResponseMessage } from "./types/response";
import type { Response } from "./types/response";

export async function receiveMessages(
  context: Context,
  req: HttpRequest
): Promise<void> {
  const { headers, method, query } = req;
  context.log("Request:", { method, query });

  if (!validateReceiveRequest(context, req)) return;

  const { queueName, count } = query as Partial<ReceiveRequestQuery>;

  const sbClient = new ServiceBusClient(
    process.env.SERVICE_BUS_CONNECTION_STRING as string
  );
  const sbReceiver = sbClient.createReceiver(queueName!!);

  try {
    const receivedMessages = await sbReceiver.receiveMessages(
      count ? Number(count) : 1,
      { maxWaitTimeInMs: 20000 }
    );
    let messages: Array<ReceiveResponseMessage> = [];
    for (const message of receivedMessages) {
      const {
        body,
        contentType,
        correlationId,
        deliveryCount,
        enqueuedSequenceNumber,
        enqueuedTimeUtc,
        expiresAtUtc,
        messageId,
        partitionKey,
        replyTo,
        replyToSessionId,
        scheduledEnqueueTimeUtc,
        sequenceNumber,
        sessionId,
        state,
        subject,
        timeToLive,
        to,
      } = message;

      await sbReceiver.completeMessage(message);

      messages.push({
        body,
        contentType,
        correlationId,
        deliveryCount,
        enqueuedSequenceNumber,
        enqueuedTimeUtc,
        expiresAtUtc,
        messageId,
        partitionKey,
        replyTo,
        replyToSessionId,
        scheduledEnqueueTimeUtc,
        sequenceNumber,
        sessionId,
        state,
        subject,
        timeToLive,
        to,
      });
    }

    context.log("Messages:", messages);
    const response: Response = {
      status: 200,
      headers: defaultResponseHeaders,
      body: {
        status: 200,
        messages,
        request: { headers, method, query },
      },
    };
    context.res = response;
    context.log(JSON.stringify(response, undefined, 2));

    // Close the receiver
    await sbReceiver.close();
  } catch (e) {
    const errorResponse = createErrorResponse(req, String(e));
    context.log(JSON.stringify(errorResponse, undefined, 2));
    context.res = errorResponse;
  } finally {
    // Close the client
    await sbClient.close();
  }
}

function validateReceiveRequest(context: Context, req: HttpRequest): boolean {
  const { query } = req;
  const { queueName } = query as Partial<ReceiveRequestQuery>;

  if (!process.env.SERVICE_BUS_CONNECTION_STRING) {
    const errorResponse = createErrorResponse(
      req,
      "'SERVICE_BUS_CONNECTION_STRING' is missing from environment variables!"
    );
    context.log(JSON.stringify(errorResponse, undefined, 2));
    context.res = errorResponse;
    return false;
  }

  if (!queueName) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "Missing 'queueName' from request query!"
    );
    context.log(JSON.stringify(badRequestResponse, undefined, 2));
    context.res = badRequestResponse;
    return false;
  }

  return true;
}
