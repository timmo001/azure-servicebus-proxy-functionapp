import { ServiceBusMessage } from "@azure/service-bus";

export interface ReceiveRequestQuery {
  count: number;
  queueName: string;
}

export interface QueueRequestBody {
  queueName: string;
  messages: Array<ServiceBusMessage>;
}