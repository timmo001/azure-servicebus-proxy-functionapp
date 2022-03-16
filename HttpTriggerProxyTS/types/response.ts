import { HttpRequest, HttpRequestHeaders } from "@azure/functions";
import { ServiceBusMessage } from "@azure/service-bus";

export interface Response {
  status: number;
  headers: HttpRequestHeaders;
  body: QueueResponseBody | ReceiveResponseBody;
}

export interface QueueResponseBody {
  status: number;
  message: string;
  request: Partial<HttpRequest>;
}

export interface ReceiveResponseBody {
  status: number;
  message?: string;
  messages?: Array<ReceiveResponseMessage>;
  request: Partial<HttpRequest>;
}

export interface ReceiveResponseMessage extends ServiceBusMessage {
  deliveryCount?: number;
  enqueuedTimeUtc?: Date;
  expiresAtUtc?: Date;
  enqueuedSequenceNumber?: number;
  sequenceNumber?: number;
  state: "active" | "deferred" | "scheduled";
}
