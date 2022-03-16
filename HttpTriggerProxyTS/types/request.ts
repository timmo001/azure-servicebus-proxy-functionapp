import { ServiceBusMessage } from "@azure/service-bus";

export interface QueueRequestBody {
  queueName: string;
  messages: Array<ServiceBusMessage>;
}

export interface ReceiveRequestQuery {
  count: number;
  queueName: string;
}
