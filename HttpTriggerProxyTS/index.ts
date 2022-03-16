import { Context, HttpRequest, HttpRequestHeaders } from "@azure/functions";
import {
  ServiceBusClient,
  ServiceBusMessage,
  ServiceBusReceivedMessage,
} from "@azure/service-bus";

interface Response {
  status: number;
  headers: HttpRequestHeaders;
  body: QueueResponseBody | ReceiveResponseBody;
}

interface QueueResponseBody {
  status: number;
  message: string;
  request: Partial<HttpRequest>;
}

interface ReceiveResponseBody {
  status: number;
  message?: string;
  messages?: Array<ServiceBusReceivedMessage>;
  request: Partial<HttpRequest>;
}

interface ReceiveRequestQuery {
  count: number;
  queueName: string;
}

interface QueueRequestBody {
  queueName: string;
  messages: Array<ServiceBusMessage>;
}

const DEFAULT_RESPONSE_HEADERS: HttpRequestHeaders = {
  "Content-Type": "application/json",
};

function createBadRequestResponse(req: HttpRequest, message: string): Response {
  const { body, headers, method } = req;
  return {
    status: 400,
    headers: DEFAULT_RESPONSE_HEADERS,
    body: {
      status: 400,
      message,
      request: { body, headers, method },
    },
  };
}

function createErrorResponse(req: HttpRequest, message: string): Response {
  const { body, headers, method } = req;
  return {
    status: 500,
    headers: DEFAULT_RESPONSE_HEADERS,
    body: {
      status: 500,
      message,
      request: { body, headers, method },
    },
  };
}

function validateQueueRequest(context: Context, req: HttpRequest): boolean {
  const { body } = req;
  const { queueName, messages } = body as QueueRequestBody;

  if (!process.env.SERVICE_BUS_CONNECTION_STRING) {
    const errorResponse = createErrorResponse(
      req,
      "'SERVICE_BUS_CONNECTION_STRING' is missing from environment variables!"
    );
    context.log(errorResponse);
    context.res = errorResponse;
    return false;
  }

  if (!queueName) {
    const error = createBadRequestResponse(
      req,
      "Missing 'queueName' from request body!"
    );
    context.log(error);
    context.res = error;
    return false;
  }
  if (!messages) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "Missing 'messages' from request body!"
    );
    context.log(badRequestResponse);
    context.res = badRequestResponse;
    return false;
  }
  if (!Array.isArray(messages)) {
    const badRequestResponse = createBadRequestResponse(
      req,
      "'messages' is not an array!"
    );
    context.log(badRequestResponse);
    context.res = badRequestResponse;
    return false;
  }

  return true;
}

function validateReceiveRequest(context: Context, req: HttpRequest): boolean {
  const { query } = req;
  const { queueName } = query as Partial<ReceiveRequestQuery>;

  if (!process.env.SERVICE_BUS_CONNECTION_STRING) {
    const errorResponse = createErrorResponse(
      req,
      "'SERVICE_BUS_CONNECTION_STRING' is missing from environment variables!"
    );
    context.log(errorResponse);
    context.res = errorResponse;
    return false;
  }

  if (!queueName) {
    const error = createBadRequestResponse(
      req,
      "Missing 'queueName' from request query!"
    );
    context.log(error);
    context.res = error;
    return false;
  }

  return true;
}

async function queueMessages(
  context: Context,
  req: HttpRequest
): Promise<void> {
  const { body, headers, method } = req;
  context.log("Request:", { method, body });

  if (!validateQueueRequest(context, req)) return;

  const { queueName, messages } = body as QueueRequestBody;

  const sbClient = new ServiceBusClient(
    process.env.SERVICE_BUS_CONNECTION_STRING as string
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
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        status: 200,
        message: `Sent ${messages.length} messages to queue: '${queueName}'`,
        request: { body, headers, method },
      },
    };
    context.log(response);
    context.res = response;

    // Close the sender
    await sbSender.close();
  } catch (e) {
    const errorResponse = createErrorResponse(req, String(e));
    context.log(errorResponse);
    context.res = errorResponse;
  } finally {
    // Close the client
    await sbClient.close();
  }
}

async function receiveMessages(
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
    const messages = await sbReceiver.receiveMessages(count || 1);
    const response: Response = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        status: 200,
        messages,
        request: { headers, method, query },
      },
    };
    context.log(response);
    context.res = response;

    // Close the receiver
    await sbReceiver.close();
  } catch (e) {
    const errorResponse = createErrorResponse(req, String(e));
    context.log(errorResponse);
    context.res = errorResponse;
  } finally {
    // Close the client
    await sbClient.close();
  }
}

async function httpTrigger(context: Context, req: HttpRequest): Promise<void> {
  const { body, headers, method } = req;

  switch (method) {
    case "GET":
      await receiveMessages(context, req);
    case "POST":
      await queueMessages(context, req);
      break;
    default:
      const response: Response = {
        status: 405,
        headers: DEFAULT_RESPONSE_HEADERS,
        body: {
          status: 405,
          message: `Method '${method} not allowed!`,
          request: { body, headers, method },
        },
      };
      context.log(response);
      context.res = response;
      break;
  }
}

export default httpTrigger;
